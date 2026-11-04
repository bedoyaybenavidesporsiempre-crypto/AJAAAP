const CUTOFF_HOUR = 18;
const CUTOFF_MINUTE = 30;

export function isPastCutoff(now: Date = new Date()): boolean {
  return now.getHours() * 60 + now.getMinutes() >= CUTOFF_HOUR * 60 + CUTOFF_MINUTE;
}
