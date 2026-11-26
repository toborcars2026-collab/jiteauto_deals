/**
 * Jite Auto Deals — Conversion Funnel & AI Analytics Tracker
 * 
 * Accurately tracks every stage of the customer journey:
 * Visitors -> AI Engaged -> Vehicle Matches Viewed -> Enquiries -> WhatsApp Handoffs -> Sourcing Requests
 */

import { FunnelAnalyticsData } from '../types';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { isSupabaseClientConfigured } from '../lib/supabase';
import { getActiveAdminBearerToken } from './adminAuth';

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

function saveLocalMetrics(metrics: FunnelAnalyticsData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ANALYTICS_KEY, JSON.stringify(metrics));
  } catch {}
}

/**
 * Saves metrics to localStorage and syncs to Firestore when Firebase is the active backend.
 */
function saveFunnelMetrics(metrics: FunnelAnalyticsData): void {
  if (typeof window === 'undefined') return;
  saveLocalMetrics(metrics);

  if (isSupabaseClientConfigured()) {
    return;
  }

  // Sync to Firestore settings/analytics non-blockingly when Firebase is active
  try {
    const docRef = doc(db, 'settings', 'analytics');
    setDoc(docRef, metrics, { merge: true }).catch(() => {});
  } catch {}
}

function postSupabaseAnalyticsEvent(payload: {
  field: string;
  brandKey?: string;
  vehicleViewKey?: string;
  vehicleEnquiryKey?: string;
}): void {
  if (typeof window === 'undefined' || !isSupabaseClientConfigured()) return;
  try {
    fetch('/api/analytics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

/**
 * Increments a specific funnel milestone.
 */
export function trackFunnelEvent(
  event: keyof Omit<
    FunnelAnalyticsData,
    'lastUpdated' | 'updatedAt' | 'topViewedVehicles' | 'topEnquiryVehicles' | 'mostSearchedBrands'
  >
): void {
  const current = getFunnelMetrics();
  (current as any)[event] = (((current as any)[event] as number) || 0) + 1;
  current.lastUpdated = new Date().toISOString();
  saveFunnelMetrics(current);
  postSupabaseAnalyticsEvent({ field: String(event) });
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
  postSupabaseAnalyticsEvent({ field: 'vehiclesViewed', vehicleViewKey: vehicleTitle });
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
  postSupabaseAnalyticsEvent({ field: 'enquiriesStarted', vehicleEnquiryKey: vehicleTitle });
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
  postSupabaseAnalyticsEvent({ field: 'vehicleSearches', brandKey: brand });
}

/**
 * Loads analytics from Supabase (via /api/analytics) or Firestore on admin boot.
 */
export async function syncFunnelFromFirestore(): Promise<FunnelAnalyticsData> {
  if (isSupabaseClientConfigured()) {
    try {
      const token = await getActiveAdminBearerToken();
      if (token) {
        const res = await fetch('/api/analytics', {
          method: 'GET',
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });
        if (res.ok) {
          const payload = await res.json();
          const data = (payload?.analytics || {}) as FunnelAnalyticsData;
          const merged = { ...getFunnelMetrics(), ...data };
          saveLocalMetrics(merged);
          return merged;
        }
      }
    } catch {}
    return getFunnelMetrics();
  }

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
