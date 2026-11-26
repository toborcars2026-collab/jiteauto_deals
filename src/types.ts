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
  /** Optional genuine 3D model URL (.glb / .gltf) if uploaded for the vehicle */
  model3dUrl?: string;
  /** Optional array of sequential 360 turntable frame URLs if uploaded for the vehicle */
  frames360?: string[];
}

export type EditorialCategory =
  | 'Inspection Guide'
  | 'Buyer Strategy'
  | 'Vehicle Walkaround'
  | 'Market Brief';

export interface EditorialPost {
  id: string;
  title: string;
  category: EditorialCategory;
  summary: string;
  body: string;
  readTime: string;
  imageUrl?: string;
  videoUrl?: string;
  publishedAt: string;
  isPublished: boolean;
  featuredOrder?: number;
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

export interface AdminProfile {
  uid: string;
  email: string;
  displayName?: string;
  role: 'owner' | 'admin';
  authMethods?: string[];
  active: boolean;
  inactivityTimeoutMinutes?: number;
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
  authMode?: 'server-credentials' | 'google-firebase';
  envManaged?: boolean;
}

export interface AdminAuditLogEntry {
  id: string;
  action: string;
  actorUid: string;
  actorEmail?: string;
  status: 'success' | 'failure' | 'warning';
  details: string;
  authMethod?: string;
  timestamp: string;
  source?: 'firestore' | 'security-server';
}

export interface AdminInvite {
  email: string;
  displayName?: string;
  role: 'admin';
  active: boolean;
  invitedByUid?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SecurityDiagnosticStatus {
  checkedAt: string;
  authMode?: 'server-credentials' | 'google-firebase';
  firebaseAuthOk: boolean;
  firebaseAuthSummary: string;
  databaseConnected: boolean;
  databaseSummary: string;
  authorizationOk: boolean;
  authorizationSummary: string;
  warnings: string[];
}
