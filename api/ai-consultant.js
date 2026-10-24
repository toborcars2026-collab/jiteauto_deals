import { GoogleGenAI } from '@google/genai';

const JITE_AI_KNOWLEDGE = {
  businessName: 'Jite Auto Deals',
  positioning: 'Trusted Vehicle Consultant in Nigeria — Helping buyers find, source, and navigate vehicle purchases with confidence.',
  consultantName: 'Tobor Jite',
  locations: ['Lagos', 'Abuja', 'Nationwide Delivery with Escrow/Verification'],
  principles: [
    'We are not a high-pressure car lot; we are automotive consultants who represent the buyer’s best interest.',
    'Transparency first: Every car has a story, and we uncover verified history, mileage, and mechanical condition before purchase.',
    'Zero blind deposits: Never pay online deposits to unverified sellers. Physical inspection and paper verification come first.',
    'Comprehensive vetting: Engine health, transmission engagement, electrical harnesses, flood indicators, and structural chassis integrity are rigorously checked.',
    'Authentic Customs Duty: Every foreign-used (Tokunbo) vehicle is checked for genuine duty clearance with Nigerian Customs.'
  ],
  inspectionPolicy: 'Physical pre-purchase inspection is standard procedure. We facilitate or conduct comprehensive physical mechanical checks, computer OBD-II diagnostic scans, and test drives before final commitment.',
  customsDutyPolicy: 'All Tokunbo vehicles are verified for authentic Nigerian Customs duty documentation. We verify Single Window duty papers to ensure clients never encounter seizure or impoundment issues.',
  paymentPolicy: 'Transactions are conducted safely and transparently through verified channels only after inspection reports are approved. We strongly advise against unverified online wire transfers before viewing.',
  financingInfo: 'We partner with accredited Nigerian auto financing institutions for qualified salary earners and registered business owners seeking structured monthly repayment terms.',
  sourcingPolicy: 'If a buyer needs a specific make, model, year, or trim that is not currently in our active stock, we provide bespoke vehicle sourcing across our trusted network of vetted dealers and direct importers in Lagos and Abuja.',
  guardrails: [
    'NEVER claim a vehicle is "100% guaranteed", "zero risk", or "mechanically immortal". Cars are complex machines; emphasize thorough inspection and transparent disclosure.',
    'NEVER fabricate vehicle inventory, prices, features, or availability that do not exist in the verified database.',
    'If a vehicle is not in inventory, proactively offer our personalized Vehicle Sourcing service instead of just saying "we do not have it".',
    'Recognize high-intent buying signals (e.g. asking for price, inspection, availability, payment) and smoothly offer to connect the customer to Tobor Jite on WhatsApp.'
  ]
};

let aiClient = null;

