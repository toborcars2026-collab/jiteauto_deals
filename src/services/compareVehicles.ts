/**
 * Jite Auto Deals — Vehicle Comparison Service
 * 
 * Compares up to 3 vehicles side-by-side with cross-component sync.
 */

const COMPARE_KEY = 'jite_compared_vehicles_ids_v1';
const COMPARE_CHANGE_EVENT = 'jite_compared_vehicles_changed';

export function getComparedVehicleIds(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.slice(0, 3);
    }
  } catch {}
  return [];
}

export function isVehicleCompared(id: string): boolean {
  if (!id) return false;
  return getComparedVehicleIds().includes(id);
}

export function toggleComparedVehicle(id: string): { success: boolean; isCompared: boolean; error?: string } {
  if (typeof window === 'undefined' || !id) return { success: false, isCompared: false };
  const current = getComparedVehicleIds();
  const exists = current.includes(id);

  if (exists) {
    const updated = current.filter((item) => item !== id);
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(updated));
    } catch {}
    window.dispatchEvent(new CustomEvent(COMPARE_CHANGE_EVENT, { detail: { comparedIds: updated } }));
    return { success: true, isCompared: false };
  }

  if (current.length >= 3) {
    return { success: false, isCompared: false, error: 'You can compare up to 3 vehicles at a time.' };
  }

  const updated = [...current, id];
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(updated));
  } catch {}
  window.dispatchEvent(new CustomEvent(COMPARE_CHANGE_EVENT, { detail: { comparedIds: updated } }));
  return { success: true, isCompared: true };
}

export function removeComparedVehicle(id: string): void {
  const current = getComparedVehicleIds().filter((item) => item !== id);
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(current));
  } catch {}
  window.dispatchEvent(new CustomEvent(COMPARE_CHANGE_EVENT, { detail: { comparedIds: current } }));
}

export function clearComparedVehicles(): void {
  try {
    localStorage.removeItem(COMPARE_KEY);
  } catch {}
  window.dispatchEvent(new CustomEvent(COMPARE_CHANGE_EVENT, { detail: { comparedIds: [] } }));
}

export function subscribeToComparedVehicles(callback: (comparedIds: string[]) => void): () => void {
  if (typeof window === 'undefined') return () => {};

  const handler = (e: Event) => {
    const custom = e as CustomEvent;
    if (custom.detail?.comparedIds) {
      callback(custom.detail.comparedIds);
    } else {
      callback(getComparedVehicleIds());
    }
  };

  window.addEventListener(COMPARE_CHANGE_EVENT, handler);
  window.addEventListener('storage', handler);

  return () => {
    window.removeEventListener(COMPARE_CHANGE_EVENT, handler);
    window.removeEventListener('storage', handler);
  };
}
