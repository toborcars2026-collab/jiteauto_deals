export type NavigationTab = 'home' | 'browse' | 'find-car' | 'source-car' | 'how-it-works' | 'about' | 'admin';

export type VehicleStatus = 'Available' | 'Reserved' | 'Sold' | 'Hidden' | 'Active' | 'Inactive';

export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number; // in NGN
  mileage?: number; // in km (optional)
  transmission: 'Automatic' | 'Manual' | string;
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric' | string;
  bodyType: 'Sedan' | 'SUV' | 'Coupe' | 'Hatchback' | 'Truck' | 'Crossover' | 'Minivan' | 'Luxury SUV' | string;
  location: string;
  dealership?: string;
  images: string[];
  description: string;
  engine?: string;
  color: string;
  condition: 'Foreign Used' | 'Nigerian Used' | 'Brand New' | 'Direct Belgium' | 'Clean Used' | 'Extremely Clean' | 'Extremely Clean Used' | 'Extremely Clean Nigerian Used' | 'Slightly Used' | 'Like New' | 'Few Months Used' | 'Used' | string;
  isFeatured: boolean;
  inSlideshow?: boolean;
  slideshowOrder?: number;
  status?: VehicleStatus;
  createdAt?: string;
  updatedAt?: string;
}

export type LeadStatus = 'New' | 'Contacted' | 'In Progress' | 'Completed' | 'Closed';

export interface Lead {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  budget: number; // in NGN
  brand: string;
  model?: string;
  location?: string;
  paymentMethod: 'Cash' | 'Financing' | string;
  requirements?: string;
  type?: 'find_car' | 'source_car' | 'general';
  sourceUrl?: string;
  sourceImage?: string;
  createdAt: string;
  status: LeadStatus;
  notes?: string;
  source?: string;
  aiSummary?: string;
  whatsappHandoff?: boolean;
}

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  vehicleId: string;
  vehicleName: string;
  budget?: number;
  paymentMethod?: 'Cash' | 'Financing' | string;
  readyToBuy?: string;
  preferredContact?: 'WhatsApp' | 'Call' | string;
  message?: string;
  createdAt: string;
  status: LeadStatus;
  preferredDate?: string;
  preferredTime?: string;
  type?: 'inspection' | 'general' | string;
  vehiclePrice?: number;
  vehicleLocation?: string;
}

export interface BusinessSettings {
  businessName: string;
  brandTagline: string;
  consultantName: string;
  phoneDisplay: string;
  phoneCallUrl: string;
  whatsAppNumber: string;
  email: string;
  address: string;
  instagramUrl: string;
  tikTokUrl: string;
  facebookUrl: string;
  homepageCtaText: string;
  footerText: string;
  updatedAt?: string;
}

export interface FunnelAnalyticsData {
  visitors?: number;
  aiOpened?: number;
  aiConversations?: number;
  vehicleSearches?: number;
  vehiclesViewed?: number;
  vehicleSaves?: number;
  compareActions?: number;
  enquiriesStarted?: number;
  leadsSubmitted?: number;
  whatsAppClicks?: number;
  interestedClicks?: number;
  callClicks?: number;
  sourcingRequests?: number;
  filterUsage?: number;
  findMyCarSubmissions?: number;
  sourceSubmissions?: number;
  topViewedVehicles?: Record<string, number>;
  topEnquiryVehicles?: Record<string, number>;
  mostSearchedBrands?: Record<string, number>;
  lastUpdated?: string;
  updatedAt?: string;
}

export interface AIConsultantMessage {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp?: string | number;
  suggestedVehicles?: Vehicle[];
  matchedVehicleIds?: string[];
  suggestedActions?: string[];
  isHighIntent?: boolean;
  sourcingOpportunity?: boolean;
  whatsAppSummary?: string;
  ctaType?: 'inspection' | 'whatsapp' | 'call' | 'sourcing' | 'details';
  ctaVehicle?: Vehicle;
  quickReplies?: string[];
}


