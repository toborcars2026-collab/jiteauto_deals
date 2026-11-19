import { useState, useEffect } from 'react';

export interface AdaptiveMotionState {
  /** True when prefers-reduced-motion: reduce is active */
  reducedMotion: boolean;
  /** True when device has save-data, slow network, low core count, or mobile viewport */
  lowPowerMode: boolean;
  /** Safe to enable subtle parallax / entrance choreography */
  enableCinematicMotion: boolean;
  /** Preferred image quality preset for listing views */
  imagePreset: 'thumb' | 'card' | 'detail';
  isMobileViewport: boolean;
}

export function useAdaptiveMotion(): AdaptiveMotionState {
  const [state, setState] = useState<AdaptiveMotionState>(() => evaluateDeviceCapabilities());

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const handleChange = () => setState(evaluateDeviceCapabilities());

    if (motionQuery?.addEventListener) {
      motionQuery.addEventListener('change', handleChange);
    } else if (motionQuery?.addListener) {
      motionQuery.addListener(handleChange);
    }

    window.addEventListener('resize', handleChange, { passive: true });
    const conn = (navigator as any)?.connection;
    if (conn?.addEventListener) {
      conn.addEventListener('change', handleChange);
    }

    return () => {
      if (motionQuery?.removeEventListener) {
        motionQuery.removeEventListener('change', handleChange);
      } else if (motionQuery?.removeListener) {
        motionQuery.removeListener(handleChange);
      }
      window.removeEventListener('resize', handleChange);
      if (conn?.removeEventListener) {
        conn.removeEventListener('change', handleChange);
      }
    };
  }, []);

  return state;
}

function evaluateDeviceCapabilities(): AdaptiveMotionState {
  if (typeof window === 'undefined') {
    return {
      reducedMotion: false,
      lowPowerMode: false,
      enableCinematicMotion: true,
      imagePreset: 'card',
      isMobileViewport: false,
    };
  }

  const reducedMotion = Boolean(
    window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  );
  const isMobileViewport = window.innerWidth < 768;

  const conn = (navigator as any)?.connection;
  const saveData = Boolean(conn?.saveData);
  const effectiveType = typeof conn?.effectiveType === 'string' ? conn.effectiveType : '';
  const slowConnection = effectiveType === 'slow-2g' || effectiveType === '2g';

  const cores = typeof navigator?.hardwareConcurrency === 'number' ? navigator.hardwareConcurrency : 8;
  const deviceMemory = typeof (navigator as any)?.deviceMemory === 'number' ? (navigator as any).deviceMemory : 8;
  const lowHardware = cores <= 2 || deviceMemory <= 2;

  const lowPowerMode = reducedMotion || saveData || slowConnection || lowHardware;

  return {
    reducedMotion,
    lowPowerMode,
    enableCinematicMotion: !reducedMotion && !saveData && !slowConnection,
    imagePreset: saveData || slowConnection ? 'thumb' : 'card',
    isMobileViewport,
  };
}
