import { Vehicle, Lead, Inquiry } from './types';
import { INITIAL_VEHICLES } from './data';

// LocalStorage Keys
const VEHICLES_KEY = 'jite_vehicles_v1';
const LEADS_KEY = 'jite_leads_v1';
const INQUIRIES_KEY = 'jite_inquiries_v1';

// Format Currency to Nigerian Naira (₦)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    maximumFractionDigits: 0,
  }).format(amount);
}

// Format Mileage
export function formatMileage(km: number): string {
  return new Intl.NumberFormat('en-US').format(km) + ' km';
}

// Get loaded vehicles from localStorage or seed
export function getVehicles(): Vehicle[] {
  const data = localStorage.getItem(VEHICLES_KEY);
  if (!data) {
    localStorage.setItem(VEHICLES_KEY, JSON.stringify(INITIAL_VEHICLES));
    return INITIAL_VEHICLES;
  }
  try {
    const parsed = JSON.parse(data) as Vehicle[];
    let updated = false;

    // Filter out old pre-populated initial vehicles we want to remove
    const OLD_INITIAL_IDS = [
      'lexus-rx350-2018',
      'mercedes-benz-c300-2017',
      'toyota-hilux-2021',
      'range-rover-velar-2019',
      'honda-accord-2018',
      'lexus-es350-2019',
      'toyota-rav4-2020',
      'toyota-camry-2019'
    ];

    const filtered = parsed.filter(v => !OLD_INITIAL_IDS.includes(v.id));
    if (filtered.length !== parsed.length) {
      updated = true;
    }

    const synced = filtered.map((v) => {
      const match = INITIAL_VEHICLES.find(i => i.id === v.id);
      if (match) {
        // If initial vehicle was updated in code, update it in localStorage as well
        if (JSON.stringify(v) !== JSON.stringify(match)) {
          updated = true;
          return match;
        }
      }
      return v;
    });

    // Ensure all items from INITIAL_VEHICLES exist in synced (insert new ones at the beginning)
    [...INITIAL_VEHICLES].reverse().forEach(initial => {
      if (!synced.some(v => v.id === initial.id)) {
        synced.unshift(initial);
        updated = true;
      }
    });

    if (updated) {
      localStorage.setItem(VEHICLES_KEY, JSON.stringify(synced));
      return synced;
    }
    return synced;
  } catch (e) {
    return INITIAL_VEHICLES;
  }
}

// Save vehicles to localStorage
export function saveVehicles(vehicles: Vehicle[]): void {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: vehicles }));
  }
}

