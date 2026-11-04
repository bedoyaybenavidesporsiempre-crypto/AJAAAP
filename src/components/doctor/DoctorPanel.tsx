import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import {
  Stethoscope,
  UserCheck,
  Clock,
  TrendingUp,
  MapPin,
  ChevronRight,
  CheckCircle2,
  Users,
  Timer,
  CreditCard,
  UserX,
  CalendarDays,
  Loader2,
  ChevronLeft,
  AlertCircle,
  Lock,
  Sun,
  Moon,
  Ban,
  FileText,
  Bell,
  X,
  CalendarClock,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useNow, formatCountdown } from '../../hooks/useNow';
import { COUNTDOWN_SECONDS } from '../../types';
import { getCallRemainingSeconds } from '../../lib/callTimer';
import { isPastCutoff } from '../../lib/cutoff';
import type { User as AppUser, Appointment } from '../../types';
import { ErrorBoundary } from '../ErrorBoundary';
import { TabStrip } from '../TabStrip';
import { PatientDistanceNotice } from './PatientDistanceNotice';

interface DoctorPanelProps {
  user: AppUser;
}

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

function formatDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

function getTodayStr(): string {
  const t = new Date();
  return formatDate(t.getFullYear(), t.getMonth(), t.getDate());
}

function generate30MinSlots(startHour: string, endHour: string): string[] {
  const slots: string[] = [];
  const [sh, sm] = startHour.split(':').map(Number);
  const [eh, em] = endHour.split(':').map(Number);
  let curMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  while (curMin < endMin) {
    const h = Math.floor(curMin / 60);
    const m = curMin % 60;
    slots.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
    curMin += 30;
  }
  return slots;
}

const MORNING_SLOTS = generate30MinSlots('08:00', '12:00');
const AFTERNOON_SLOTS = generate30MinSlots('14:00', '17:00');
const ALL_SLOTS = [...MORNING_SLOTS, ...AFTERNOON_SLOTS];