function getGenAIClient() {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

/**
 * Normalizes query string for basic keyword matching in fallback.
 */
function cleanText(str) {
  return (str || '').toLowerCase().replace(/[^a-z0-9]/g, ' ');
}

/**
 * Intelligent local inventory fallback matching when Gemini API is unavailable or offline.
 */
function generateLocalFallback(userMessage, activeVehicle, vehicles) {
  const query = cleanText(userMessage);
  const matched = [];

  // If currently on a vehicle page and user asks about this car
  if (activeVehicle && (query.includes('this') || query.includes('car') || query.includes('inspect') || query.includes('available') || query.includes('price'))) {
    const isIntent = query.includes('buy') || query.includes('inspect') || query.includes('price') || query.includes('available') || query.includes('pay') || query.includes('test drive');
    return {
      replyText: `The ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} is currently listed at ₦${new Intl.NumberFormat('en-NG').format(activeVehicle.price)}. It is a verified ${activeVehicle.condition} located in ${activeVehicle.location}. Every vehicle through Jite Auto Deals undergoes a comprehensive pre-purchase physical inspection and customs duty verification before payment. Would you like to connect directly with Tobor Jite to confirm availability and schedule an inspection?`,
      matchedVehicleIds: [activeVehicle.id],
      suggestedActions: ['Can I inspect this vehicle?', 'Chat with Jite on WhatsApp', 'Show similar alternatives'],
      isHighIntent: isIntent,
      sourcingOpportunity: false,
      whatsAppSummary: `Hello Jite Auto Deals, I was chatting with your AI Consultant regarding the ${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model} (₦${new Intl.NumberFormat('en-NG').format(activeVehicle.price)}). I would like to confirm availability and discuss inspection.`
    };
  }

  // Budget detection
  let maxBudget = null;
  const numMatches = userMessage.match(/(\d+(?:\.\d+)?)\s*(?:m|million|milli)/i);
  if (numMatches) {
    maxBudget = parseFloat(numMatches[1]) * 1_000_000;
  }

  // Search real inventory
  if (Array.isArray(vehicles) && vehicles.length > 0) {
    for (const v of vehicles) {
      const vText = cleanText(`${v.year} ${v.make} ${v.model} ${v.bodyType} ${v.condition} ${v.location}`);
      let score = 0;

      if (query.includes((v.make || '').toLowerCase())) score += 3;
      if (query.includes((v.model || '').toLowerCase())) score += 4;
      if (query.includes((v.bodyType || '').toLowerCase())) score += 2;
      if (query.includes('suv') && (v.bodyType || '').toLowerCase().includes('suv')) score += 3;
      if (query.includes('sedan') && (v.bodyType || '').toLowerCase().includes('sedan')) score += 3;
      if (query.includes('toyota') && (v.make || '').toLowerCase().includes('toyota')) score += 3;
      if (query.includes('mercedes') && (v.make || '').toLowerCase().includes('mercedes')) score += 3;
      if (query.includes('lexus') && (v.make || '').toLowerCase().includes('lexus')) score += 3;
      if (query.includes('honda') && (v.make || '').toLowerCase().includes('honda')) score += 3;

      if (maxBudget && v.price && v.price <= maxBudget * 1.15) {
        score += 2;
      }

      if (score > 2) {
        matched.push({ v, score });
      }
    }
    matched.sort((a, b) => b.score - a.score);
  }

  if (matched.length > 0) {
    const topMatches = matched.slice(0, 3).map(m => m.v);
    const topNames = topMatches.map(m => `${m.year} ${m.make} ${m.model} (₦${new Intl.NumberFormat('en-NG').format(m.price)})`).join(', ');
    return {
      replyText: `Based on your request, here are verified options currently available in our catalogue: ${topNames}. Each car has undergone physical inspection and duty verification. Which of these fits what you have in mind?`,
      matchedVehicleIds: topMatches.map(m => m.id),
      suggestedActions: ['View Vehicle Details', 'I want something cheaper', 'Chat with Jite on WhatsApp'],
      isHighIntent: query.includes('buy') || query.includes('inspect') || query.includes('serious'),
      sourcingOpportunity: false,
      whatsAppSummary: `Hello Jite Auto Deals, I was using the AI Consultant and I am interested in exploring options around: "${userMessage}".`
    };
  }

  // Sourcing detection if no matches found
  const isLookingForCar = query.includes('need') || query.includes('want') || query.includes('looking for') || query.includes('have') || query.includes('search');
  if (isLookingForCar) {
    return {
      replyText: `I don't currently see that exact model confirmed in our active inventory right now. However, Jite Auto Deals provides bespoke vehicle sourcing across our trusted dealer networks in Lagos and Abuja. We can inspect and verify one for you. Would you like to submit a sourcing request?`,
      matchedVehicleIds: [],
      suggestedActions: ['Submit Sourcing Request', 'Browse other cars in stock', 'Chat with Jite on WhatsApp'],
      isHighIntent: true,
      sourcingOpportunity: true,
      whatsAppSummary: `Hello Jite Auto Deals, I am looking to source a vehicle: "${userMessage}". Please let me know your sourcing terms and availability.`
    };
  }

  return {
    replyText: `Welcome to Jite Auto Deals! I'm your digital vehicle consultant. Whether you have a specific budget (e.g. ₦15M - ₦30M), need an SUV vs Sedan recommendation, or want us to inspect a car you found elsewhere, how can I assist you today?`,
    matchedVehicleIds: [],
    suggestedActions: ['I need an SUV under ₦25M', 'Help me choose by budget', 'How Jite Auto Deals works', 'Speak with Jite on WhatsApp'],
    isHighIntent: false,
    sourcingOpportunity: false,
    whatsAppSummary: `Hello Jite Auto Deals, I would like a consultation on finding the right vehicle.`
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method Not Allowed' }));
    return;
  }

  let body = {};
  try {
    if (req.body && typeof req.body === 'object') {
      body = req.body;
    } else {
      let raw = '';
      for await (const chunk of req) raw += chunk;
      body = raw ? JSON.parse(raw) : {};
    }
  } catch {
    body = {};
  }

  const {
    userMessage = '',
    history = [],
    activeVehicle = null,
    vehicles = [],
  } = body;

  if (!userMessage || typeof userMessage !== 'string' || !userMessage.trim()) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'userMessage is required' }));
    return;
  }

  // Check if Gemini API is available
  const ai = getGenAIClient();
  if (!ai) {
    // Graceful intelligent fallback
    const fallbackResponse = generateLocalFallback(userMessage, activeVehicle, vehicles);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ...fallbackResponse, source: 'local_consultant' }));
    return;
  }

  try {
    // Prepare real inventory snapshot (concise list so token usage is ultra-efficient)
    const inventorySnapshot = (Array.isArray(vehicles) ? vehicles : [])
      .slice(0, 20)
      .map(v => ({
        id: v.id,
        title: `${v.year} ${v.make} ${v.model}`,
        priceNGN: v.price,
        formattedPrice: `₦${new Intl.NumberFormat('en-NG').format(v.price)}`,
        bodyType: v.bodyType,
        condition: v.condition,
        location: v.location,
        transmission: v.transmission,
        fuelType: v.fuelType,
      }));

    const systemInstruction = `You are "Jite AI Vehicle Consultant", the professional digital vehicle consultant for Jite Auto Deals in Nigeria.
Your job is to help website visitors find, source, and choose the right vehicle with genuine confidence, and smoothly guide interested buyers to WhatsApp conversations with Tobor Jite.

COMPANY POSITIONING & POLICIES:
- Name: Jite Auto Deals
- Consultant: Tobor Jite
- Role: We are vehicle consultants and verified sourcing specialists, NOT a generic high-pressure car dealer.
- Locations: Primary inspection hubs in Lagos and Abuja. Verified inter-state delivery nationwide.
- Inspection Policy: Physical mechanical pre-purchase inspection (engine, transmission, OBD-II scanner, suspension, flood test) is MANDATORY before any buyer pays.
- Duty Clearance: All Tokunbo cars have authenticated Nigerian Customs duty documentation.
- Zero blind deposits: Never ask or allow customers to wire blind deposits online.
- Sourcing: If a buyer wants a car NOT in the current stock, we source it directly through vetted dealer partners in Lagos and Abuja. Never just say "we don't have it" — offer to source it!

STYLE & TONE:
- Warm, professional, consultative, concise, honest.
- Do NOT sound robotic. Do NOT say "As an AI...". Do NOT use excessive emojis.
- Never guarantee a mechanical machine is "100% fault-free" or "zero risk". Emphasize rigorous inspection.
- When buying signals appear (e.g. asking price, inspection, availability, payment, "I want to buy"), acknowledge warmly and provide a clear invitation to connect on WhatsApp.

AVAILABLE VERIFIED INVENTORY (Source of Truth):
${JSON.stringify(inventorySnapshot, null, 2)}

ACTIVE VEHICLE BEING VIEWED BY CUSTOMER (if any):
${activeVehicle ? JSON.stringify({
  id: activeVehicle.id,
  title: `${activeVehicle.year} ${activeVehicle.make} ${activeVehicle.model}`,
  price: `₦${new Intl.NumberFormat('en-NG').format(activeVehicle.price)}`,
  condition: activeVehicle.condition,
  location: activeVehicle.location,
  engine: activeVehicle.engine,
  mileage: activeVehicle.mileage,
  description: activeVehicle.description
}) : 'None'}

OUTPUT FORMAT:
You MUST respond with valid JSON adhering to this exact schema:
{
  "replyText": "Your direct consultative reply to the user (2 to 4 concise paragraphs maximum).",
  "matchedVehicleIds": ["id_of_vehicle_from_inventory_if_applicable"],
  "suggestedActions": ["Short quick reply 1", "Short quick reply 2", "Chat with Jite on WhatsApp"],
  "isHighIntent": true_if_user_shows_purchase_or_inspection_intent_otherwise_false,
  "sourcingOpportunity": true_if_user_asked_for_car_not_in_inventory_otherwise_false,
  "whatsAppSummary": "Concise pre-formatted WhatsApp message ready for user to send to Tobor Jite."
}`;

    // Format conversation history for Gemini
    const formattedHistory = [];
    if (Array.isArray(history)) {
      for (const msg of history.slice(-6)) {
        if (msg.sender === 'user') {
          formattedHistory.push({ role: 'user', parts: [{ text: msg.text }] });
        } else if (msg.sender === 'ai') {
          formattedHistory.push({ role: 'model', parts: [{ text: msg.text }] });
        }
      }
    }

    formattedHistory.push({
      role: 'user',
      parts: [{ text: userMessage }]
    });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: formattedHistory,
      config: {
        systemInstruction,
        temperature: 0.7,
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text ? response.text.trim() : '';
    let parsedData = {};
    try {
      parsedData = JSON.parse(rawText);
    } catch {
      parsedData = {
        replyText: rawText || 'I am here to help you find and navigate your next vehicle purchase with Jite Auto Deals. What is your preferred budget or brand?',
        matchedVehicleIds: [],
        suggestedActions: ['Browse Cars', 'Find My Car', 'Chat on WhatsApp'],
        isHighIntent: false,
        sourcingOpportunity: false,
        whatsAppSummary: `Hello Jite Auto Deals, I was consulting with your AI on the website regarding: ${userMessage}`
      };
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ...parsedData, source: 'gemini_3.8_flash' }));
  } catch (err) {
    console.warn('[Gemini AI Consultant] Error invoking Gemini, using local fallback:', err?.message || err);
    const fallbackResponse = generateLocalFallback(userMessage, activeVehicle, vehicles);
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ...fallbackResponse, source: 'local_consultant' }));
  }
}
