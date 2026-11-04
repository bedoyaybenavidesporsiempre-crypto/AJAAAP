import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import type { AppData, User, SedeConfig, Appointment, DoctorAvailability, DoctorScheduleEntry, DisabledTimeSlot, DoctorNotification, Specialty, DoctorDisabledDay } from '@/types';
import { COUNTDOWN_SECONDS } from '@/types';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SEDE } from '@/data/mockData';
import { CALL_WINDOW_MS } from '@/lib/callTimer';

const SESSION_KEY = 'aja-app-session-cedula';

interface ScheduleAppointmentParams {
  patientCedula: string;
  patientName: string;
  scheduledDate: string;
  scheduledTime: string;
  doctorCedula?: string;
  doctorName?: string;
  doctorSpecialty?: string;
  reason?: string;
}

interface AppContextValue {
  data: AppData;
  currentUser: User | null;
  loading: boolean;
  login: (cedula: string) => Promise<User | null>;
  logout: () => void;
  checkIn: (cedula: string, name: string, gpsDistance: number, method?: 'gps' | 'code') => Promise<Appointment | null>;
  getMyAppointment: (cedula: string) => Appointment | undefined;
  getMyScheduledAppointments: (cedula: string) => Appointment[];
  getQueuePosition: (cedula: string) => number;
  getEstimatedWait: (cedula: string) => number;
  callNext: () => Promise<void>;
  markPresent: (calledId: string) => Promise<void>;
  markAbsentAndReschedule: (calledId: string) => Promise<void>;
  updateSede: (sede: Partial<SedeConfig>) => Promise<void>;
  setSameDayBooking: (enabled: boolean) => Promise<void>;
  setWeekendBooking: (enabled: boolean) => Promise<void>;
  setCheckinMethod: (method: 'gps' | 'code') => Promise<void>;
  setCheckinActive: (active: boolean) => Promise<void>;
  addUser: (user: User) => Promise<void>;
  removeUser: (cedula: string) => Promise<boolean>;
  scheduleAppointment: (params: ScheduleAppointmentParams) => Promise<{ appointment: Appointment | null; error: string | null }>;
  saveAvailability: (avail: DoctorAvailability) => Promise<void>;
  getDoctorAvailability: (doctorCedula: string) => DoctorAvailability | null;
  saveDoctorSchedule: (entries: DoctorScheduleEntry[]) => Promise<void>;
  toggleScheduleDay: (doctorCedula: string, date: string) => Promise<void>;
  ensureWeekdaysScheduled: (doctorCedula: string, monthsAhead?: number, includeToday?: boolean, includeWeekend?: boolean) => Promise<void>;
  getDoctorSchedule: (doctorCedula: string) => DoctorScheduleEntry[];
  getDoctorDisabledDays: (doctorCedula: string) => string[];
  toggleTimeSlot: (doctorCedula: string, date: string, slotTime: string) => Promise<void>;
  getDisabledTimeSlots: (doctorCedula: string, date: string) => string[];
  updateDoctorSpecialty: (cedula: string, specialty: string) => Promise<void>;
  getNotifications: (doctorCedula: string) => DoctorNotification[];
  getUnreadNotificationCount: (doctorCedula: string) => number;
  markNotificationsRead: (doctorCedula: string) => Promise<void>;
  getSpecialties: () => Specialty[];
  addSpecialty: (name: string) => Promise<Specialty | null>;
  updateSpecialty: (id: string, name: string) => Promise<Specialty | null>;
  resetAll: () => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

interface DbUser {
  cedula: string;
  name: string;
  role: string;
  sede_name: string | null;
  specialty: string | null;
}

interface DbAppointment {
  id: string;
  patient_cedula: string;
  patient_name: string;
  scheduled_time: string;
  scheduled_date: string | null;
  status: string;
  ticket_number: number;
  check_in_time: number | null;
  called_at: number | null;
  gps_distance: number | null;
  attendance_start_at: number | null;
  attendance_end_at: number | null;
  reschedule_count: number;
  checkin_method: string;
  reason: string | null;
  doctor_id: string | null;
  doctor_name: string | null;
  doctor_specialty: string | null;
}

interface DbSedeConfig {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  consultation_minutes: number;
  same_day_booking: boolean;
  allow_weekend_booking: boolean;
  checkin_method: string;
  is_active: boolean;
}

interface DbDoctorAvailability {
  doctor_cedula: string;
  available_days: number[];
  start_hour: string;
  end_hour: string;
  daily_capacity: number;
}

interface DbDoctorSchedule {
  id: string;
  doctor_cedula: string;
  schedule_date: string;
  start_hour: string;
  end_hour: string;
}

interface DbDisabledTimeSlot {
  doctor_cedula: string;
  schedule_date: string;
  slot_time: string;
}

interface DbDoctorDisabledDay {
  doctor_cedula: string;
  disabled_date: string;
}

interface DbNotification {
  id: string;
  doctor_cedula: string;
  appointment_id: string | null;
  message: string;
  patient_name: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  is_read: boolean;
  created_at: string;
}

interface DbSpecialty {
  id: string;
  name: string;
}

interface DbQueueState {
  id: number;
  next_ticket_number: number;
  current_called_id: string | null;
  countdown_ends_at: number | null;
  attended_count: number;
  total_consultation_minutes: number;
}

function isWeekendDate(dateStr: string): boolean {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dow = new Date(y, m - 1, d).getDay();
  return dow === 0 || dow === 6;
}

function mapUser(u: DbUser): User {
  return {
    cedula: u.cedula,
    name: u.name,
    role: u.role as User['role'],
    sedeName: u.sede_name ?? undefined,
    specialty: u.specialty ?? undefined,
  };
}

function mapAppointment(a: DbAppointment): Appointment {
  return {
    id: a.id,
    patientCedula: a.patient_cedula,
    patientName: a.patient_name,
    scheduledTime: a.scheduled_time,
    scheduledDate: a.scheduled_date ?? undefined,
    status: a.status as Appointment['status'],
    ticketNumber: a.ticket_number,
    checkInTime: a.check_in_time ?? undefined,
    calledAt: a.called_at ?? undefined,
    gpsDistance: a.gps_distance ?? undefined,
    attendanceStartAt: a.attendance_start_at ?? undefined,
    attendanceEndAt: a.attendance_end_at ?? undefined,
    rescheduleCount: a.reschedule_count,
    checkinMethod: (a.checkin_method === 'code' ? 'code' : 'gps'),
    reason: a.reason ?? undefined,
    doctorCedula: a.doctor_id ?? undefined,
    doctorName: a.doctor_name ?? undefined,
    doctorSpecialty: a.doctor_specialty ?? undefined,
  };
}

function mapSchedule(s: DbDoctorSchedule): DoctorScheduleEntry {
  return {
    id: s.id,
    doctorCedula: s.doctor_cedula,
    scheduleDate: s.schedule_date,
    startHour: s.start_hour,
    endHour: s.end_hour,
  };
}

const DEFAULT_DATA: AppData = {
  users: [],
  appointments: [],
  sede: { ...DEFAULT_SEDE },
  nextTicketNumber: 1,
  currentCalledId: null,
  countdownEndsAt: null,
  attendedCount: 0,
  totalConsultationMinutes: 0,
  doctorAvailability: [],
  doctorSchedule: [],
  disabledTimeSlots: [],
  doctorDisabledDays: [],
  notifications: [],
  specialties: [],
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData>(DEFAULT_DATA);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const currentUserRef = useRef<User | null>(null);
  currentUserRef.current = currentUser;

  // Load all data from Supabase, filtered by doctor when the logged-in user is a doctor
  const loadData = async () => {
    const activeUser = currentUserRef.current;
    const isDoctor = activeUser?.role === 'doctor';
    const doctorCedula = isDoctor ? activeUser!.cedula : null;

    let apptsQuery = supabase.from('appointments').select('*');
    if (doctorCedula) {
      apptsQuery = apptsQuery.eq('doctor_id', doctorCedula);
    }

    let availQuery = supabase.from('doctor_availability').select('*');
    if (doctorCedula) {
      availQuery = availQuery.eq('doctor_cedula', doctorCedula);
    }

    let schedQuery = supabase.from('doctor_schedule').select('*');
    if (doctorCedula) {
      schedQuery = schedQuery.eq('doctor_cedula', doctorCedula);
    }

    let disabledQuery = supabase.from('disabled_time_slots').select('*');
    if (doctorCedula) {
      disabledQuery = disabledQuery.eq('doctor_cedula', doctorCedula);
    }

    let disabledDaysQuery = supabase.from('doctor_disabled_days').select('*');
    if (doctorCedula) {
      disabledDaysQuery = disabledDaysQuery.eq('doctor_cedula', doctorCedula);
    }

    let notifQuery = supabase.from('notifications').select('*');
    if (doctorCedula) {
      notifQuery = notifQuery.eq('doctor_cedula', doctorCedula);
    }

    const [usersRes, apptsRes, sedeRes, queueRes, availRes, schedRes, disabledRes, disabledDaysRes, notifRes, specRes] = await Promise.all([
      supabase.from('users').select('*'),
      apptsQuery,
      supabase.from('sede_config').select('*').eq('id', 1).maybeSingle(),
      supabase.from('queue_state').select('*').eq('id', 1).maybeSingle(),
      availQuery,
      schedQuery,
      disabledQuery,
      disabledDaysQuery,
      notifQuery,
      supabase.from('specialties').select('*'),
    ]);

    if (disabledDaysRes.error) throw disabledDaysRes.error;

    if (availRes.error) throw availRes.error;
    if (usersRes.error) throw usersRes.error;
    if (apptsRes.error) throw apptsRes.error;
    if (schedRes.error) throw schedRes.error;
    if (disabledRes.error) throw disabledRes.error;
    if (notifRes.error) throw notifRes.error;
    if (specRes.error) throw specRes.error;

    const users = (usersRes.data as DbUser[] ?? []).map(mapUser);
    const appointments = (apptsRes.data as DbAppointment[] ?? []).map(mapAppointment);

    let sede: SedeConfig = { ...DEFAULT_SEDE };
    if (sedeRes.data) {
      const s = sedeRes.data as DbSedeConfig;
      sede = {
        name: s.name,
        address: s.address,
        lat: s.lat,
        lng: s.lng,
        consultationMinutes: s.consultation_minutes,
        allowSameDayBooking: s.same_day_booking,
        allowWeekendBooking: s.allow_weekend_booking,
        checkinMethod: (s.checkin_method === 'code' ? 'code' : 'gps'),
        isActive: s.is_active !== false,
      };
    }

    let queueState = { nextTicketNumber: 1, currentCalledId: null as string | null, countdownEndsAt: null as number | null, attendedCount: 0, totalConsultationMinutes: 0 };
    if (queueRes.data) {
      const q = queueRes.data as DbQueueState;
      queueState = {
        nextTicketNumber: q.next_ticket_number,
        currentCalledId: q.current_called_id,
        countdownEndsAt: q.countdown_ends_at,
        attendedCount: q.attended_count,
        totalConsultationMinutes: q.total_consultation_minutes,
      };
    }

    const doctorAvailability: DoctorAvailability[] = (availRes.data as DbDoctorAvailability[] ?? []).map((a) => ({
      doctorCedula: a.doctor_cedula,
      availableDays: a.available_days ?? [],
      startHour: a.start_hour,
      endHour: a.end_hour,
      dailyCapacity: a.daily_capacity,
    }));

    const doctorSchedule: DoctorScheduleEntry[] = (schedRes.data as DbDoctorSchedule[] ?? []).map(mapSchedule);

    const disabledTimeSlots: DisabledTimeSlot[] = (disabledRes.data as DbDisabledTimeSlot[] ?? []).map((d) => ({
      doctorCedula: d.doctor_cedula,
      scheduleDate: d.schedule_date,
      slotTime: d.slot_time,
    }));

    const doctorDisabledDays: DoctorDisabledDay[] = (disabledDaysRes.data as DbDoctorDisabledDay[] ?? []).map((d) => ({
      doctorCedula: d.doctor_cedula,
      disabledDate: d.disabled_date,
    }));

    const notifications: DoctorNotification[] = (notifRes.data as DbNotification[] ?? []).map((n) => ({
      id: n.id,
      doctorCedula: n.doctor_cedula,
      appointmentId: n.appointment_id ?? undefined,
      message: n.message,
      patientName: n.patient_name,
      scheduledDate: n.scheduled_date ?? undefined,
      scheduledTime: n.scheduled_time ?? undefined,
      isRead: n.is_read,
      createdAt: n.created_at,
    })).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

    const specialties: Specialty[] = (specRes.data as DbSpecialty[] ?? []).map((s) => ({
      id: s.id,
      name: s.name,
    }));

    // Enrich appointments: if doctor_id is set but doctor_name is missing,
    // join with users to fill in the doctor's name and specialty
    const doctorMap = new Map(users.filter((u) => u.role === 'doctor').map((u) => [u.cedula, u]));
    const enrichedAppointments = appointments.map((a) => {
      if (a.doctorCedula && (!a.doctorName || !a.doctorSpecialty)) {
        const doc = doctorMap.get(a.doctorCedula);
        if (doc) {
          return {
            ...a,
            doctorName: a.doctorName || doc.name,
            doctorSpecialty: a.doctorSpecialty || doc.specialty,
          };
        }
      }
      return a;
    });

    setData({ users, appointments: enrichedAppointments, sede, ...queueState, doctorAvailability, doctorSchedule, disabledTimeSlots, doctorDisabledDays, notifications, specialties });
  };

  // Initial load + restore session
  useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      timeoutId = setTimeout(() => {
        console.warn('Initial load timed out, showing app with default data');
        setLoading(false);
      }, 10000);

      try {
        await loadData();
        const savedCedula = localStorage.getItem(SESSION_KEY);
        if (savedCedula) {
          const { data: userRow } = await supabase
            .from('users')
            .select('*')
            .eq('cedula', savedCedula)
            .maybeSingle();
          if (userRow) setCurrentUser(mapUser(userRow as DbUser));
        }
      } catch (err) {
        console.error('Failed to load initial data:', err);
      } finally {
        if (timeoutId) clearTimeout(timeoutId);
        setLoading(false);
      }
    })();

    return () => { if (timeoutId) clearTimeout(timeoutId); };
  }, []);

  // Poll for updates every 2 seconds (real-time sync across users)
  useEffect(() => {
    if (loading) return;
    const safeLoad = () => { loadData().catch((err) => console.error('Poll load error:', err)); };
    pollRef.current = setInterval(safeLoad, 2000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loading]);

  const expiringCallIdsRef = useRef(new Set<string>());

  useEffect(() => {
    if (currentUser?.role !== 'doctor') return;
    const doctorCedula = currentUser.cedula;
    const now = Date.now();
    data.appointments
      .filter(
        (a) =>
          a.status === 'called' &&
          a.doctorCedula === doctorCedula &&
          a.calledAt !== undefined &&
          a.calledAt + CALL_WINDOW_MS <= now,
      )
      .forEach((a) => {
        if (expiringCallIdsRef.current.has(a.id)) return;
        expiringCallIdsRef.current.add(a.id);
        expireCall(doctorCedula, a.id)
          .catch((err) => console.error('Expire call failed:', err))
          .finally(() => expiringCallIdsRef.current.delete(a.id));
      });
  }, [data.appointments, currentUser]);

  const expireCall = async (doctorCedula: string, calledId: string) => {
    const { data: appts, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('doctor_id', doctorCedula);
    if (error) throw error;
    const all = (appts as DbAppointment[] ?? []);

    const called = all.find((a) => a.id === calledId);
    if (!called || called.status !== 'called') return;

    const next = all
      .filter((a) => a.status === 'checked-in' || a.status === 'rescheduled')
      .sort((a, b) => a.ticket_number - b.ticket_number)[0];
    const newTicket = next
      ? next.ticket_number
      : Math.max(...all.map((a) => a.ticket_number)) + 1;

    await supabase
      .from('appointments')
      .update({
        status: 'rescheduled',
        reschedule_count: called.reschedule_count + 1,
        ticket_number: newTicket,
      })
      .eq('id', calledId)
      .eq('status', 'called');

    if (next) {
      await supabase
        .from('appointments')
        .update({ ticket_number: called.ticket_number })
        .eq('id', next.id);
    }

    await supabase
      .from('queue_state')
      .update({ current_called_id: null, countdown_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .eq('current_called_id', calledId);

    await loadData();
  };

  const login = async (cedula: string): Promise<User | null> => {
    const { data: userRow, error } = await supabase
      .from('users')
      .select('*')
      .eq('cedula', cedula.trim())
      .maybeSingle();
    if (error || !userRow) return null;
    const user = mapUser(userRow as DbUser);
    setCurrentUser(user);
    localStorage.setItem(SESSION_KEY, user.cedula);
    return user;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
  };

  const checkIn = async (cedula: string, name: string, gpsDistance: number, method: 'gps' | 'code' = 'gps'): Promise<Appointment | null> => {
    const { data: existing } = await supabase
      .from('appointments')
      .select('*')
      .eq('patient_cedula', cedula)
      .in('status', ['checked-in', 'scheduled', 'rescheduled']);

    const existingAppts = (existing as DbAppointment[] ?? []);
    if (existingAppts.length > 0) {
      const ex = existingAppts[0];
      const { data: updated, error } = await supabase
        .from('appointments')
        .update({
          status: 'checked-in',
          check_in_time: Date.now(),
          gps_distance: gpsDistance,
          checkin_method: method,
        })
        .eq('id', ex.id)
        .select('*')
        .maybeSingle();
      if (error || !updated) return null;
      await loadData();
      return mapAppointment(updated as DbAppointment);
    }

    const { data: queueRow } = await supabase
      .from('queue_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    const ticketNumber = (queueRow as DbQueueState | null)?.next_ticket_number ?? 1;

    const { data: newApt, error } = await supabase
      .from('appointments')
      .insert({
        patient_cedula: cedula,
        patient_name: name,
        scheduled_time: '--:--',
        status: 'checked-in',
        ticket_number: ticketNumber,
        check_in_time: Date.now(),
        gps_distance: gpsDistance,
        checkin_method: method,
        reschedule_count: 0,
      })
      .select('*')
      .maybeSingle();
    if (error || !newApt) return null;

    await supabase
      .from('queue_state')
      .update({ next_ticket_number: ticketNumber + 1, updated_at: new Date().toISOString() })
      .eq('id', 1);

    await loadData();
    return mapAppointment(newApt as DbAppointment);
  };

  const getMyAppointment = (cedula: string) =>
    data.appointments.find(
      (a) =>
        a.patientCedula === cedula &&
        a.status !== 'attended' &&
        a.status !== 'absent',
    );

  const getMyScheduledAppointments = (cedula: string): Appointment[] =>
    data.appointments
      .filter(
        (a) =>
          a.patientCedula === cedula &&
          (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
      )
      .sort((a, b) => {
        const da = a.scheduledDate || '';
        const db = b.scheduledDate || '';
        if (da !== db) return da.localeCompare(db);
        return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
      });

  const getQueuePosition = (cedula: string): number => {
    const waiting = data.appointments
      .filter((a) => a.status === 'checked-in' || a.status === 'rescheduled')
      .sort((a, b) => a.ticketNumber - b.ticketNumber);
    return waiting.findIndex((a) => a.patientCedula === cedula);
  };

  const getEstimatedWait = (cedula: string): number => {
    const pos = getQueuePosition(cedula);
    if (pos <= 0) return 5;
    return pos * data.sede.consultationMinutes;
  };

  const callNext = async () => {
    const activeUser = currentUserRef.current;
    const isDoctor = activeUser?.role === 'doctor';
    const doctorCedula = isDoctor ? activeUser!.cedula : null;

    let query = supabase.from('appointments').select('*');
    if (doctorCedula) {
      query = query.eq('doctor_id', doctorCedula);
    }
    const { data: appts } = await query;
    const all = (appts as DbAppointment[] ?? []);
    const waiting = all
      .filter((a) => a.status === 'checked-in' || a.status === 'rescheduled')
      .sort((a, b) => a.ticket_number - b.ticket_number);
    const next = waiting[0];
    if (!next) return;

    const now = Date.now();
    let attendedCount = 0;
    let totalConsultationMinutes = 0;

    const { data: queueRow } = await supabase
      .from('queue_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();
    const qs = queueRow as DbQueueState | null;
    attendedCount = qs?.attended_count ?? 0;
    totalConsultationMinutes = qs?.total_consultation_minutes ?? 0;

    const currentInAttendance = all.find((a) => a.status === 'in-attendance');
    if (currentInAttendance) {
      const durationMin = Math.round(
        (now - (currentInAttendance.attendance_start_at ?? now)) / 60000,
      );
      totalConsultationMinutes += durationMin;
      attendedCount += 1;
      await supabase
        .from('appointments')
        .update({ status: 'attended', attendance_end_at: now })
        .eq('id', currentInAttendance.id);
    }

    await supabase
      .from('appointments')
      .update({ status: 'called', called_at: now })
      .eq('id', next.id);

    await supabase
      .from('queue_state')
      .update({
        current_called_id: next.id,
        countdown_ends_at: now + COUNTDOWN_SECONDS * 1000,
        attended_count: attendedCount,
        total_consultation_minutes: totalConsultationMinutes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);

    await loadData();
  };

  const markPresent = async (calledId: string) => {
    await supabase
      .from('appointments')
      .update({ status: 'in-attendance', attendance_start_at: Date.now() })
      .eq('id', calledId);

    await supabase
      .from('queue_state')
      .update({ current_called_id: null, countdown_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .eq('current_called_id', calledId);

    await loadData();
  };

  const markAbsentAndReschedule = async (calledId: string) => {
    const activeUser = currentUserRef.current;
    const isDoctor = activeUser?.role === 'doctor';
    const doctorCedula = isDoctor ? activeUser!.cedula : null;

    let query = supabase.from('appointments').select('*');
    if (doctorCedula) {
      query = query.eq('doctor_id', doctorCedula);
    }
    const { data: appts } = await query;
    const all = (appts as DbAppointment[] ?? []);
    const waitingApts = all
      .filter((a) => a.status === 'checked-in' || a.status === 'rescheduled')
      .sort((a, b) => a.ticket_number - b.ticket_number);
    const lastTicket = waitingApts.length > 0
      ? Math.max(...waitingApts.map((a) => a.ticket_number))
      : Math.max(...all.map((a) => a.ticket_number), 0);

    const called = all.find((a) => a.id === calledId);
    if (!called) return;

    await supabase
      .from('appointments')
      .update({
        status: 'rescheduled',
        reschedule_count: called.reschedule_count + 1,
        ticket_number: lastTicket + 1,
      })
      .eq('id', calledId);

    await supabase
      .from('queue_state')
      .update({ current_called_id: null, countdown_ends_at: null, updated_at: new Date().toISOString() })
      .eq('id', 1)
      .eq('current_called_id', calledId);

    await loadData();
  };

  const updateSede = async (sede: Partial<SedeConfig>) => {
    const update: Record<string, number | string | boolean> = {};
    if (sede.name !== undefined) update.name = sede.name;
    if (sede.address !== undefined) update.address = sede.address;
    if (sede.lat !== undefined) update.lat = sede.lat;
    if (sede.lng !== undefined) update.lng = sede.lng;
    if (sede.consultationMinutes !== undefined) update.consultation_minutes = sede.consultationMinutes;
    if (sede.allowSameDayBooking !== undefined) update.same_day_booking = sede.allowSameDayBooking;
    if (sede.allowWeekendBooking !== undefined) update.allow_weekend_booking = sede.allowWeekendBooking;
    if (sede.checkinMethod !== undefined) update.checkin_method = sede.checkinMethod;
    if (sede.isActive !== undefined) update.is_active = sede.isActive;
    update.updated_at = new Date().toISOString();

    const { error } = await supabase.from('sede_config').update(update).eq('id', 1);
    if (error) throw error;
    await loadData();
  };

  const setSameDayBooking = async (enabled: boolean) => {
    await updateSede({ allowSameDayBooking: enabled });
    if (!enabled) return;
    const doctors = data.users.filter((u) => u.role === 'doctor');
    for (const doctor of doctors) {
      await ensureWeekdaysScheduled(doctor.cedula, 6, true);
    }
  };

  const setWeekendBooking = async (enabled: boolean) => {
    await updateSede({ allowWeekendBooking: enabled });
    if (!enabled) return;
    const doctors = data.users.filter((u) => u.role === 'doctor');
    for (const doctor of doctors) {
      await ensureWeekdaysScheduled(doctor.cedula, 6, true, true);
    }
  };

  const setCheckinMethod = async (method: 'gps' | 'code') => {
    await updateSede({ checkinMethod: method });
  };

  const setCheckinActive = async (active: boolean) => {
    await updateSede({ isActive: active });
  };

  const addUser = async (user: User) => {
    const { data: existing } = await supabase
      .from('users')
      .select('cedula')
      .eq('cedula', user.cedula)
      .maybeSingle();
    if (existing) return;

    await supabase.from('users').insert({
      cedula: user.cedula,
      name: user.name,
      role: user.role,
      sede_name: user.sedeName ?? null,
      specialty: user.specialty ?? null,
    });

    if (user.role === 'doctor') {
      await supabase.from('doctor_availability').insert({
        doctor_cedula: user.cedula,
        available_days: [],
        start_hour: '08:00',
        end_hour: '12:00',
        daily_capacity: 10,
      }).then(() => {});
    }

    await loadData();
  };

  const removeUser = async (cedula: string): Promise<boolean> => {
    if (!currentUser || currentUser.role !== 'admin') return false;
    const { error } = await supabase.rpc('delete_user_as_admin', {
      p_cedula: cedula,
      p_admin_cedula: currentUser.cedula,
    });
    if (error) {
      console.error('Delete user failed:', error.message);
      return false;
    }
    await loadData();
    return true;
  };

  const scheduleAppointment = async (
    params: ScheduleAppointmentParams,
  ): Promise<{ appointment: Appointment | null; error: string | null }> => {
    const { patientCedula, patientName, scheduledDate, scheduledTime, doctorCedula, doctorName, doctorSpecialty, reason } = params;

    if (!patientCedula || !patientName || !scheduledDate || !scheduledTime) {
      return { appointment: null, error: 'Faltan datos obligatorios: paciente, fecha u hora.' };
    }
    if (!doctorCedula) {
      return { appointment: null, error: 'No se ha seleccionado un médico. Selecciona un doctor antes de agendar.' };
    }

    const { data: queueRow, error: queueErr } = await supabase
      .from('queue_state')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (queueErr) {
      return { appointment: null, error: `Error al obtener el estado de la fila: ${queueErr.message}` };
    }

    const ticketNumber = (queueRow as DbQueueState | null)?.next_ticket_number ?? 1;

    const { data: newApt, error: insertErr } = await supabase
      .from('appointments')
      .insert({
        patient_cedula: patientCedula,
        patient_name: patientName,
        scheduled_time: scheduledTime,
        scheduled_date: scheduledDate,
        status: 'scheduled',
        ticket_number: ticketNumber,
        reschedule_count: 0,
        reason: reason || null,
        doctor_id: doctorCedula,
        doctor_name: doctorName || null,
        doctor_specialty: doctorSpecialty || null,
      })
      .select('*')
      .maybeSingle();

    if (insertErr) {
      console.error('scheduleAppointment insert error:', insertErr.message);
      return { appointment: null, error: `Error al guardar la cita: ${insertErr.message}` };
    }
    if (!newApt) {
      return { appointment: null, error: 'No se pudo crear la cita. La base de datos no devolvió un registro.' };
    }

    const { error: updateErr } = await supabase
      .from('queue_state')
      .update({ next_ticket_number: ticketNumber + 1, updated_at: new Date().toISOString() })
      .eq('id', 1);

    if (updateErr) {
      console.error('queue_state update error:', updateErr.message);
    }

    const dateDisplay = scheduledDate;
    const message = `Nueva cita agendada: ${patientName} - ${dateDisplay} ${scheduledTime}`;
    await supabase.from('notifications').insert({
      doctor_cedula: doctorCedula,
      appointment_id: (newApt as DbAppointment).id,
      message,
      patient_name: patientName,
      scheduled_date: scheduledDate,
      scheduled_time: scheduledTime,
      is_read: false,
    });

    await loadData();

    const mapped = mapAppointment(newApt as DbAppointment);
    return {
      appointment: {
        ...mapped,
        doctorCedula,
        doctorName,
        doctorSpecialty,
      },
      error: null,
    };
  };

  const saveAvailability = async (avail: DoctorAvailability) => {
    const { data: existing } = await supabase
      .from('doctor_availability')
      .select('doctor_cedula')
      .eq('doctor_cedula', avail.doctorCedula)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('doctor_availability')
        .update({
          available_days: avail.availableDays,
          start_hour: avail.startHour,
          end_hour: avail.endHour,
          daily_capacity: avail.dailyCapacity,
          updated_at: new Date().toISOString(),
        })
        .eq('doctor_cedula', avail.doctorCedula);
    } else {
      await supabase.from('doctor_availability').insert({
        doctor_cedula: avail.doctorCedula,
        available_days: avail.availableDays,
        start_hour: avail.startHour,
        end_hour: avail.endHour,
        daily_capacity: avail.dailyCapacity,
      });
    }
    await loadData();
  };

  const getDoctorAvailability = (doctorCedula: string): DoctorAvailability | null => {
    return data.doctorAvailability.find((a) => a.doctorCedula === doctorCedula) ?? null;
  };

  // ============================================================
  // Doctor per-day schedule management
  // ============================================================

  const saveDoctorSchedule = async (entries: DoctorScheduleEntry[]) => {
    // Delete all existing entries for this doctor, then insert the new set
    if (entries.length === 0) return;
    const doctorCedula = entries[0].doctorCedula;

    await supabase.from('doctor_schedule').delete().eq('doctor_cedula', doctorCedula);

    if (entries.length > 0) {
      await supabase.from('doctor_schedule').insert(
        entries.map((e) => ({
          doctor_cedula: e.doctorCedula,
          schedule_date: e.scheduleDate,
          start_hour: e.startHour,
          end_hour: e.endHour,
        })),
      );
    }
    await loadData();
  };

  const toggleScheduleDay = async (doctorCedula: string, date: string) => {
    const { data: existing } = await supabase
      .from('doctor_schedule')
      .select('*')
      .eq('doctor_cedula', doctorCedula)
      .eq('schedule_date', date)
      .maybeSingle();

    if (existing) {
      // Deselecting a day: remove schedule and mark it as disabled
      await supabase
        .from('doctor_schedule')
        .delete()
        .eq('doctor_cedula', doctorCedula)
        .eq('schedule_date', date);
      const { data: alreadyDisabled } = await supabase
        .from('doctor_disabled_days')
        .select('doctor_cedula')
        .eq('doctor_cedula', doctorCedula)
        .eq('disabled_date', date)
        .maybeSingle();
      if (!alreadyDisabled) {
        await supabase.from('doctor_disabled_days').insert({
          doctor_cedula: doctorCedula,
          disabled_date: date,
        });
      }
    } else {
      // Re-selecting a disabled day: re-enable schedule and clear the disabled mark
      await supabase.from('doctor_schedule').insert({
        doctor_cedula: doctorCedula,
        schedule_date: date,
        start_hour: '08:00',
        end_hour: '17:00',
      });
      await supabase
        .from('doctor_disabled_days')
        .delete()
        .eq('doctor_cedula', doctorCedula)
        .eq('disabled_date', date);
    }
    await loadData();
  };

  // Auto-seed every weekday (Mon-Fri) for the next `monthsAhead` months as
  // available, skipping days the doctor has explicitly disabled. Idempotent.
  const ensureWeekdaysScheduled = async (
    doctorCedula: string,
    monthsAhead = 6,
    includeToday = false,
    includeWeekend = data.sede.allowWeekendBooking,
  ) => {
    const { data: existingSched } = await supabase
      .from('doctor_schedule')
      .select('schedule_date')
      .eq('doctor_cedula', doctorCedula);
    const scheduledSet = new Set((existingSched as { schedule_date: string }[] ?? []).map((s) => s.schedule_date));

    const { data: disabledRows } = await supabase
      .from('doctor_disabled_days')
      .select('disabled_date')
      .eq('doctor_cedula', doctorCedula);
    const disabledSet = new Set((disabledRows as { disabled_date: string }[] ?? []).map((d) => d.disabled_date));

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const end = new Date(today.getFullYear(), today.getMonth() + monthsAhead, today.getDate());

    const toInsert: { doctor_cedula: string; schedule_date: string; start_hour: string; end_hour: string }[] = [];
    const cursor = new Date(today);
    if (!includeToday) cursor.setDate(cursor.getDate() + 1);
    while (cursor <= end) {
      const dow = cursor.getDay();
      if ((dow >= 1 && dow <= 5) || (includeWeekend && (dow === 0 || dow === 6))) {
        const dateStr = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(cursor.getDate()).padStart(2, '0')}`;
        if (!scheduledSet.has(dateStr) && !disabledSet.has(dateStr)) {
          toInsert.push({ doctor_cedula: doctorCedula, schedule_date: dateStr, start_hour: '08:00', end_hour: '17:00' });
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    if (toInsert.length > 0) {
      await supabase.from('doctor_schedule').insert(toInsert);
      await loadData();
    }
  };

  const getDoctorSchedule = (doctorCedula: string): DoctorScheduleEntry[] => {
    return data.doctorSchedule.filter(
      (s) => s.doctorCedula === doctorCedula && (data.sede.allowWeekendBooking || !isWeekendDate(s.scheduleDate)),
    );
  };

  const getDoctorDisabledDays = (doctorCedula: string): string[] => {
    return data.doctorDisabledDays
      .filter((d) => d.doctorCedula === doctorCedula)
      .map((d) => d.disabledDate);
  };

  const toggleTimeSlot = async (doctorCedula: string, date: string, slotTime: string) => {
    const { data: existing } = await supabase
      .from('disabled_time_slots')
      .select('id')
      .eq('doctor_cedula', doctorCedula)
      .eq('schedule_date', date)
      .eq('slot_time', slotTime)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('disabled_time_slots')
        .delete()
        .eq('doctor_cedula', doctorCedula)
        .eq('schedule_date', date)
        .eq('slot_time', slotTime);
    } else {
      await supabase.from('disabled_time_slots').insert({
        doctor_cedula: doctorCedula,
        schedule_date: date,
        slot_time: slotTime,
      });
    }
    await loadData();
  };

  const getDisabledTimeSlots = (doctorCedula: string, date: string): string[] => {
    return data.disabledTimeSlots
      .filter((s) => s.doctorCedula === doctorCedula && s.scheduleDate === date)
      .map((s) => s.slotTime);
  };

  const updateDoctorSpecialty = async (cedula: string, specialty: string) => {
    await supabase
      .from('users')
      .update({ specialty })
      .eq('cedula', cedula);
    await loadData();
  };

  const getNotifications = (doctorCedula: string): DoctorNotification[] => {
    return data.notifications.filter((n) => n.doctorCedula === doctorCedula);
  };

  const getUnreadNotificationCount = (doctorCedula: string): number => {
    return data.notifications.filter((n) => n.doctorCedula === doctorCedula && !n.isRead).length;
  };

  const markNotificationsRead = async (doctorCedula: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('doctor_cedula', doctorCedula)
      .eq('is_read', false);
    await loadData();
  };

  const getSpecialties = (): Specialty[] => {
    return data.specialties;
  };

  const addSpecialty = async (name: string): Promise<Specialty | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { data: existing } = await supabase
      .from('specialties')
      .select('*')
      .eq('name', trimmed)
      .maybeSingle();
    if (existing) {
      await loadData();
      return { id: (existing as DbSpecialty).id, name: (existing as DbSpecialty).name };
    }
    const { data: inserted, error } = await supabase
      .from('specialties')
      .insert({ name: trimmed })
      .select('*')
      .maybeSingle();
    if (error || !inserted) return null;
    await loadData();
    return { id: (inserted as DbSpecialty).id, name: (inserted as DbSpecialty).name };
  };

  const updateSpecialty = async (id: string, name: string): Promise<Specialty | null> => {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const { data: existing } = await supabase
      .from('specialties')
      .select('*')
      .eq('name', trimmed)
      .neq('id', id)
      .maybeSingle();
    if (existing) {
      return null;
    }
    const { data: updated, error } = await supabase
      .from('specialties')
      .update({ name: trimmed })
      .eq('id', id)
      .select('*')
      .maybeSingle();
    if (error || !updated) return null;
    await loadData();
    return { id: (updated as DbSpecialty).id, name: (updated as DbSpecialty).name };
  };

  const resetAll = async () => {
    await supabase.from('appointments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase
      .from('queue_state')
      .update({
        next_ticket_number: 1,
        current_called_id: null,
        countdown_ends_at: null,
        attended_count: 0,
        total_consultation_minutes: 0,
        updated_at: new Date().toISOString(),
      })
      .eq('id', 1);
    await loadData();
  };

  return (
    <AppContext.Provider
      value={{
        data,
        currentUser,
        loading,
        login,
        logout,
        checkIn,
        getMyAppointment,
        getMyScheduledAppointments,
        getQueuePosition,
        getEstimatedWait,
        callNext,
        markPresent,
        markAbsentAndReschedule,
        updateSede,
        setSameDayBooking,
        setWeekendBooking,
        setCheckinMethod,
        setCheckinActive,
        addUser,
        removeUser,
        scheduleAppointment,
        saveAvailability,
        getDoctorAvailability,
        saveDoctorSchedule,
        toggleScheduleDay,
        ensureWeekdaysScheduled,
        getDoctorSchedule,
        getDoctorDisabledDays,
        toggleTimeSlot,
        getDisabledTimeSlots,
        updateDoctorSpecialty,
        getNotifications,
        getUnreadNotificationCount,
        markNotificationsRead,
        getSpecialties,
        addSpecialty,
        updateSpecialty,
        resetAll,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
