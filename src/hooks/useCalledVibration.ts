import { useEffect, useRef } from 'react';

const VIBRATE_PATTERN = [500, 300, 500];
const VIBRATE_DURATION_MS = 5 * 60 * 1000;

export function useCalledVibration(isCalled: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supportsVibration = typeof navigator !== 'undefined' && 'vibrate' in navigator;
    if (!supportsVibration) return;

    if (isCalled) {
      navigator.vibrate(VIBRATE_PATTERN);
      intervalRef.current = setInterval(() => {
        navigator.vibrate(VIBRATE_PATTERN);
      }, VIBRATE_PATTERN[0] + VIBRATE_PATTERN[1] + VIBRATE_PATTERN[2]);

      timeoutRef.current = setTimeout(() => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        navigator.vibrate(0);
      }, VIBRATE_DURATION_MS);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
      navigator.vibrate(0);
    };
  }, [isCalled]);
}
