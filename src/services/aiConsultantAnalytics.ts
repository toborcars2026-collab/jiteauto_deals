/**
 * Jite Auto Deals — Conversion Funnel & AI Analytics Tracker
 * 
 * Accurately tracks every stage of the customer journey:
 * Visitors -> AI Engaged -> Vehicle Matches Viewed -> Enquiries -> WhatsApp Handoffs -> Sourcing Requests
 */

import { FunnelAnalyticsData } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';

const ANALYTICS_KEY = 'jite_funnel_analytics_v1';

const DEFAULT_METRICS: FunnelAnalyticsData = {
  visitors: 1,
  aiOpened: 0,
  aiConversations: 0,
  vehicleSearches: 0,
  vehiclesViewed: 0,
  vehicleSaves: 0,
  compareActions: 0,
  enquiriesStarted: 0,
  leadsSubmitted: 0,
  whatsAppClicks: 0,
  interestedClicks: 0,
  callClicks: 0,
  sourcingRequests: 0,
  filterUsage: 0,
  findMyCarSubmissions: 0,
  sourceSubmissions: 0,
  topViewedVehicles: {},
  topEnquiryVehicles: {},
  mostSearchedBrands: {},
  lastUpdated: new Date().toISOString(),
};

/**
 * Retrieves the current local analytics metrics.
 */
export function getFunnelMetrics(): FunnelAnalyticsData {
  if (typeof window === 'undefined') return DEFAULT_METRICS;
  try {
    const raw = localStorage.getItem(ANALYTICS_KEY);
    if (raw) {
      return { ...DEFAULT_METRICS, ...JSON.parse(raw) };
    }
  } catch {}
  return DEFAULT_METRICS;
}

/**
 * Saves metrics to localStorage and periodically syncs to Firestore.
 */
function saveFunnelMetrics(metrics: FunnelAnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(metrics));
  } catch {}

  // Sync to Firestore settings/analytics non-blockingly
  try {
    const docRef = doc(db, 'settings', 'analytics');
    setDoc(docRef, metrics, { merge: true }).catch(() => {});
  } catch {}
}

/**
 * Increments a specific funnel milestone.
 */
export function trackFunnelEvent(event: keyof Omit<FunnelAnalyticsData, 'lastUpdated' | 'updatedAt' | 'topViewedVehicles' | 'topEnquiryVehicles' | 'mostSearchedBrands'>): void {
  const current = getFunnelMetrics();
  (current as any)[event] = (((current as any)[event] as number) || 0) + 1;
  current.lastUpdated = new Date().toISOString();
  saveFunnelMetrics(current);
}

/**
 * Tracks vehicle view count for admin intelligence.
 */
export function trackVehicleViewStats(vehicleTitle: string): void {
  const current = getFunnelMetrics();
  current.vehiclesViewed = (current.vehiclesViewed || 0) + 1;
  if (!current.topViewedVehicles) current.topViewedVehicles = {};
  current.topViewedVehicles[vehicleTitle] = (current.topViewedVehicles[vehicleTitle] || 0) + 1;
  current.lastUpdated = new Date().toISOString();
  saveFunnelMetrics(current);
}

/**
 * Tracks vehicle enquiry count for admin intelligence.
 */
export function trackVehicleEnquiryStats(vehicleTitle: string): void {
  const current = getFunnelMetrics();
  current.enquiriesStarted = (current.enquiriesStarted || 0) + 1;
  current.interestedClicks = (current.interestedClicks || 0) + 1;
  if (!current.topEnquiryVehicles) current.topEnquiryVehicles = {};
  current.topEnquiryVehicles[vehicleTitle] = (current.topEnquiryVehicles[vehicleTitle] || 0) + 1;
  current.lastUpdated = new Date().toISOString();
  saveFunnelMetrics(current);
}

/**
 * Tracks search brands for admin intelligence.
 */
export function trackSearchBrandStats(brand: string): void {
  if (!brand || brand === 'All') return;
  const current = getFunnelMetrics();
  current.vehicleSearches = (current.vehicleSearches || 0) + 1;
  if (!current.mostSearchedBrands) current.mostSearchedBrands = {};
  current.mostSearchedBrands[brand] = (current.mostSearchedBrands[brand] || 0) + 1;
  current.lastUpdated = new Date().toISOString();
  saveFunnelMetrics(current);
}

/**
 * Loads analytics from Firestore on admin boot.
 */
export async function syncFunnelFromFirestore(): Promise<FunnelAnalyticsData> {
  try {
    const docRef = doc(db, 'settings', 'analytics');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as FunnelAnalyticsData;
      const merged = { ...getFunnelMetrics(), ...data };
      saveFunnelMetrics(merged);
      return merged;
    }
  } catch {}
  return getFunnelMetrics();
}
