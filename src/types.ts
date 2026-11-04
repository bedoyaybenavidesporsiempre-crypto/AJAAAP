export type Role = 'doctor' | 'patient' | 'admin' | 'secretary';

export interface User {
  cedula: string;
  name: string;
  role: Role;
  sedeName?: string;
  specialty?: string;
}

export type AppointmentStatus =
  | 'scheduled'
  | 'checked-in'
  | 'called'
  | 'in-attendance'
  | 'attended'
  | 'absent'
  | 'rescheduled';

export interface Appointment {
  id: string;
  patientCedula: string;
  patientName: string;
  scheduledTime: string;
  scheduledDate?: string;
  status: AppointmentStatus;
  ticketNumber: number;
  checkInTime?: number;
  calledAt?: number;
  gpsDistance?: number;
  attendanceStartAt?: number;
  attendanceEndAt?: number;
  rescheduleCount: number;
  checkinMethod?: CheckinMethod;
  doctorCedula?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  reason?: string;
}

export type CheckinMethod = 'gps' | 'code';

export interface SedeConfig {
  name: string;
  address: string;
  lat: number;
  lng: number;
  consultationMinutes: number;
  allowSameDayBooking: boolean;
  allowWeekendBooking: boolean;
  checkinMethod: CheckinMethod;
  isActive: boolean;
}

export interface DoctorScheduleEntry {
  id: string;
  doctorCedula: string;
  scheduleDate: string; // YYYY-MM-DD
  startHour: string; // HH:MM
  endHour: string; // HH:MM
}

export interface DisabledTimeSlot {
  doctorCedula: string;
  scheduleDate: string; // YYYY-MM-DD
  slotTime: string; // HH:MM
}

export interface DoctorAvailability {
  doctorCedula: string;
  availableDays: number[];
  startHour: string;
  endHour: string;
  dailyCapacity: number;
}

export interface DoctorDisabledDay {
  doctorCedula: string;
  disabledDate: string; // YYYY-MM-DD
}

export interface DoctorNotification {
  id: string;
  doctorCedula: string;
  appointmentId?: string;
  message: string;
  patientName: string;
  scheduledDate?: string;
  scheduledTime?: string;
  isRead: boolean;
  createdAt: string;
}

export interface Specialty {
  id: string;
  name: string;
}

export interface AppData {
  users: User[];
  appointments: Appointment[];
  sede: SedeConfig;
  nextTicketNumber: number;
  currentCalledId: string | null;
  countdownEndsAt: number | null;
  attendedCount: number;
  totalConsultationMinutes: number;
  doctorAvailability: DoctorAvailability[];
  doctorSchedule: DoctorScheduleEntry[];
  disabledTimeSlots: DisabledTimeSlot[];
  doctorDisabledDays: DoctorDisabledDay[];
  notifications: DoctorNotification[];
  specialties: Specialty[];
}

export const COUNTDOWN_SECONDS = 300;
