import React, { useEffect, useRef, useState } from 'react';
import { useAdaptiveMotion } from '../hooks/useAdaptiveMotion';

interface RevealProps {
  key?: string | number;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  yOffset?: number;
  duration?: number;
}

/**
 * Lightweight, zero-dependency GPU-composited (transform + opacity) viewport reveal wrapper.
 * Replaces heavy JS motion library in initial homepage bundle while preserving exact easing & reduced-motion behavior.
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
  const [hasEntered, setHasEntered] = useState(!enableCinematicMotion || reducedMotion);

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
    if (rect.top < window.innerHeight * 0.98) {
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
      { rootMargin: '0px 0px -4% 0px', threshold: 0.02 }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [enableCinematicMotion, reducedMotion]);

  if (reducedMotion || !enableCinematicMotion) {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: hasEntered ? 1 : 0,
        transform: hasEntered ? 'translate3d(0, 0, 0)' : `translate3d(0, ${yOffset}px, 0)`,
        transitionProperty: 'opacity, transform',
        transitionDuration: `${Math.round(duration * 1000)}ms`,
        transitionDelay: `${Math.round(delay * 1000)}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {children}
    </div>
  );
}
