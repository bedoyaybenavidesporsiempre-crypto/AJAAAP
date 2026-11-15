import { useState, useEffect } from 'react';
import {
  Calendar,
  Clock,
  Stethoscope,
  FileText,
  CheckCircle2,
  MapPin,
  Navigation,
  Loader2,
  AlertTriangle,
  User,
  CreditCard,
  Bell,
  Timer,
  DoorClosed,
  XCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import { CheckInZoneCard } from './CheckInZoneCard';
import { useNow, formatCountdown } from '../../hooks/useNow';
import { getCallRemainingSeconds } from '../../lib/callTimer';
import { getOfficialTurn, getTurnsAhead } from '../../lib/queueTurns';
import { useCalledTurnAlert } from '../../hooks/useCalledTurnAlert';
import { useCalledVibration } from '../../hooks/useCalledVibration';
import { useNotificationSound } from '../../hooks/useSound';
import { CheckInByCode } from './CheckInByCode';
import { QrCode, Hash } from 'lucide-react';
import { useCheckinActive } from '../../hooks/useCheckinActive';
import { toLocalDateStr } from '../../lib/cutoff';
import type { User as AppUser, Appointment, SedeConfig } from '../../types';
import type { GeoResult } from '../../hooks/useGeolocation';

interface MyAppointmentsProps {
  user: AppUser;
  onCheckedIn: () => void;
}

type PatientTab = 'today' | 'upcoming';

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MONTH_LABELS[m - 1]} de ${y}`;
}

function formatTime12h(time24: string): string {
  if (!time24 || time24 === '--:--') return time24;
  const [h, m] = time24.split(':').map(Number);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function MyAppointments({ user, onCheckedIn }: MyAppointmentsProps) {
  const { data, getMyScheduledAppointments, checkIn, cancelAppointment } = useApp();
  const { playAlert } = useNotificationSound();
  const doctorCedula = data.appointments.find(
    (a) => a.patientCedula === user.cedula && a.doctorCedula,
  )?.doctorCedula;
  const { checkLocation, simulateNear, result, loading: geoLoading } = useGeolocation(
    data.sede.lat,
    data.sede.lng,
    data.sede.allowSameDayBooking,
    data.sede.gpsRadiusMeters,
  );
  const now = useNow(1000);
  const { active: checkinActive, testMode } = useCheckinActive();
  const [checkInBusy, setCheckInBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const [showCheckInForm, setShowCheckInForm] = useState(false);
  const [tab, setTab] = useState<PatientTab>('today');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [cancelError, setCancelError] = useState('');
  const [cancelSuccess, setCancelSuccess] = useState('');

  const todayStr = toLocalDateStr(new Date(now));
  const scheduledAppts = getMyScheduledAppointments(user.cedula);
  const todayAppts = scheduledAppts.filter((a) => a.scheduledDate === todayStr);
  const upcomingAppts = scheduledAppts.filter((a) => (a.scheduledDate ?? '') > todayStr);
  const activeAppt = data.appointments.find(
    (a) =>
      a.patientCedula === user.cedula &&
      a.scheduledDate === todayStr &&
      a.status !== 'attended' &&
      a.status !== 'absent',
  );

  const geoOk = result.status === 'success' || result.status === 'simulated';

  const isCalled = activeAppt?.status === 'called';
  const countdownRemaining = isCalled
    ? getCallRemainingSeconds(activeAppt?.calledAt, now)
    : 0;

  const turn = activeAppt ? getOfficialTurn(activeAppt, data.appointments) : 0;
  const isQueued = activeAppt?.status === 'checked-in' || activeAppt?.status === 'rescheduled';
  const turnsAhead = activeAppt && isQueued ? getTurnsAhead(activeAppt, data.appointments) : 0;
  const pseudoTurn = turnsAhead + 1;

  const hasCheckedIn = activeAppt && (activeAppt.status === 'checked-in' || activeAppt.status === 'called' || activeAppt.status === 'in-attendance' || activeAppt.status === 'rescheduled');
  const missedToday = data.appointments.find(
    (a) =>
      a.patientCedula === user.cedula &&
      a.status === 'absent' &&
      a.scheduledDate === todayStr,
  );
  const unattendedAfterCutoff = !!missedToday;

  const myDoctorCedula = activeAppt?.doctorCedula ?? doctorCedula;
  const currentCall = myDoctorCedula
    ? data.appointments.find((a) => a.status === 'called' && a.doctorCedula === myDoctorCedula)
    : undefined;
  const calledKey = currentCall ? `${currentCall.id}-${currentCall.calledAt}` : null;
  const calledTurn = currentCall ? getOfficialTurn(currentCall, data.appointments) : null;
  const alertTurn = useCalledTurnAlert(calledKey, calledTurn);
  useCalledVibration(!!isCalled);

  useEffect(() => {
    if (isCalled) playAlert();
  }, [isCalled, playAlert]);

  const handleCheckIn = async () => {
    if (!geoOk || result.distance === null) {
      setFormError('Debes verificar tu ubicación primero.');
      return;
    }
    setCheckInBusy(true);
    const apt = await checkIn(user.cedula, user.name, result.distance, 'gps');
    setCheckInBusy(false);
    if (apt) {
      onCheckedIn();
    } else {
      setFormError('No se pudo registrar el check-in. Intenta de nuevo.');
    }
  };

  const canCancelAppointment = (apt: Appointment): boolean => {
    if (apt.status !== 'scheduled' || !apt.scheduledDate) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const aptDate = new Date(apt.scheduledDate + 'T00:00:00');
    const diffDays = (aptDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays >= 2;
  };

  const handleCancelClick = (aptId: string) => {
    setConfirmCancelId(aptId);
  };

  const handleCancel = async (aptId: string) => {
    setConfirmCancelId(null);
    setCancellingId(aptId);
    setCancelError('');
    setCancelSuccess('');
    const { success, error } = await cancelAppointment(aptId, 'patient');
    setCancellingId(null);
    if (success) {
      setCancelSuccess('Tu cita ha sido cancelada. Se notificó a secretaría y al médico.');
      setTimeout(() => setCancelSuccess(''), 5000);
    } else {
      setCancelError(error ?? 'No se pudo cancelar la cita. Intenta de nuevo.');
      setTimeout(() => setCancelError(''), 5000);
    }
  };

  const renderAppointmentCards = (list: Appointment[]) =>
    list.map((apt) => (
      <AppointmentDetailCard
        key={apt.id}
        apt={apt}
        users={data.users}
        turn={getOfficialTurn(apt, data.appointments)}
        canCancel={canCancelAppointment(apt)}
        onCancel={handleCancelClick}
      />
    ));

  return (
    <div className="min-h-[calc(100vh-140px)] px-4 py-5 max-w-md mx-auto space-y-4">
      {alertTurn !== null && (
        <div
          role="alert"
          className="fixed top-4 left-4 right-4 max-w-md mx-auto z-50 rounded-2xl bg-blue-700 text-white shadow-xl px-5 py-4 flex items-center justify-between animate-bounce-in"
        >
          <div className="flex items-center gap-3">
            <Bell className="w-6 h-6" />
            <p className="font-semibold">Turno llamado</p>
          </div>
          <span className="text-3xl font-extrabold tracking-tight">
            #{String(alertTurn).padStart(2, '0')}
          </span>
        </div>
      )}

      {unattendedAfterCutoff && (
        <div className="rounded-2xl p-5 bg-amber-50 border border-amber-200 text-amber-800 animate-slide-up space-y-2">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Tu cita no pudo ser atendida a tiempo.</p>
              <p className="text-sm mt-1">Por favor, contacta a secretaría para reagendar.</p>
            </div>
          </div>
        </div>
      )}

      {/* Called alert — if patient was called */}
      {isCalled && (
        <div className="bg-gradient-to-br from-red-500 to-rose-600 rounded-3xl p-6 shadow-xl shadow-red-200 text-white text-center animate-bounce-in">
          <div className="relative inline-block mb-3">
            <div className="absolute inset-0 rounded-full bg-white/20 animate-pulse-ring" />
            <div className="relative w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto">
              <Bell className="w-8 h-8" />
            </div>
          </div>
          <h2 className="text-2xl font-extrabold mb-1">¡Has sido llamado!</h2>
          <p className="text-white/90 text-sm mb-4">Presentáte en el cubículo de atención</p>
          <div className="inline-flex items-center gap-2 bg-white/15 rounded-2xl px-5 py-3 mb-3">
            <Timer className="w-7 h-7" />
            <span className="text-4xl font-extrabold font-mono tracking-tight">
              {formatCountdown(countdownRemaining)}
            </span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl">
        {([['today', 'Hoy'], ['upcoming', 'Próximas Citas']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === key ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'today' && (
        <>
          {cancelError && (
            <div className="rounded-2xl p-4 bg-red-50 border border-red-200 text-red-700 text-sm flex items-start gap-2.5 animate-slide-up">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="font-medium">{cancelError}</p>
            </div>
          )}
          {cancelSuccess && (
            <div className="rounded-2xl p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm flex items-start gap-2.5 animate-slide-up">
              <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="font-medium">{cancelSuccess}</p>
            </div>
          )}
          {cancellingId && (
            <div className="rounded-2xl p-4 bg-blue-50 border border-blue-100 text-blue-700 text-sm flex items-center gap-2.5 animate-slide-up">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="font-medium">Cancelando cita...</p>
            </div>
          )}

          {/* Active queue status — if checked in */}
          {hasCheckedIn && activeAppt && (
            <div className={`rounded-3xl p-6 shadow-lg transition-all animate-slide-up ${
              activeAppt.status === 'in-attendance'
                ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white'
                : activeAppt.status === 'called'
                  ? 'bg-white text-slate-800 border border-slate-100'
                  : activeAppt.status === 'rescheduled'
                    ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white'
                    : 'bg-gradient-to-br from-blue-700 to-blue-600 text-white'
            }`}>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className={`text-sm ${activeAppt.status === 'called' ? 'text-slate-500' : 'text-white/70'}`}>
                    Tu número de turno
                  </p>
                  <div className="text-5xl font-extrabold tracking-tight mt-1">
                    #{String(turn).padStart(2, '0')}
                  </div>
                </div>
                <div className={`w-14 h-14 rounded-full flex items-center justify-center ${
                  activeAppt.status === 'called' ? 'bg-blue-50' : 'bg-white/20'
                }`}>
                  {activeAppt.status === 'in-attendance' ? (
                    <Stethoscope className="w-7 h-7" />
                  ) : (
                    <Clock className={`w-7 h-7 ${activeAppt.status === 'called' ? 'text-blue-700' : ''}`} />
                  )}
                </div>
              </div>
              <div className={`h-px ${activeAppt.status === 'called' ? 'bg-slate-100' : 'bg-white/20'} mb-4`} />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${activeAppt.status === 'called' ? 'text-slate-500' : 'text-white/80'}`}>
                    Estado
                  </span>
                  <span className={`font-bold ${activeAppt.status === 'called' ? 'text-slate-800' : ''}`}>
                    {activeAppt.status === 'checked-in' && 'En fila de espera'}
                    {activeAppt.status === 'called' && '¡Llamado!'}
                    {activeAppt.status === 'in-attendance' && 'En consulta'}
                    {activeAppt.status === 'rescheduled' && 'Reagendado'}
                  </span>
                </div>
                {isQueued && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80">
                        Pseudoturno
                      </span>
                      <span className="font-bold">
                        #{String(pseudoTurn).padStart(2, '0')}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-white/80">
                        Pacientes antes que tú
                      </span>
                      <span className="font-bold text-lg">
                        {turnsAhead}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {isQueued && turnsAhead === 1 && (
            <div className="rounded-2xl p-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2.5 animate-slide-up">
              <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <p className="font-semibold">¡Prepárate! Eres el siguiente en pasar.</p>
            </div>
          )}

          {todayAppts.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-bold text-slate-800 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-700" />
                Cita de hoy
              </h2>
              {renderAppointmentCards(todayAppts)}
            </div>
          )}

          {/* Check-in section — visible when patient has a scheduled appointment today and hasn't checked in */}
          {todayAppts.some((a) => a.status === 'scheduled') && (
            <>
            {!checkinActive && !testMode && (
              <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 text-center animate-slide-up space-y-2">
                <DoorClosed className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="font-semibold text-slate-700">Recepción Cerrada / Fuera de Servicio</p>
                <p className="text-sm text-slate-500">El check-in no está disponible en este momento. Acércate a secretaría.</p>
              </div>
            )}
            {(checkinActive || testMode) && (
              <CheckInMethods
                user={user}
                onCheckedIn={onCheckedIn}
                sede={data.sede}
                doctorCedula={doctorCedula}
                checkLocation={checkLocation}
                simulateNear={simulateNear}
                result={result}
                geoOk={geoOk}
                geoLoading={geoLoading}
                checkInBusy={checkInBusy}
                formError={formError}
                onCheckIn={handleCheckIn}
                onShowForm={() => setShowCheckInForm(true)}
                showForm={showCheckInForm}
              />
            )}
            </>
          )}

          {todayAppts.length === 0 && !hasCheckedIn && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center animate-slide-up">
              <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium">No tienes citas para hoy</p>
              <p className="text-sm text-slate-400 mt-1">
                Revisa la pestaña de próximas citas o acércate a secretaría.
              </p>
            </div>
          )}
        </>
      )}

      {tab === 'upcoming' && (
        upcomingAppts.length > 0 ? (
          <div className="space-y-3">
            {renderAppointmentCards(upcomingAppts)}
          </div>
        ) : (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center animate-slide-up">
            <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No tienes citas próximas</p>
            <p className="text-sm text-slate-400 mt-1">
              Acércate a secretaría para agendar tu próxima consulta.
            </p>
          </div>
        )
      )}

      {/* Sede info at bottom */}
      <div className="bg-blue-50 rounded-2xl p-4 flex items-start gap-3">
        <MapPin className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-slate-700">{data.sede.name}</p>
          <p className="text-xs text-slate-500">{data.sede.address}</p>
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {confirmCancelId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-slide-up px-4"
          onClick={() => setConfirmCancelId(null)}
        >
          <div
            className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-xl text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-14 h-14 rounded-2xl bg-rose-50 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-7 h-7 text-rose-500" />
            </div>
            <h3 className="font-bold text-slate-800 text-lg mb-2">¿Cancelar esta cita?</h3>
            <p className="text-sm text-slate-500 mb-6">
              Esta acción no se puede deshacer. Se notificará a secretaría y al médico.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmCancelId(null)}
                disabled={!!cancellingId}
                className="flex-1 bg-slate-100 text-slate-600 font-semibold py-3 rounded-xl
                           hover:bg-slate-200 active:scale-[0.98] transition-all
                           disabled:opacity-50"
              >
                No, mantener
              </button>
              <button
                onClick={() => handleCancel(confirmCancelId)}
                disabled={!!cancellingId}
                className="flex-1 bg-rose-500 text-white font-semibold py-3 rounded-xl
                           hover:bg-rose-600 active:scale-[0.98] transition-all
                           disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {cancellingId ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                Sí, cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Appointment Detail Card — shows full appointment info
// before and after check-in
// ============================================================
interface AppointmentDetailCardProps {
  apt: Appointment;
  users: import('../../types').User[];
  turn: number;
  canCancel?: boolean;
  onCancel?: (aptId: string) => void;
}

function AppointmentDetailCard({ apt, users, turn, canCancel, onCancel }: AppointmentDetailCardProps) {
  // Try to find the doctor from the users list
  // The appointment might have doctor info enriched, or we infer from users
  const doctor = users.find((u) => u.role === 'doctor' && u.name === apt.doctorName);
  const doctorName = apt.doctorName || doctor?.name || 'Médico por asignar';
  const doctorSpecialty = apt.doctorSpecialty || doctor?.specialty || 'Médico General';

  const statusLabel = apt.status === 'scheduled'
    ? 'Programada - Pendiente de llegada / Check-in'
    : apt.status === 'checked-in'
      ? 'Check-in realizado - En fila de espera'
      : apt.status === 'rescheduled'
        ? 'Reagendado - Pendiente de llegada'
        : apt.status === 'called'
          ? '¡Llamado! - Presentarse en cubículo'
          : apt.status === 'in-attendance'
            ? 'En consulta'
            : apt.status;

  const statusColor = apt.status === 'scheduled'
    ? 'bg-amber-50 text-amber-700'
    : apt.status === 'checked-in'
      ? 'bg-blue-50 text-blue-800'
      : apt.status === 'rescheduled'
        ? 'bg-orange-50 text-orange-700'
        : apt.status === 'called'
          ? 'bg-red-50 text-red-700'
          : apt.status === 'in-attendance'
            ? 'bg-emerald-50 text-emerald-700'
            : apt.status === 'cancelled'
              ? 'bg-rose-50 text-rose-700'
              : 'bg-slate-100 text-slate-600';

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
      {/* Doctor info */}
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <Stethoscope className="w-6 h-6 text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-800 truncate">{doctorName}</p>
          <p className="text-sm text-blue-700">{doctorSpecialty}</p>
        </div>
      </div>

      <div className="h-px bg-slate-100" />

      {/* Date and time */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Calendar className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Fecha</p>
            <p className="text-sm font-semibold text-slate-800">
              {apt.scheduledDate ? formatDateDisplay(apt.scheduledDate) : 'Por confirmar'}
            </p>
          </div>
        </div>
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <Clock className="w-4 h-4 text-blue-700" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Hora</p>
            <p className="text-sm font-semibold text-slate-800">
              {formatTime12h(apt.scheduledTime)}
            </p>
            <p className="text-[10px] text-slate-400">Intervalo de 30 min</p>
          </div>
        </div>
      </div>

      {/* Reason */}
      {apt.reason && (
        <>
          <div className="h-px bg-slate-100" />
          <div className="flex items-start gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0">
              <FileText className="w-4 h-4 text-teal-600" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-slate-400">Motivo de la consulta</p>
              <p className="text-sm font-medium text-slate-700">{apt.reason}</p>
            </div>
          </div>
        </>
      )}

      <div className="h-px bg-slate-100" />

      {/* Status and ticket */}
      <div className="flex items-center justify-between">
        <div className="flex items-start gap-2.5">
          <div className="w-9 h-9 rounded-lg bg-slate-50 flex items-center justify-center flex-shrink-0">
            <User className="w-4 h-4 text-slate-500" />
          </div>
          <div>
            <p className="text-xs text-slate-400">Paciente</p>
            <p className="text-sm font-semibold text-slate-800">{apt.patientName}</p>
            <p className="text-xs text-slate-400 flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> CC: {apt.patientCedula}
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-xs text-slate-400">Turno</p>
          <p className="text-lg font-bold text-blue-700">#{String(turn).padStart(2, '0')}</p>
        </div>
      </div>

      {/* Status badge */}
      <div className={`rounded-xl px-4 py-3 text-sm font-semibold text-center ${statusColor}`}>
        {statusLabel}
      </div>

      {/* Arrival notice */}
      <div className="flex items-start gap-2.5 bg-amber-50 rounded-xl px-4 py-3 border border-amber-100">
        <Clock className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm font-medium text-amber-800">
          Se sugiere llegar con 30 minutos de anticipación a su cita.
        </p>
      </div>

      {/* Cancel button */}
      {canCancel && onCancel && apt.status === 'scheduled' && (
        <button
          onClick={() => onCancel(apt.id)}
          className="w-full bg-rose-50 text-rose-600 font-semibold py-3 rounded-xl
                     hover:bg-rose-100 active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2 border border-rose-200"
        >
          <XCircle className="w-5 h-5" />
          Cancelar Cita
        </button>
      )}
    </div>
  );
}

// ============================================================
// CheckInMethods — unified check-in with 3 methods (GPS, PIN, QR)
// ============================================================
type CheckinMethodTab = 'gps' | 'pin' | 'qr';

interface CheckInMethodsProps {
  user: AppUser;
  onCheckedIn: () => void;
  sede: SedeConfig;
  doctorCedula?: string;
  checkLocation: () => Promise<GeoResult>;
  simulateNear: () => void;
  result: GeoResult;
  geoOk: boolean;
  geoLoading: boolean;
  checkInBusy: boolean;
  formError: string;
  onCheckIn: () => void;
  onShowForm: () => void;
  showForm: boolean;
}

function CheckInMethods(props: CheckInMethodsProps) {
  const { user, onCheckedIn, sede, doctorCedula, checkLocation, simulateNear, result, geoOk, geoLoading, checkInBusy, formError, onCheckIn, onShowForm, showForm } = props;
  const [methodTab, setMethodTab] = useState<CheckinMethodTab>('gps');

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
      <h2 className="font-semibold text-slate-800 flex items-center gap-2">
        <CheckCircle2 className="w-5 h-5 text-blue-700" />
        Realizar Check-in
      </h2>

      <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl">
        {([
          { key: 'gps' as const, label: 'GPS', icon: MapPin },
          { key: 'pin' as const, label: 'PIN', icon: Hash },
          { key: 'qr' as const, label: 'QR', icon: QrCode },
        ]).map((t) => (
          <button
            key={t.key}
            onClick={() => setMethodTab(t.key)}
            className={`flex flex-col items-center justify-center gap-1 py-2.5 rounded-lg text-xs font-semibold transition-all ${
              methodTab === t.key
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      {methodTab === 'gps' && (
        <div className="space-y-3">
          <p className="text-sm text-slate-500">
            Cuando te encuentres físicamente en el centro de salud, verifica tu ubicación y confirma tu llegada.
          </p>

          <CheckInZoneCard sede={sede} patientCedula={user.cedula} doctorCedula={doctorCedula} />

          {!showForm ? (
            <button
              onClick={onShowForm}
              className="w-full bg-emerald-500 text-white font-semibold py-3.5 rounded-xl
                         hover:bg-emerald-600 active:scale-[0.98] transition-all
                         flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
            >
              <CheckCircle2 className="w-5 h-5" />
              Iniciar Check-in GPS
            </button>
          ) : (
            <div className="space-y-3 animate-slide-up">
              <button
                onClick={checkLocation}
                disabled={geoLoading}
                className="w-full bg-blue-700 text-white font-semibold py-3.5 rounded-xl
                           hover:bg-blue-800 active:scale-[0.98] transition-all
                           disabled:opacity-60 flex items-center justify-center gap-2 shadow-sm shadow-blue-200"
              >
                {geoLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Navigation className="w-5 h-5" />
                )}
                {geoLoading ? 'Verificando...' : 'Verificar Ubicación por GPS'}
              </button>

              <button
                onClick={simulateNear}
                className="w-full text-sm text-blue-700 py-2 rounded-lg hover:bg-blue-50 transition-colors"
              >
                O simular ubicación cerca de la sede
              </button>

              {result.status !== 'idle' && (
                <div
                  className={`p-3 rounded-xl flex items-start gap-2.5 animate-slide-up ${
                    geoOk
                      ? 'bg-emerald-50 text-emerald-800'
                      : result.status === 'too-far'
                        ? 'bg-amber-50 text-amber-800'
                        : 'bg-red-50 text-red-700'
                  }`}
                >
                  {geoOk ? (
                    <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm">{result.message}</p>
                </div>
              )}

              {formError && (
                <p className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4" />
                  {formError}
                </p>
              )}

              <button
                onClick={onCheckIn}
                disabled={!geoOk || checkInBusy}
                className="w-full bg-emerald-500 text-white font-semibold py-3.5 rounded-xl
                           hover:bg-emerald-600 active:scale-[0.98] transition-all
                           disabled:opacity-40 disabled:cursor-not-allowed
                           flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
              >
                {checkInBusy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-5 h-5" />
                )}
                Confirmar mi llegada
              </button>
            </div>
          )}
        </div>
      )}

      {methodTab === 'pin' && (
        <CheckInByCode key="pin" user={user} onCheckedIn={onCheckedIn} mode="pin" />
      )}

      {methodTab === 'qr' && (
        <CheckInByCode key="qr" user={user} onCheckedIn={onCheckedIn} mode="qr" />
      )}
    </div>
  );
}
