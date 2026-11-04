import { COUNTDOWN_SECONDS } from '../types';

export const CALL_WINDOW_MS = COUNTDOWN_SECONDS * 1000;

export function getCallRemainingSeconds(calledAt: number | undefined, now: number): number {
  if (calledAt === undefined) return 0;
  return Math.max(0, Math.ceil((calledAt + CALL_WINDOW_MS - now) / 1000));
}
