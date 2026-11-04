const CUTOFF_HOUR = 17;
const CUTOFF_MINUTE = 0;

export function isPastCutoff(now: Date = new Date()): boolean {
  return now.getHours() * 60 + now.getMinutes() >= CUTOFF_HOUR * 60 + CUTOFF_MINUTE;
}

export function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
