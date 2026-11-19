import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

interface RevealProps {
  key?: string | number;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  duration?: number;
}

const PREMIUM_EASE = [0.16, 1, 0.3, 1] as const;

/**
 * Lightweight, compositor-only (transform + opacity) viewport reveal wrapper.
 * Ensures immediate zero-latency fallback under reduced-motion or save-data modes
 * and never blocks initial above-the-fold DOM availability.
 */
export default function Reveal({
  children,
  className = '',
  delay = 0,
  yOffset = 18,
  duration = 0.55,
}: RevealProps) {
  const { reducedMotion, enableCinematicMotion } = useAdaptiveMotion();
  const ref = useRef<HTMLDivElement | null>(null);
  const [hasEntered, setHasEntered] = useState(!enableCinematicMotion);

  useEffect(() => {
    if (!enableCinematicMotion || reducedMotion) {
      setHasEntered(true);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setHasEntered(true);
      return;
    }

    const rect = node.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.96) {
      setHasEntered(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setHasEntered(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -6% 0px', threshold: 0.05 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enableCinematicMotion, reducedMotion]);

  if (reducedMotion || !enableCinematicMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: yOffset }}
      animate={hasEntered ? { opacity: 1, y: 0 } : { opacity: 0, y: yOffset }}
      transition={{ duration, delay, ease: PREMIUM_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}
