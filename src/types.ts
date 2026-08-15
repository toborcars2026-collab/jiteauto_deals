export interface Vehicle {
  id: string;
  make: string;
  model: string;
  year: number;
  price: number; // in NGN
  mileage: number; // in km
  transmission: 'Automatic' | 'Manual';
  fuelType: 'Petrol' | 'Diesel' | 'Hybrid' | 'Electric';
  bodyType: 'Sedan' | 'SUV' | 'Coupe' | 'Hatchback' | 'Truck' | 'Crossover' | 'Minivan' | 'Luxury SUV' | string;
  location: string;
  dealership: string;
  images: string[];
  description: string;
  engine: string;
  color: string;
  condition: 'Foreign Used' | 'Nigerian Used' | 'Brand New' | 'Direct Belgium' | 'Clean Used' | 'Extremely Clean' | 'Extremely Clean Used' | 'Extremely Clean Nigerian Used' | 'Slightly Used' | 'Like New' | 'Few Months Used' | 'Used' | string;
  isFeatured: boolean;
  status?: 'Active' | 'Sold' | 'Inactive';
}

export interface Lead {
  id: string;
  name: string;
  phone: string;
  vehicleType: string;
  budget: number; // in NGN
  brand: string;
  paymentMethod: 'Cash' | 'Financing';
  createdAt: string;
  status: 'New' | 'Contacted' | 'Closed';
  notes?: string;
}

export interface Inquiry {
  id: string;
  name: string;
  phone: string;
  vehicleId: string;
  vehicleName: string;
  budget: number;
  paymentMethod: 'Cash' | 'Financing';
  readyToBuy: 'Immediately' | 'Within 2 Weeks' | 'Within a Month' | 'Just Researching';
  preferredContact: 'WhatsApp' | 'Call';
  createdAt: string;
  status: 'New' | 'Contacted' | 'Closed';
}