// Get leads from localStorage
export function getLeads(): Lead[] {
  const data = localStorage.getItem(LEADS_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Save new lead
export function saveLead(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): Lead {
  const leads = getLeads();
  const newLead: Lead = {
    ...lead,
    id: 'lead_' + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: 'New'
  };
  leads.unshift(newLead);
  localStorage.setItem(LEADS_KEY, JSON.stringify(leads));
  return newLead;
}

// Update lead status/notes
export function updateLead(leadId: string, updates: Partial<Lead>): Lead[] {
  const leads = getLeads();
  const updatedLeads = leads.map(l => l.id === leadId ? { ...l, ...updates } : l);
  localStorage.setItem(LEADS_KEY, JSON.stringify(updatedLeads));
  return updatedLeads;
}

// Get inquiries from localStorage
export function getInquiries(): Inquiry[] {
  const data = localStorage.getItem(INQUIRIES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Save new inquiry
export function saveInquiry(inquiry: Omit<Inquiry, 'id' | 'createdAt' | 'status'>): Inquiry {
  const inquiries = getInquiries();
  const newInquiry: Inquiry = {
    ...inquiry,
    id: 'inq_' + Math.random().toString(36).substr(2, 9),
    createdAt: new Date().toISOString(),
    status: 'New'
  };
  inquiries.unshift(newInquiry);
  localStorage.setItem(INQUIRIES_KEY, JSON.stringify(inquiries));
  return newInquiry;
}

// Update inquiry status
export function updateInquiry(inquiryId: string, updates: Partial<Inquiry>): Inquiry[] {
  const inquiries = getInquiries();
  const updated = inquiries.map(i => i.id === inquiryId ? { ...i, ...updates } : i);
  localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));
  return updated;
}

// Export prefilled WhatsApp link generator
// Phone Number: 08180823197
// International Format: 2348180823197
const CONSULTANT_PHONE = '2348180823197';

export function getWhatsAppLink(message: string): string {
  return `https://wa.me/${CONSULTANT_PHONE}?text=${encodeURIComponent(message)}`;
}

// Predefined WhatsApp Messages

export function getGeneralConsultationMessage(): string {
  return `Hello Jite Auto Deals! I'm interested in finding a quality vehicle. I'd love to consult with a vehicle specialist to compare my options based on my budget.`;
}

export function getVehicleInquiryMessage(vehicle: Vehicle): string {
  return `Hello Jite Auto Deals! I am interested in the ${vehicle.year} ${vehicle.make} ${vehicle.model} priced at ${formatCurrency(vehicle.price)} located in ${vehicle.location}. Please let me know its availability and next steps!`;
}

export function getLeadQualificationMessage(
  vehicle: Vehicle | string,
  budget: number,
  paymentMethod: string,
  readyToBuy: string,
  name: string,
  phone?: string
): string {
  if (typeof vehicle === 'string') {
    return (
      `*NEW VEHICLE INQUIRY* 🚗✨\n` +
      `Hello Jite Auto Deals! I qualified my acquisition request on your website. Here are my details:\n\n` +
      `👤 *BUYER INFORMATION:*\n` +
      `• *Full Name:* ${name}\n` +
      (phone ? `• *Phone Number:* ${phone}\n` : '') +
      `\n🚗 *SELECTED VEHICLE:*\n` +
      `• *Model:* ${vehicle}\n\n` +
      `💳 *BUYER CRITERIA:*\n` +
      `• *Target Budget:* ${formatCurrency(budget)}\n` +
      `• *Payment Method:* ${paymentMethod === 'Cash' ? 'Outright Cash Purchase' : 'Vehicle Finance Program'}\n` +
      `• *Purchase Timeline:* ${readyToBuy}\n\n` +
      `Please review my request and connect me with a verified specialist to proceed with inspection and acquisition!`
    );
  }

  return (
    `*NEW VEHICLE ACQUISITION INQUIRY* 🚗✨\n` +
    `Hello Jite Auto Deals! I just completed the "Get This Car" inquiry on your website for a catalog vehicle.\n\n` +
    `📋 *SELECTED VEHICLE DETAILS:*\n` +
    `• *Car:* ${vehicle.year} ${vehicle.make} ${vehicle.model}\n` +
    `• *Listed Price:* ${formatCurrency(vehicle.price)}\n` +
    `• *Condition:* ${vehicle.condition}\n` +
    `• *Color:* ${vehicle.color}\n` +
    `• *Transmission:* ${vehicle.transmission}\n` +
    `• *Location:* ${vehicle.location}\n\n` +
    `👤 *BUYER INFORMATION:*\n` +
    `• *Full Name:* ${name}\n` +
    `• *Phone Number:* ${phone || 'Not provided'}\n\n` +
    `💳 *BUYER SOURCING CRITERIA:*\n` +
    `• *Target Budget:* ${formatCurrency(budget)}\n` +
    `• *Payment Method:* ${paymentMethod === 'Cash' ? 'Outright Cash Purchase' : 'Vehicle Finance Program'}\n` +
    `• *Purchase Timeline:* ${readyToBuy}\n\n` +
    `Please confirm vehicle availability and guide me on the next steps for purchase/inspection!`
  );
}

export function getHelpMeFindCarMessage(lead: Omit<Lead, 'id' | 'createdAt' | 'status'>): string {
  return (
    `*CUSTOM VEHICLE HUNT REQUEST* 🚗✨\n` +
    `Hello Jite Auto Deals! I need help sourcing a vehicle. Here are my selected preferences:\n\n` +
    `👤 *BUYER INFORMATION:*\n` +
    `• *Full Name:* ${lead.name}\n` +
    `• *Phone Number:* ${lead.phone}\n\n` +
    `🚗 *DESIRED VEHICLE SPECIFICATIONS:*\n` +
    `• *Body Category:* ${lead.vehicleType}\n` +
    `• *Preferred Brand:* ${lead.brand}\n\n` +
    `💳 *ACQUISITION CRITERIA:*\n` +
    `• *Target Budget:* ${formatCurrency(lead.budget)}\n` +
    `• *Payment Strategy:* ${lead.paymentMethod === 'Cash' ? 'Outright Cash Purchase' : 'Vehicle Finance Program'}\n\n` +
    `Please help me find and match a verified vehicle meeting these criteria!`
  );
}
