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

// Check if a vehicle is active (defaulting to true if status is undefined or 'Active')
export function isVehicleActive(v: Vehicle): boolean {
  return !v.status || v.status === 'Active';
}

// Intelligently format large NGN portfolio value (e.g. ₦850M+, ₦1.5B+, ₦2.3T+)
export function formatPortfolioValue(totalNGN: number): string {
  if (!totalNGN || isNaN(totalNGN) || totalNGN <= 0) return '₦0';
  if (totalNGN >= 1_000_000_000_000) {
    const val = (Math.floor((totalNGN / 1_000_000_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}T+`;
  }
  if (totalNGN >= 1_000_000_000) {
    const val = (Math.floor((totalNGN / 1_000_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}B+`;
  }
  if (totalNGN >= 1_000_000) {
    const val = (Math.floor((totalNGN / 1_000_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}M+`;
  }
  if (totalNGN >= 1_000) {
    const val = (Math.floor((totalNGN / 1_000) * 10) / 10).toFixed(1).replace(/\.0$/, '');
    return `₦${val}K+`;
  }
  return formatCurrency(totalNGN);
}

// Map of known ImgBB page codes to 100% full original resolution direct CDN URLs
const KNOWN_IMGBB_MAP: Record<string, string> = {
  'S7XwDCwm': 'https://i.ibb.co/zHhVWvV2/IMG-20260730-WA0041.jpg',
  '8gYZRD6R': 'https://i.ibb.co/v4XnrxZr/IMG-20260730-WA0048.jpg',
  'BHBsT1DZ': 'https://i.ibb.co/zWZfPkcR/IMG-20260730-WA0049.jpg',
  '7xN3nXf7': 'https://i.ibb.co/5XxQr60q/IMG-20260730-WA0050.jpg',
  'S4RSRySF': 'https://i.ibb.co/4nPkPtkh/IMG-20260730-WA0052.jpg',
  'ynQB0P8m': 'https://i.ibb.co/wNzrygKZ/IMG-20260730-WA0051.jpg',
  'yncjHgxK': 'https://i.ibb.co/Gv4SzCrG/IMG-20260730-WA0047.jpg',
  '5XL9LFbM': 'https://i.ibb.co/hxVMVf37/IMG-20260730-WA0032.jpg',
  'FkfCd8df': 'https://i.ibb.co/rKLNX5XL/IMG-20260730-WA0035.jpg',
  'N2rv6xVq': 'https://i.ibb.co/KxDPj60g/IMG-20260730-WA0036.jpg',
  'PGqLXrsK': 'https://i.ibb.co/MkFvwgyr/IMG-20260730-WA0039.jpg',
  'Swz3WG5C': 'https://i.ibb.co/1Gkmhj7W/IMG-20260730-WA0040.jpg',
  'GQBwvLVC': 'https://i.ibb.co/Jj0LR4zr/IMG-20260730-WA0022.jpg',
  'LDLLnD3S': 'https://i.ibb.co/20DDg0Tq/IMG-20260730-WA0024.jpg',
  'gFd1qHsb': 'https://i.ibb.co/4g2yv9Bw/IMG-20260730-WA0026.jpg',
  'q3DsWcKw': 'https://i.ibb.co/v6cPQTp8/IMG-20260730-WA0028.jpg',
  '1YhCcNtY': 'https://i.ibb.co/KcRtngpc/IMG-20260730-WA0030.jpg',
  'fYhkvtss': 'https://i.ibb.co/6R3HBbkk/IMG-20260729-WA0002.jpg',
  'SXh2xmJR': 'https://i.ibb.co/tM7Sh238/IMG-20260729-WA0003.jpg',
  'yBs2zzW9': 'https://i.ibb.co/rfy9BB4j/IMG-20260729-WA0012.jpg',
  'gbBdws3x': 'https://i.ibb.co/fVP9tm2s/IMG-20260729-WA0016.jpg',
  'SXj7gSSZ': 'https://i.ibb.co/5W0x3ZZJ/IMG-20260729-WA0017.jpg',
  'vvkG4czB': 'https://i.ibb.co/n8jvMwk0/IMG-20260729-WA0018.jpg',
  'vx10V7m6': 'https://i.ibb.co/gMykm5wL/IMG-20260729-WA0022.jpg',
  'cSpyPtnL': 'https://i.ibb.co/cSpyPtnL/image.jpg',
};

// Normalize image URLs (convert ImgBB webpage links, Google Drive, Imgur to direct CDN links while maintaining 100% original quality)
export function normalizeImageInput(url: string | undefined | null): string {
  if (!url || typeof url !== 'string') return '';
  let trimmed = url.trim();

  if (!trimmed) return '';

  // Data URLs or blob URLs
  if (trimmed.startsWith('data:image/') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  // ImgBB webpage links like https://ibb.co/yBs2zzW9
  if (trimmed.includes('ibb.co/') && !trimmed.includes('i.ibb.co/')) {
    const match = trimmed.match(/ibb\.co\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      const code = match[1];
      if (KNOWN_IMGBB_MAP[code]) {
        return KNOWN_IMGBB_MAP[code];
      }
      return `https://i.ibb.co/${code}/image.jpg`;
    }
  }

  // Google Drive share links
  if (trimmed.includes('drive.google.com/file/d/')) {
    const match = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://lh3.googleusercontent.com/d/${match[1]}`;
    }
  }

  // Imgur page links
  if (trimmed.includes('imgur.com/') && !trimmed.includes('i.imgur.com/')) {
    const match = trimmed.match(/imgur\.com\/(?:a\/)?([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://i.imgur.com/${match[1]}.jpg`;
    }
  }

  // Dropbox links
  if (trimmed.includes('dropbox.com/s/')) {
    return trimmed.replace('www.dropbox.com', 'dl.dropboxusercontent.com').replace('?dl=0', '');
  }

  // Postimg.cc links
  if (trimmed.includes('postimg.cc/') && !trimmed.includes('i.postimg.cc/')) {
    const match = trimmed.match(/postimg\.cc\/([a-zA-Z0-9]+)/);
    if (match && match[1]) {
      return `https://i.postimg.cc/${match[1]}/image.jpg`;
    }
  }

  return trimmed;
}

// Async helper to resolve ImgBB og:image direct CDN links dynamically via server API
export async function resolveImageLink(url: string): Promise<string> {
  const syncNormalized = normalizeImageInput(url);
  if (syncNormalized.includes('ibb.co/') && !syncNormalized.includes('i.ibb.co/')) {
    try {
      const res = await fetch(`/api/resolve-image?url=${encodeURIComponent(syncNormalized)}`);
      const data = await res.json();
      if (data && data.resolvedUrl) {
        return data.resolvedUrl;
      }
    } catch (e) {
      console.warn('Failed to resolve image link via server API:', e);
    }
  }
  return syncNormalized;
}

export function getImageUrl(url: string | undefined | null): string {
  if (!url || typeof url !== 'string' || !url.trim()) {
    return 'https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&q=100&w=2400';
  }

  return normalizeImageInput(url);
}

// Async fetch vehicles from server with fallback to localStorage
export async function fetchVehicles(): Promise<Vehicle[]> {
  try {
    const res = await fetch('/api/vehicles');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        localStorage.setItem(VEHICLES_KEY, JSON.stringify(data));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: data }));
        }
        return data;
      }
    }
  } catch (e) {
    console.warn('Could not fetch vehicles from server, using local storage cache:', e);
  }
  return getVehicles();
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
      'hyundai-genesis-g80-2018-white',
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

    const synced = [...filtered];

    // Ensure all items from INITIAL_VEHICLES exist in synced and have latest initial images
    [...INITIAL_VEHICLES].reverse().forEach(initial => {
      const idx = synced.findIndex(v => v.id === initial.id);
      if (idx === -1) {
        synced.unshift(initial);
        updated = true;
      } else if (initial.id === 'toyota-yaris-2014-white-le-belgium') {
        if (JSON.stringify(synced[idx].images) !== JSON.stringify(initial.images)) {
          synced[idx].images = initial.images;
          updated = true;
        }
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

// Save vehicles to localStorage AND sync to backend server
export function saveVehicles(vehicles: Vehicle[]): void {
  localStorage.setItem(VEHICLES_KEY, JSON.stringify(vehicles));
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vehiclesUpdated', { detail: vehicles }));
  }

  // Sync to server asynchronously so all devices see the changes
  fetch('/api/vehicles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(vehicles)
  }).catch(err => {
    console.error('Failed to sync vehicles to server:', err);
  });
}

// Fetch leads from server
export async function fetchLeads(): Promise<Lead[]> {
  try {
    const res = await fetch('/api/leads');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem(LEADS_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // fallback
  }
  return getLeads();
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

  fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(leads)
  }).catch(() => {});

  return newLead;
}

// Update lead status/notes
export function updateLead(leadId: string, updates: Partial<Lead>): Lead[] {
  const leads = getLeads();
  const updatedLeads = leads.map(l => l.id === leadId ? { ...l, ...updates } : l);
  localStorage.setItem(LEADS_KEY, JSON.stringify(updatedLeads));

  fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updatedLeads)
  }).catch(() => {});

  return updatedLeads;
}

// Fetch inquiries from server
export async function fetchInquiries(): Promise<Inquiry[]> {
  try {
    const res = await fetch('/api/inquiries');
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        localStorage.setItem(INQUIRIES_KEY, JSON.stringify(data));
        return data;
      }
    }
  } catch (e) {
    // fallback
  }
  return getInquiries();
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

  fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(inquiries)
  }).catch(() => {});

  return newInquiry;
}

// Update inquiry status
export function updateInquiry(inquiryId: string, updates: Partial<Inquiry>): Inquiry[] {
  const inquiries = getInquiries();
  const updated = inquiries.map(i => i.id === inquiryId ? { ...i, ...updates } : i);
  localStorage.setItem(INQUIRIES_KEY, JSON.stringify(updated));

  fetch('/api/inquiries', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updated)
  }).catch(() => {});

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
