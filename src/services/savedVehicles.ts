/**
 * Jite Auto Deals — Saved Vehicles / Favourites Service
 * 
 * Clean localStorage persistence with cross-component event sync.
 */

const SAVED_KEY = 'jite_saved_vehicles_ids_v1';
const SAVED_CHANGE_EVENT = 'jite_saved_vehicles_changed';

export function getSavedVehicleIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function isVehicleSaved(id: string): boolean {
  if (!id) return false;
  return getSavedVehicleIds().includes(id);
}

export function toggleSavedVehicle(id: string): boolean {
  if (typeof window === 'undefined' || !id) return false;
  const current = getSavedVehicleIds();
  const exists = current.includes(id);
  let updated: string[];

  if (exists) {
    updated = current.filter((item) => item !== id);
  } else {
    updated = [...current, id];
  }

  try {
    localStorage.setItem(SAVED_KEY, JSON.stringify(updated));
  } catch {}

  // Dispatch custom window event
  window.dispatchEvent(new CustomEvent(SAVED_CHANGE_EVENT, { detail: { savedIds: updated, toggledId: id, isSaved: !exists } }));
  return !exists;
}

export function subscribeToSavedVehicles(callback: (savedIds: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    if (custom.detail?.savedIds) {
      callback(custom.detail.savedIds);
    } else {
      callback(getSavedVehicleIds());
    }
  };

  window.addEventListener(SAVED_CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(SAVED_CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
