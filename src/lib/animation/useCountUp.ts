import { useState, useEffect, useRef } from 'react';

interface UseCountUpOptions {
  duration?: number;
  startValue?: number;
}

/**
 * Presentation-only animated number count-up hook.
 * Smoothly interpolates from previous value to target value using easeOutCubic.
 * Respects window.matchMedia('(prefers-reduced-motion: reduce)') by jumping immediately to target.
 * Always settles on the exact integer target to maintain financial precision.
 */
export function useCountUp(
  targetValue: number,
  options: UseCountUpOptions = {}
): number {
  const { duration = 800, startValue = 0 } = options;
  const [displayValue, setDisplayValue] = useState<number>(
    duration === 0 ? targetValue : startValue
  );
  const frameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const fromValueRef = useRef<number>(duration === 0 ? targetValue : startValue);

  useEffect(() => {
    // Check for prefers-reduced-motion
    if (
      typeof window !== 'undefined' && 
      typeof window.matchMedia === 'function' && 
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      // oxlint-disable-next-line react/set-state-in-effect
      setDisplayValue(targetValue);
      return;
    }

    const fromVal = fromValueRef.current;
    if (fromVal === targetValue) {
      // oxlint-disable-next-line react/set-state-in-effect
      setDisplayValue(targetValue);
      return;
    }

    startTimeRef.current = null;

    const animate = (currentTime: number) => {
      if (startTimeRef.current === null) {
        startTimeRef.current = currentTime;
      }

      const elapsed = currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);

      // easeOutCubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(fromVal + (targetValue - fromVal) * ease);

      setDisplayValue(current);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayValue(targetValue);
        fromValueRef.current = targetValue;
      }
    };

    frameRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      fromValueRef.current = targetValue;
    };
  }, [targetValue, duration]);

  return displayValue;
}

