import type { Appointment } from '../types';

const QUEUE_STATUSES = new Set<Appointment['status']>(['checked-in', 'rescheduled', 'called', 'in-attendance']);

function timeSortKey(time: string): string {
  return !time || time === '--:--' ? '99:99' : time;
}

function dayOrder(appointments: Appointment[], apt: Appointment): Appointment[] {
  return appointments
    .filter((a) => a.doctorCedula === apt.doctorCedula && a.scheduledDate === apt.scheduledDate)
    .sort(
      (a, b) =>
        timeSortKey(a.scheduledTime).localeCompare(timeSortKey(b.scheduledTime)) ||
        a.ticketNumber - b.ticketNumber,
    );
}

export function getOfficialTurn(apt: Appointment, appointments: Appointment[]): number {
  return dayOrder(appointments, apt).findIndex((a) => a.id === apt.id) + 1;
}

export function getTurnsAhead(apt: Appointment, appointments: Appointment[]): number {
  const ordered = dayOrder(appointments, apt);
  const myIndex = ordered.findIndex((a) => a.id === apt.id);
  return ordered.slice(0, Math.max(myIndex, 0)).filter((a) => QUEUE_STATUSES.has(a.status)).length;
}
