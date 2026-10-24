/**
 * Jite Auto Deals — Centralized AI Knowledge Base & Guardrails
 * 
 * Authoritative business policies, consultation principles, inspection steps,
 * and high-intent conversion guidelines for Jite Auto Deals in Nigeria.
 */

export interface AIKnowledgeConfig {
  businessName: string;
  positioning: string;
  consultantName: string;
  locations: string[];
  principles: string[];
  inspectionPolicy: string;
  customsDutyPolicy: string;
  paymentPolicy: string;
  financingInfo: string;
  sourcingPolicy: string;
  guardrails: string[];
  frequentlyAskedQuestions: { question: string; answer: string }[];
}

export const JITE_AI_KNOWLEDGE: AIKnowledgeConfig = {
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
  ],
  frequentlyAskedQuestions: [
    {
      question: 'How does Jite Auto Deals work?',
      answer: 'We act as your personal vehicle consultant. You can browse our verified catalogue, use "Find My Car" to state your exact budget and preference, or send us a link to a car you found elsewhere for us to verify, inspect, and negotiate on your behalf.'
    },
    {
      question: 'Can I inspect the car before paying?',
      answer: 'Yes, 100%. Physical pre-purchase inspection and a test drive are non-negotiable parts of our buying process. You never pay for a vehicle without inspection and verification.'
    },
    {
      question: 'Are Tokunbo vehicles duty-paid?',
      answer: 'Yes. All foreign-used (Tokunbo) vehicles recommended by Jite Auto Deals are confirmed to possess authentic, verified Nigerian Customs duty clearance.'
    },
    {
      question: 'Do you deliver outside Lagos and Abuja?',
      answer: 'Yes. We frequently source and inspect vehicles for clients in Port Harcourt, Ibadan, Benin, Asaba, Kano, and nationwide, providing detailed video reports and secure inter-state delivery.'
    },
    {
      question: 'Can you help me choose if I only have a budget?',
      answer: 'Absolutely. That is our core specialty. Tell us your budget (e.g. ₦15M, ₦20M, ₦30M) and your primary usage (family, daily commute, business, luxury), and we will narrow down the most reliable options with good maintenance and resale value in Nigeria.'
    }
  ]
};