export function DoctorPanel({ user }: DoctorPanelProps) {
  const { data, callNext, markPresent, markAbsentAndReschedule, getDoctorSchedule, toggleScheduleDay, ensureWeekdaysScheduled, loading, getNotifications, getUnreadNotificationCount, markNotificationsRead } = useApp();
  const now = useNow(1000);
  const pastCutoff = isPastCutoff(new Date(now));
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'queue' | 'availability' | 'upcoming'>('queue');
  const [selectedAppt, setSelectedAppt] = useState<Appointment | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);

  const handleCallNext = async () => {
    setBusy(true);
    await callNext();
    setBusy(false);
  };

  const handlePresent = async (calledId: string) => {
    setBusy(true);
    await markPresent(calledId);
    setBusy(false);
  };

  const handleAbsent = async (calledId: string) => {
    setBusy(true);
    await markAbsentAndReschedule(calledId);
    setBusy(false);
  };

  // Filter appointments to show ONLY today's AND only this doctor's
  const todayStr = getTodayStr();
  const myAppointments = data.appointments.filter(
    (a) => a.doctorCedula === undefined || a.doctorCedula === user.cedula,
  );
  const waitingPatients = myAppointments
    .filter(
      (a) =>
        (a.status === 'checked-in' || a.status === 'rescheduled') &&
        (a.scheduledDate === todayStr || a.scheduledDate === undefined || a.scheduledDate === null),
    )
    .sort((a, b) => {
      const ta = a.scheduledTime && a.scheduledTime !== '--:--' ? a.scheduledTime : '99:99';
      const tb = b.scheduledTime && b.scheduledTime !== '--:--' ? b.scheduledTime : '99:99';
      if (ta !== tb) return ta.localeCompare(tb);
      return a.ticketNumber - b.ticketNumber;
    });

  const calledPatient = myAppointments.find((a) => a.status === 'called');
  const inAttendance = myAppointments.find((a) => a.status === 'in-attendance');

  const attendedToday = myAppointments.filter(
    (a) => a.status === 'attended' && (a.scheduledDate === todayStr || a.scheduledDate === undefined),
  );
  const avgTime = data.attendedCount > 0
    ? Math.round(data.totalConsultationMinutes / data.attendedCount)
    : 0;

  const countdownRemaining = getCallRemainingSeconds(calledPatient?.calledAt, now);
  const countdownProgress = calledPatient
    ? ((COUNTDOWN_SECONDS - countdownRemaining) / COUNTDOWN_SECONDS) * 100
    : 0;

  const attendanceElapsed = inAttendance?.attendanceStartAt
    ? Math.floor((now - inAttendance.attendanceStartAt) / 60000)
    : 0;

  const formatDistance = (m: number | undefined) => {
    if (m === undefined) return '—';
    return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${m} m`;
  };

  const unreadCount = getUnreadNotificationCount(user.cedula);
  const doctorNotifications = getNotifications(user.cedula);

  const handleOpenNotifications = () => {
    setShowNotifications((prev) => !prev);
    if (unreadCount > 0) {
      markNotificationsRead(user.cedula);
    }
  };

  return (
    <div className="min-h-[calc(100vh-140px)] px-4 py-5 max-w-md mx-auto">
      {/* Doctor profile */}
      <div className="bg-gradient-to-br from-blue-700 to-blue-700 rounded-3xl p-5 shadow-lg shadow-blue-200 mb-4 text-white animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="text-lg font-bold">{user.name}</p>
            <div className="flex items-center gap-1.5 text-white/80 text-sm">
              <CreditCard className="w-3.5 h-3.5" />
              CC: {user.cedula}
            </div>
          </div>
          {/* Bell icon with unread badge */}
          <button
            onClick={handleOpenNotifications}
            className="relative w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center hover:bg-white/25 transition-colors"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 animate-bounce-in">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>
        </div>
        <div className="mt-3 flex items-center gap-1.5 text-white/80 text-sm bg-white/10 rounded-lg px-3 py-2">
          <MapPin className="w-4 h-4 flex-shrink-0" />
          <span className="truncate">{data.sede.name}</span>
        </div>
      </div>

      {/* Notifications dropdown */}
      {showNotifications && (
        <div className="bg-white rounded-2xl shadow-lg border border-slate-100 mb-4 animate-slide-up max-h-80 overflow-y-auto">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 sticky top-0 bg-white">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Bell className="w-4 h-4 text-blue-700" />
              Notificaciones
            </h3>
            <button
              onClick={() => setShowNotifications(false)}
              className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          {doctorNotifications.length === 0 ? (
            <div className="p-6 text-center">
              <Bell className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-500">No tienes notificaciones.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {doctorNotifications.slice(0, 20).map((n) => (
                <div key={n.id} className={`p-3.5 flex items-start gap-3 ${n.isRead ? '' : 'bg-blue-50/50'}`}>
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${n.isRead ? 'bg-slate-100' : 'bg-blue-100'}`}>
                    <CalendarClock className={`w-4 h-4 ${n.isRead ? 'text-slate-400' : 'text-blue-700'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800">{n.message}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(n.createdAt).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                    </p>
                  </div>
                  {!n.isRead && (
                    <span className="w-2 h-2 rounded-full bg-blue-600 flex-shrink-0 mt-1.5" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* View tabs */}
      <TabStrip className="bg-slate-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setView('queue')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            view === 'queue' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          <Users className="w-4 h-4" />
          Sala de Espera
        </button>
        <button
          onClick={() => setView('upcoming')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            view === 'upcoming' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          <CalendarClock className="w-4 h-4" />
          Agenda Futura
        </button>
        <button
          onClick={() => setView('availability')}
          className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold transition-all ${
            view === 'availability' ? 'bg-white text-blue-800 shadow-sm' : 'text-slate-500 hover:text-slate-600'
          }`}
        >
          <CalendarDays className="w-4 h-4" />
          Disponibilidad
        </button>
      </TabStrip>

      {view === 'upcoming' && (
        <ErrorBoundary fallbackTitle="Error en Citas Pendientes">
          <UpcomingAppointmentsSection
            doctorCedula={user.cedula}
            appointments={myAppointments}
            onApptClick={(apt) => setSelectedAppt(apt)}
          />
        </ErrorBoundary>
      )}

      {view === 'availability' && (
        <ErrorBoundary fallbackTitle="Error en Mi Disponibilidad">
          <AvailabilityCalendarSection
            doctorCedula={user.cedula}
            doctorName={user.name}
            specialty={user.specialty ?? 'Médico General'}
            loading={loading}
            appointments={myAppointments}
            getSchedule={getDoctorSchedule}
            onToggleDay={toggleScheduleDay}
            ensureWeekdaysScheduled={ensureWeekdaysScheduled}
          />
        </ErrorBoundary>
      )}

      {view === 'queue' && (
        <>
      {/* Metrics */}
      <div className="grid grid-cols-2 gap-3 mb-4 animate-slide-up">
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <UserCheck className="w-4 h-4 text-emerald-600" />
            <span className="text-xs font-medium text-slate-500">Atendidos hoy</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">{attendedToday.length}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-blue-700" />
            <span className="text-xs font-medium text-slate-500">Tiempo promedio</span>
          </div>
          <p className="text-2xl font-bold text-slate-800">
            {avgTime}<span className="text-base font-medium text-slate-400"> min</span>
          </p>
        </div>
      </div>

      {/* In-attendance banner */}
      {inAttendance && (
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-2xl p-4 shadow-md shadow-emerald-200 mb-4 text-white animate-slide-up">
          <div className="flex items-center gap-2 mb-2">
            <Stethoscope className="w-5 h-5" />
            <span className="text-sm font-medium text-white/80">En consulta ahora</span>
          </div>
          <p className="text-xl font-bold">
            #{String(inAttendance.ticketNumber).padStart(2, '0')} · {inAttendance.patientName}
          </p>
          <div className="flex items-center gap-1.5 text-white/90 text-sm mt-2 bg-white/10 rounded-lg px-3 py-1.5">
            <Clock className="w-4 h-4" />
            <span>En consulta: {attendanceElapsed} min</span>
          </div>
        </div>
      )}

      {/* Countdown card — when patient is called */}
      {calledPatient && (
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-2xl p-5 shadow-lg shadow-red-200 mb-4 text-white text-center animate-bounce-in">
          <div className="flex items-center justify-center gap-2 mb-3">
            <Timer className="w-5 h-5" />
            <span className="text-sm font-medium text-white/80">Llamado en curso</span>
          </div>
          <p className="text-lg font-bold mb-3">
            #{String(calledPatient.ticketNumber).padStart(2, '0')} · {calledPatient.patientName}
          </p>
          <div className="text-left mb-3">
            {calledPatient.checkinMethod === 'gps' && (
              <PatientDistanceNotice
                patientCedula={calledPatient.patientCedula}
                sede={data.sede}
              />
            )}
          </div>

          <div className="inline-flex items-center gap-2 bg-white/15 rounded-2xl px-5 py-2.5 mb-3">
            <span className="text-3xl font-extrabold font-mono tracking-tight">
              {formatCountdown(countdownRemaining)}
            </span>
          </div>

          <div className="w-full h-2 bg-white/20 rounded-full overflow-hidden mb-4">
            <div
              className="h-full bg-white rounded-full transition-all duration-1000 ease-linear"
              style={{ width: `${countdownProgress}%` }}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => handlePresent(calledPatient.id)}
              disabled={busy}
              className="bg-white/20 hover:bg-white/30 active:scale-[0.98] transition-all
                         font-semibold py-3 rounded-xl flex items-center justify-center gap-2
                         disabled:opacity-50"
            >
              <CheckCircle2 className="w-5 h-5" />
              Paciente Presente
            </button>
            <button
              onClick={() => handleAbsent(calledPatient.id)}
              disabled={busy}
              className="bg-white/20 hover:bg-white/30 active:scale-[0.98] transition-all
                         font-semibold py-3 rounded-xl flex items-center justify-center gap-2
                         disabled:opacity-50"
            >
              <UserX className="w-5 h-5" />
              Ausente / Reagendar
            </button>
          </div>
        </div>
      )}

      {/* Call next button — only when no countdown active and before 6:30 PM */}
      {!calledPatient && !pastCutoff && (
        <button
          onClick={handleCallNext}
          disabled={waitingPatients.length === 0 || busy}
          className="w-full bg-emerald-500 text-white font-bold py-4 rounded-2xl
                     hover:bg-emerald-600 active:scale-[0.98] transition-all
                     disabled:opacity-40 disabled:cursor-not-allowed
                     flex items-center justify-center gap-2.5 shadow-md shadow-emerald-200 mb-4"
        >
          <UserCheck className="w-6 h-6" />
          {inAttendance ? 'Finalizar y Llamar Siguiente' : 'Llamar Siguiente Paciente'}
        </button>
      )}

      {/* Appointment list — hidden after 6:30 PM */}
      {!pastCutoff && (
      <div className="mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-700 flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-700" />
            Citas de hoy
            <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">
              {waitingPatients.length}
            </span>
          </h3>
        </div>

        {waitingPatients.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">No hay pacientes en espera para hoy.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {waitingPatients.map((apt, idx) => (
              <AppointmentRow
                key={apt.id}
                apt={apt}
                position={idx + 1}
                isNext={idx === 0 && !calledPatient}
                distanceText={formatDistance(apt.gpsDistance)}
                onClick={() => setSelectedAppt(apt)}
              />
            ))}
          </div>
        )}
      </div>

      )}

      {/* Attended today */}
      {attendedToday.length > 0 && (
        <div className="mb-4">
          <h3 className="font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Atendidos hoy ({attendedToday.length})
          </h3>
          <div className="space-y-2">
            {attendedToday.slice(-4).reverse().map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-xl p-3 flex items-center gap-3 border border-slate-100"
              >
                <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="flex-1">
                  <span className="text-sm font-medium text-slate-700">
                    #{String(p.ticketNumber).padStart(2, '0')} · {p.patientName}
                  </span>
                </div>
                {p.attendanceStartAt && p.attendanceEndAt && (
                  <span className="text-xs text-slate-400">
                    {Math.round((p.attendanceEndAt - p.attendanceStartAt) / 60000)} min
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

        </>
      )}

      {/* Patient detail modal */}
      {selectedAppt && (
        <PatientDetailModal appt={selectedAppt} onClose={() => setSelectedAppt(null)} />
      )}
    </div>
  );
}

interface AppointmentRowProps {
  apt: Appointment;
  position: number;
  isNext: boolean;
  distanceText: string;
  onClick: () => void;
}

function AppointmentRow({ apt, isNext, distanceText, onClick }: AppointmentRowProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl p-3 flex items-center gap-3 border transition-all animate-slide-in cursor-pointer hover:border-blue-200 hover:shadow-sm ${
        isNext ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-100'
      }`}
    >
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isNext ? 'bg-blue-700 text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {String(apt.ticketNumber).padStart(2, '0')}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-slate-800 truncate">{apt.patientName}</p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="w-3 h-3" /> {apt.scheduledTime}
          </span>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {distanceText}
          </span>
          {apt.status === 'rescheduled' && (
            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
              REAGENDADO
            </span>
          )}
          {isNext && (
            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
              SIGUIENTE
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="w-4 h-4 text-slate-300" />
    </div>
  );
}

// ============================================================
// Patient Detail Modal — shows appointment reason and details
// ============================================================
interface PatientDetailModalProps {
  appt: Appointment;
  onClose: () => void;
}

function PatientDetailModal({ appt, onClose }: PatientDetailModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-sm animate-slide-up"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl p-6 w-full max-w-md shadow-xl max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-slate-800 text-lg">Detalle del Paciente</h3>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Patient name and ticket */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Users className="w-6 h-6 text-blue-700" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-slate-800 truncate">{appt.patientName}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> CC: {appt.patientCedula}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs text-slate-400">Turno</p>
            <p className="text-lg font-bold text-blue-700">#{String(appt.ticketNumber).padStart(2, '0')}</p>
          </div>
        </div>

        <div className="h-px bg-slate-100 mb-4" />

        {/* Time and distance */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <Clock className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Hora</p>
              <p className="text-sm font-semibold text-slate-800">{appt.scheduledTime}</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <MapPin className="w-4 h-4 text-blue-700" />
            </div>
            <div>
              <p className="text-xs text-slate-400">Distancia</p>
              <p className="text-sm font-semibold text-slate-800">
                {appt.gpsDistance !== undefined
                  ? appt.gpsDistance >= 1000
                    ? `${(appt.gpsDistance / 1000).toFixed(1)} km`
                    : `${appt.gpsDistance} m`
                  : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="h-px bg-slate-100 mb-4" />

        {/* Reason for consultation */}
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
            <FileText className="w-4 h-4 text-teal-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400">Motivo de la consulta</p>
            {appt.reason ? (
              <p className="text-sm font-medium text-slate-700 mt-0.5">{appt.reason}</p>
            ) : (
              <p className="text-sm text-slate-300 mt-0.5">Sin motivo registrado</p>
            )}
          </div>
        </div>

        {appt.status === 'rescheduled' && (
          <div className="mt-4 bg-amber-50 rounded-xl px-4 py-2.5 text-sm font-semibold text-amber-700 text-center">
            Cita reagendada ({appt.rescheduleCount} vez)
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full mt-5 bg-blue-700 text-white font-semibold py-3 rounded-xl
                     hover:bg-blue-800 active:scale-[0.98] transition-all"
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}

// ============================================================
// Upcoming Appointments Section — shows scheduled appointments
// for future days (not today) with patient info
// ============================================================
interface UpcomingAppointmentsSectionProps {
  doctorCedula: string;
  appointments: Appointment[];
  onApptClick: (apt: Appointment) => void;
}

const WEEKDAYS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTHS_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function formatNiceDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS[date.getDay()]}, ${d} de ${MONTHS_SHORT[date.getMonth()]} ${y}`;
}

function UpcomingAppointmentsSection({ doctorCedula, appointments, onApptClick }: UpcomingAppointmentsSectionProps) {
  const todayStr = getTodayStr();
  const [expandedDay, setExpandedDay] = useState<string | null>(null);

  const upcoming = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          a.doctorCedula === doctorCedula &&
          a.scheduledDate &&
          (a.scheduledDate > todayStr || (a.scheduledDate === todayStr && a.status === 'scheduled')) &&
          (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
      )
      .sort((a, b) => {
        const da = a.scheduledDate || '';
        const db = b.scheduledDate || '';
        if (da !== db) return da.localeCompare(db);
        return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
      });
  }, [appointments, doctorCedula, todayStr]);

  const groupedByDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const apt of upcoming) {
      const dateKey = apt.scheduledDate!;
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey)!.push(apt);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [upcoming]);

  const toggleDay = (dateStr: string) => {
    setExpandedDay((prev) => (prev === dateStr ? null : dateStr));
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 animate-slide-up">
        <div className="flex items-center gap-2 mb-1">
          <CalendarClock className="w-5 h-5 text-blue-700" />
          <h3 className="font-semibold text-slate-800">Agenda Futura</h3>
        </div>
        <p className="text-sm text-slate-500">
          Toca un día para ver los pacientes agendados con su información detallada.
        </p>
      </div>

      {groupedByDate.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 animate-slide-up">
          <CalendarClock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
          <p className="text-slate-500 text-sm">No tienes citas agendadas para próximos días.</p>
        </div>
      ) : (
        <div className="space-y-3 animate-slide-up">
          {groupedByDate.map(([dateStr, appts]) => {
            const isExpanded = expandedDay === dateStr;
            return (
              <div key={dateStr} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Date header — clickable to expand/collapse */}
                <button
                  onClick={() => toggleDay(dateStr)}
                  className="w-full bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center gap-2 hover:bg-blue-100/60 transition-colors"
                >
                  <CalendarDays className="w-4 h-4 text-blue-700 flex-shrink-0" />
                  <span className="text-sm font-semibold text-blue-900 text-left">{formatNiceDate(dateStr)}</span>
                  <span className="ml-auto bg-blue-100 text-blue-800 text-xs font-bold px-2 py-0.5 rounded-full">
                    {appts.length} {appts.length === 1 ? 'cita' : 'citas'}
                  </span>
                  <ChevronRight
                    className={`w-4 h-4 text-blue-700 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`}
                  />
                </button>

                {/* Expandable patient list */}
                {isExpanded && (
                  <div className="divide-y divide-slate-50 animate-slide-up">
                    {appts.map((apt) => (
                      <div
                        key={apt.id}
                        onClick={() => onApptClick(apt)}
                        className="p-3.5 flex items-start gap-3 hover:bg-slate-50 transition-colors cursor-pointer"
                      >
                        {/* Time badge */}
                        <div className="w-14 h-14 rounded-xl bg-blue-50 flex flex-col items-center justify-center flex-shrink-0">
                          <Clock className="w-3.5 h-3.5 text-blue-600 mb-0.5" />
                          <span className="text-xs font-bold text-blue-800">{apt.scheduledTime}</span>
                        </div>

                        {/* Patient info — full details */}
                        <div className="flex-1 min-w-0 space-y-1">
                          <p className="text-sm font-semibold text-slate-800 truncate">{apt.patientName}</p>
                          <p className="text-xs text-slate-400 flex items-center gap-1">
                            <CreditCard className="w-3 h-3" /> {apt.patientCedula}
                          </p>
                          {apt.reason && (
                            <p className="text-xs text-slate-500 flex items-start gap-1">
                              <FileText className="w-3 h-3 text-teal-500 flex-shrink-0 mt-0.5" />
                              <span className="line-clamp-2">{apt.reason}</span>
                            </p>
                          )}
                        </div>

                        {/* Status badge */}
                        <div className="flex-shrink-0">
                          {apt.status === 'checked-in' && (
                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">
                              CHECK-IN
                            </span>
                          )}
                          {apt.status === 'rescheduled' && (
                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                              REAGENDADO
                            </span>
                          )}
                          {apt.status === 'scheduled' && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                              AGENDADA
                            </span>
                          )}
                        </div>

                        <ChevronRight className="w-4 h-4 text-slate-300 flex-shrink-0 mt-1" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================
// Availability Calendar Section — Monthly calendar with per-day
// time range management + per-slot deactivation
// ============================================================
interface AvailabilityCalendarSectionProps {
  doctorCedula: string;
  doctorName: string;
  specialty: string;
  loading: boolean;
  appointments: import('../../types').Appointment[];
  getSchedule: (cedula: string) => import('../../types').DoctorScheduleEntry[];
  onToggleDay: (doctorCedula: string, date: string) => Promise<void>;
  ensureWeekdaysScheduled: (doctorCedula: string, monthsAhead?: number) => Promise<void>;
}

function AvailabilityCalendarSection({
  doctorCedula,
  doctorName,
  specialty,
  loading,
  appointments,
  getSchedule,
  onToggleDay,
  ensureWeekdaysScheduled,
}: AvailabilityCalendarSectionProps) {
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [optimisticDays, setOptimisticDays] = useState<Set<string>>(new Set());
  const tapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapDayRef = useRef<number | null>(null);

  // Auto-seed weekdays for the next 6 months once on mount.
  useEffect(() => {
    ensureWeekdaysScheduled(doctorCedula, 6).catch((err) => console.error('ensureWeekdaysScheduled failed:', err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [doctorCedula]);

  const schedule = getSchedule(doctorCedula) ?? [];
  const scheduleMap = useMemo(() => new Map(schedule.map((s) => [s.scheduleDate, s])), [schedule]);
  const optimisticSet = useMemo(() => {
    const base = new Set(scheduleMap.keys());
    for (const d of optimisticDays) base.add(d);
    return base;
  }, [scheduleMap, optimisticDays]);

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = useMemo(() => {
    const arr: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) arr.push(null);
    for (let d = 1; d <= daysInMonth; d++) arr.push(d);
    return arr;
  }, [firstDay, daysInMonth]);

  const prevMonth = useCallback(() => {
    const prev = new Date(viewYear, viewMonth - 1, 1);
    if (prev >= currentMonthStart) {
      if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
      else setViewMonth(viewMonth - 1);
      setSelectedDay(null);
    }
  }, [viewYear, viewMonth, currentMonthStart]);

  const nextMonthNav = useCallback(() => {
    const next = new Date(viewYear, viewMonth + 1, 1);
    if (next <= new Date(today.getFullYear(), today.getMonth() + 6, 1)) {
      if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
      else setViewMonth(viewMonth + 1);
      setSelectedDay(null);
    }
  }, [viewYear, viewMonth, today]);

  const isPastDay = (day: number): boolean => {
    const dateObj = new Date(viewYear, viewMonth, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return dateObj < todayMidnight;
  };

  const getDayStatus = (day: number): 'scheduled' | 'full' | 'off' | 'past' => {
    if (isPastDay(day)) return 'past';
    const dateStr = formatDate(viewYear, viewMonth, day);
    if (!optimisticSet.has(dateStr)) return 'off';
    const takenSlots = appointments.filter(
      (a) =>
        a.scheduledDate === dateStr &&
        (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
    ).length;
    return takenSlots >= ALL_SLOTS.length ? 'full' : 'scheduled';
  };

  const handleDayTap = (day: number) => {
    if (isPastDay(day)) return;
    const dateStr = formatDate(viewYear, viewMonth, day);
    const isScheduled = optimisticSet.has(dateStr);

    if (lastTapDayRef.current === day && tapTimerRef.current) {
      clearTimeout(tapTimerRef.current);
      tapTimerRef.current = null;
      lastTapDayRef.current = null;
      setSelectedDay(day);
    } else {
      lastTapDayRef.current = day;
      tapTimerRef.current = setTimeout(() => {
        tapTimerRef.current = null;
        lastTapDayRef.current = null;
        if (isScheduled) {
          setOptimisticDays((prev) => { const next = new Set(prev); next.delete(dateStr); return next; });
          onToggleDay(doctorCedula, dateStr).catch(() => {
            setOptimisticDays((prev) => { const next = new Set(prev); next.add(dateStr); return next; });
          });
          if (selectedDay === day) setSelectedDay(null);
        } else {
          setOptimisticDays((prev) => { const next = new Set(prev); next.add(dateStr); return next; });
          onToggleDay(doctorCedula, dateStr).catch(() => {
            setOptimisticDays((prev) => { const next = new Set(prev); next.delete(dateStr); return next; });
          });
        }
      }, 280);
    }
  };

  const totalScheduledDays = schedule.length;
  const totalSlots = totalScheduledDays * ALL_SLOTS.length;

  const canGoPrev = new Date(viewYear, viewMonth - 1, 1) >= currentMonthStart;
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= new Date(today.getFullYear(), today.getMonth() + 6, 1);

  const selectedDateStr = selectedDay ? formatDate(viewYear, viewMonth, selectedDay) : null;
  const isDayScheduled = selectedDateStr ? optimisticSet.has(selectedDateStr) : false;

  return (
    <div className="space-y-4">
      {/* Specialty section — read-only for doctors */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-3">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <Stethoscope className="w-5 h-5 text-blue-700" />
          Mi Especialidad Médica
        </h3>
        <div className="bg-slate-50 rounded-xl p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Stethoscope className="w-5 h-5 text-blue-700" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-slate-400 font-medium">Especialidad asignada</p>
            <p className="text-base font-semibold text-slate-800">{specialty}</p>
          </div>
          <div className="flex items-center gap-1 text-xs text-slate-400">
            <Lock className="w-3.5 h-3.5" />
            <span>Solo el administrador puede modificar</span>
          </div>
        </div>
      </div>

      {/* Calendar */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-700" />
          Calendario de Disponibilidad
        </h3>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            <div className="h-4 bg-slate-100 rounded w-3/4" />
            <div className="h-20 bg-slate-100 rounded-xl" />
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-slate-100" />
              ))}
            </div>
          </div>
        ) : (
        <>
        <div className="bg-blue-50 rounded-xl p-3 space-y-1.5 text-xs text-slate-600">
          <p className="flex items-center gap-1.5"><span className="font-semibold text-emerald-700">1 toque</span> — Marcar/desmarcar día como disponible</p>
          <p className="flex items-center gap-1.5"><span className="font-semibold text-blue-800">Doble toque</span> — Ver y configurar intervalos del día</p>
        </div>

        {/* Schedule info — separate morning and afternoon */}
        <div className="space-y-2">
          <div className="bg-amber-50 rounded-xl p-3 flex items-center gap-3">
            <Sun className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Horario Mañana:</span> 08:00 AM - 12:00 PM
              <span className="text-slate-400 ml-1">({MORNING_SLOTS.length} intervalos)</span>
            </div>
          </div>
          <div className="bg-indigo-50 rounded-xl p-3 flex items-center gap-3">
            <Moon className="w-5 h-5 text-indigo-600 flex-shrink-0" />
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-800">Horario Tarde:</span> 02:00 PM - 05:00 PM
              <span className="text-slate-400 ml-1">({AFTERNOON_SLOTS.length} intervalos)</span>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-400" /> Día programado
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-red-400" /> Cupo lleno
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-white border border-slate-200" /> No labora
          </span>
          <span className="flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-slate-100" /> Pasado
          </span>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-emerald-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-emerald-600">{totalScheduledDays}</p>
            <p className="text-xs text-slate-500">Días programados</p>
          </div>
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-blue-700">{totalSlots}</p>
            <p className="text-xs text-slate-500">Intervalos de 30 min</p>
          </div>
        </div>

        {/* Month navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={prevMonth}
            disabled={!canGoPrev}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold text-slate-700">
            {MONTH_LABELS[viewMonth]} {viewYear}
          </span>
          <button
            type="button"
            onClick={nextMonthNav}
            disabled={!canGoNext}
            className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-700 hover:border-slate-300 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 gap-1">
          {DAY_LABELS.map((label) => (
            <div key={label} className="text-center text-[10px] font-semibold text-slate-400 py-1">
              {label}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, idx) => {
            if (day === null) return <div key={idx} />;

            const status = getDayStatus(day);

            let cellClass = 'bg-white border border-slate-200 text-slate-400';
            if (status === 'scheduled') cellClass = 'bg-emerald-400 border border-emerald-400 text-white hover:bg-emerald-500';
            if (status === 'full') cellClass = 'bg-red-400 border border-red-400 text-white';
            if (status === 'past') cellClass = 'bg-slate-50 border border-slate-100 text-slate-300 cursor-not-allowed';

            return (
              <button
                key={idx}
                type="button"
                onClick={() => handleDayTap(day)}
                className={`aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center select-none touch-manipulation ${cellClass}`}
              >
                {day}
              </button>
            );
          })}
        </div>

        {/* Slot deactivation panel — shows when a scheduled day is selected */}
        {selectedDay && selectedDateStr && (
          isDayScheduled ? (
            <SlotDeactivationPanel
              doctorCedula={doctorCedula}
              dateStr={selectedDateStr}
              dayLabel={selectedDay}
              appointments={appointments}
            />
          ) : (
            <div className="bg-slate-50 rounded-xl p-4 text-center animate-slide-up space-y-1">
              <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <p className="text-sm font-medium text-slate-500">Este día no está marcado como disponible</p>
              <p className="text-xs text-slate-400">Usa un toque para marcarlo como disponible y luego doble toque para configurar intervalos.</p>
            </div>
          )
        )}
        </>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Slot Deactivation Panel — lets doctor click individual 30-min
// intervals to enable/disable them for a specific day
// ============================================================
interface SlotDeactivationPanelProps {
  doctorCedula: string;
  dateStr: string;
  dayLabel: number;
  appointments: Appointment[];
}

function SlotDeactivationPanel({ doctorCedula, dateStr, dayLabel, appointments }: SlotDeactivationPanelProps) {
  const { toggleTimeSlot, getDisabledTimeSlots } = useApp();
  const [toggling, setToggling] = useState<string | null>(null);
  const [optimisticDisabled, setOptimisticDisabled] = useState<Set<string>>(new Set());
  const slotTapTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTapSlotRef = useRef<string | null>(null);

  const disabledSlots = getDisabledTimeSlots(doctorCedula, dateStr);
  const disabledSet = useMemo(() => {
    const base = new Set(disabledSlots);
    for (const s of optimisticDisabled) base.add(s);
    return base;
  }, [disabledSlots, optimisticDisabled]);

  const takenSlots = useMemo(() => new Set(
    appointments
      .filter(
        (a) =>
          a.scheduledDate === dateStr &&
          (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
      )
      .map((a) => a.scheduledTime),
  ), [appointments, dateStr]);

  const handleSlotTap = (slot: string) => {
    if (takenSlots.has(slot)) return;

    if (lastTapSlotRef.current === slot && slotTapTimerRef.current) {
      clearTimeout(slotTapTimerRef.current);
      slotTapTimerRef.current = null;
      lastTapSlotRef.current = null;
      if (disabledSet.has(slot)) {
        setOptimisticDisabled((prev) => { const next = new Set(prev); next.delete(slot); return next; });
        setToggling(slot);
        toggleTimeSlot(doctorCedula, dateStr, slot).then(() => setToggling(null));
      }
    } else {
      lastTapSlotRef.current = slot;
      slotTapTimerRef.current = setTimeout(() => {
        slotTapTimerRef.current = null;
        lastTapSlotRef.current = null;
        if (!disabledSet.has(slot)) {
          setOptimisticDisabled((prev) => { const next = new Set(prev); next.add(slot); return next; });
          setToggling(slot);
          toggleTimeSlot(doctorCedula, dateStr, slot).then(() => setToggling(null));
        }
      }, 280);
    }
  };

  const renderSlotButton = (slot: string) => {
    const isDisabled = disabledSet.has(slot);
    const isTaken = takenSlots.has(slot);
    const isToggling = toggling === slot;

    let cls = 'bg-white border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50';
    if (isTaken) cls = 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed line-through';
    else if (isDisabled) cls = 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100';
    else if (isToggling) cls = 'bg-blue-100 border-blue-400 text-blue-800';

    return (
      <div
        key={slot}
        onClick={() => handleSlotTap(slot)}
        className={`py-2.5 rounded-lg text-sm font-medium transition-all border flex items-center justify-center gap-1.5 select-none ${cls} ${isTaken ? 'cursor-not-allowed' : 'cursor-pointer'}`}
      >
        {isToggling ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : isDisabled ? (
          <Ban className="w-3.5 h-3.5" />
        ) : null}
        {slot}
      </div>
    );
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3 animate-slide-up">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700">
          Intervalos del día {dayLabel}
        </p>
        <span className="text-xs text-slate-400">
          1 toque: ocupar · Doble toque: liberar
        </span>
      </div>

      {/* Morning slots */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-700">
          <Sun className="w-3.5 h-3.5" />
          Horario Mañana: 08:00 AM - 12:00 PM
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {MORNING_SLOTS.map(renderSlotButton)}
        </div>
      </div>

      {/* Afternoon slots */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700">
          <Moon className="w-3.5 h-3.5" />
          Horario Tarde: 02:00 PM - 05:00 PM
        </div>
        <div className="grid grid-cols-3 gap-1.5">
          {AFTERNOON_SLOTS.map(renderSlotButton)}
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-start gap-2 bg-white rounded-lg p-2.5">
        <AlertCircle className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500">
          Un toque para marcar un intervalo como ocupado. Doble toque para liberarlo. Los tachados ya tienen citas agendadas.
        </p>
      </div>
    </div>
  );
}
