import { useEffect, useRef, useState } from 'react';

const ALERT_DURATION_MS = 30_000;

export function useCalledTurnAlert(callKey: string | null, turn: number | null): number | null {
  const [visibleTurn, setVisibleTurn] = useState<number | null>(null);
  const lastKeyRef = useRef<string | null | undefined>(undefined);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const previousKey = lastKeyRef.current;
    lastKeyRef.current = callKey;
    if (callKey === null || previousKey === undefined || previousKey === callKey) return;
    setVisibleTurn(turn);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setVisibleTurn(null), ALERT_DURATION_MS);
  }, [callKey, turn]);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  return visibleTurn;
}
