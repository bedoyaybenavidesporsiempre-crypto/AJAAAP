import { memo, useCallback, useState, useRef, useEffect } from 'react';
import {
  CalendarPlus,
  Search,
  UserPlus,
  CreditCard,
  Calendar,
  Clock,
  CheckCircle2,
  User as UserIcon,
  Stethoscope,
  ClipboardList,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  FileText,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { TabStrip } from '@/components/TabStrip';
import type { User as AppUser, Appointment, DoctorScheduleEntry } from '@/types';

const FALLBACK_SPECIALTIES = [
  'Médico General',
  'Médico Especialista',
  'Laboratorio - Ejecución',
  'Laboratorio - Entrega de Resultados',
];

interface SecretaryPanelProps {
  user: AppUser;
}

type Tab = 'schedule' | 'register' | 'appointments';

export function SecretaryPanel({ user: _user }: SecretaryPanelProps) {
  const { data } = useApp();
  const [tab, setTab] = useState<Tab>('schedule');

  const scheduledAppts = data.appointments
    .filter((a) => a.status === 'scheduled')
    .sort((a, b) => {
      const da = a.scheduledDate || '';
      const db = b.scheduledDate || '';
      if (da !== db) return da.localeCompare(db);
      return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
    });

  return (
    <div className="min-h-[calc(100vh-140px)] px-4 py-5 max-w-md mx-auto">
      {/* Secretary header */}
      <div className="bg-gradient-to-br from-teal-600 to-cyan-700 rounded-3xl p-5 shadow-lg mb-4 text-white animate-slide-up">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
            <ClipboardList className="w-6 h-6" />
          </div>
          <div>
            <p className="text-lg font-bold">Panel de Secretaría</p>
            <p className="text-white/60 text-sm">Agenda y registro de pacientes</p>
          </div>
        </div>
      </div>

      {/* Tab selector */}
      <TabStrip className="bg-slate-100 rounded-xl p-1 mb-4">
        {[
          { key: 'schedule' as Tab, label: 'Agendar', icon: CalendarPlus },
          { key: 'register' as Tab, label: 'Pacientes', icon: UserPlus },
          { key: 'appointments' as Tab, label: 'Citas', icon: Calendar },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              tab === t.key
                ? 'bg-white text-teal-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-600'
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </TabStrip>

      {tab === 'schedule' && <ScheduleTab />}
      {tab === 'register' && <RegisterTab />}
      {tab === 'appointments' && <AppointmentsListTab appointments={scheduledAppts} />}
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================
const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function formatDate(year: number, month: number, day: number): string {
  const m = String(month + 1).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
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

function generateFixedSlots(): string[] {
  const morning = generate30MinSlots('08:00', '12:00');
  const afternoon = generate30MinSlots('14:00', '17:00');
  return [...morning, ...afternoon];
}

const FIXED_SLOTS = generateFixedSlots();

function formatDateDisplay(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${d} de ${MONTH_LABELS[m - 1]} de ${y}`;
}

// ============================================================
// Schedule Tab — Patient autocomplete + appointment form
// with doctor per-day calendar and 30-min interval slots
// ============================================================
function ScheduleTab() {
  const { data, scheduleAppointment, getDoctorSchedule, getDisabledTimeSlots, getSpecialties } = useApp();
  const allSpecialtyNames = getSpecialties().map((s) => s.name);
  const specialtyList = allSpecialtyNames.length > 0 ? allSpecialtyNames : FALLBACK_SPECIALTIES;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<AppUser | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedSpecialty, setSelectedSpecialty] = useState<string>('');
  const [selectedDoctorCedula, setSelectedDoctorCedula] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showRegisterPrompt, setShowRegisterPrompt] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const patients = data.users.filter((u) => u.role === 'patient');
  const doctors = data.users.filter((u) => u.role === 'doctor');
  const availableSpecialties = specialtyList.filter((s) =>
    doctors.some((d) => (d.specialty ?? 'Médico General') === s),
  );
  const filteredDoctors = selectedSpecialty
    ? doctors.filter((d) => (d.specialty ?? 'Médico General') === selectedSpecialty)
    : doctors;

  const filteredPatients = searchQuery.trim()
    ? patients.filter((p) => {
        const q = searchQuery.toLowerCase().trim();
        return (
          p.name.toLowerCase().includes(q) ||
          p.cedula.includes(searchQuery.trim())
        );
      })
    : patients;

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const selectPatient = (p: AppUser) => {
    setSelectedPatient(p);
    setSearchQuery(`${p.name} — CC ${p.cedula}`);
    setShowDropdown(false);
    setShowRegisterPrompt(false);
    setError('');
  };

  const clearSelection = () => {
    setSelectedPatient(null);
    setSearchQuery('');
    setShowRegisterPrompt(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!selectedPatient) {
      setError('Selecciona un paciente de la lista de búsqueda.');
      return;
    }
    if (!selectedDoctorCedula) {
      setError('Selecciona un médico para la cita.');
      return;
    }
    if (!scheduledDate || !scheduledTime) {
      setError('Completa la fecha y hora de la cita.');
      return;
    }

    // Block same-day scheduling — minimum 1 day advance
    const todayStr = formatDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());
    if (scheduledDate === todayStr && !data.sede.allowSameDayBooking) {
      setError('No se pueden agendar citas para el día actual. Mínimo 1 día de anticipación.');
      return;
    }

    const doctorSched = getDoctorSchedule(selectedDoctorCedula);
    const daySched = doctorSched.find((s) => s.scheduleDate === scheduledDate);
    if (!daySched) {
      setError('El médico no atiende ese día. Selecciona un día verde en el calendario.');
      return;
    }

    const slots = FIXED_SLOTS;
    if (!slots.includes(scheduledTime)) {
      setError('La hora seleccionada no está dentro de los intervalos disponibles del médico.');
      return;
    }

    // Check if slot is already taken
    const takenSlots = data.appointments
      .filter(
        (a) =>
          a.scheduledDate === scheduledDate &&
          a.scheduledTime === scheduledTime &&
          (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
      )
      .map((a) => a.scheduledTime);

    if (takenSlots.includes(scheduledTime)) {
      setError('Ese intervalo ya está ocupado. Selecciona otro horario disponible.');
      return;
    }

    // Check if the slot was disabled by the doctor
    const disabledSlots = getDisabledTimeSlots(selectedDoctorCedula, scheduledDate);
    if (disabledSlots.includes(scheduledTime)) {
      setError('El médico ha desactivado este intervalo. Selecciona otro horario disponible.');
      return;
    }

    const selectedDoctor = filteredDoctors.find((d) => d.cedula === selectedDoctorCedula);

    const result = await scheduleAppointment({
      patientCedula: selectedPatient.cedula,
      patientName: selectedPatient.name,
      scheduledDate,
      scheduledTime,
      doctorCedula: selectedDoctorCedula,
      doctorName: selectedDoctor?.name,
      doctorSpecialty: selectedDoctor?.specialty,
      reason: reason.trim() || undefined,
    });

    if (result.appointment) {
      setSuccess(`Cita agendada para ${selectedPatient.name} el ${formatDateDisplay(scheduledDate)} a las ${scheduledTime}`);
      setSelectedPatient(null);
      setSearchQuery('');
      setScheduledDate('');
      setScheduledTime('');
      setReason('');
      setSelectedDoctorCedula('');
      setSelectedSpecialty('');
      setTimeout(() => setSuccess(''), 5000);
    } else {
      setError(result.error ?? 'No se pudo agendar la cita. Intenta nuevamente.');
      setTimeout(() => setError(''), 8000);
    }
  };

  const noResults = searchQuery.trim().length > 0 && filteredPatients.length === 0;

  return (
    <div className="space-y-4">
      {/* Patient search */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up">
        <h3 className="font-semibold text-slate-800 flex items-center gap-2 mb-4">
          <Search className="w-5 h-5 text-teal-600" />
          Buscar Paciente
        </h3>

        <div className="relative" ref={dropdownRef}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                setSelectedPatient(null);
                setShowRegisterPrompt(false);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Buscar por nombre o cédula..."
              className="w-full pl-11 pr-10 py-3.5 rounded-xl border border-slate-200
                         focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                         outline-none transition-all text-slate-800"
            />
            {searchQuery && (
              <button
                onClick={clearSelection}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>

          {/* Dropdown results */}
          {showDropdown && (searchQuery.trim() || !selectedPatient) && (
            <div className="absolute z-20 w-full mt-2 bg-white rounded-xl shadow-lg border border-slate-100 max-h-64 overflow-y-auto">
              {filteredPatients.map((p) => (
                <button
                  key={p.cedula}
                  onClick={() => selectPatient(p)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-teal-50 transition-colors text-left border-b border-slate-50 last:border-0"
                >
                  <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
                    <UserIcon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">CC: {p.cedula}</p>
                  </div>
                </button>
              ))}

              {noResults && (
                <div className="px-4 py-4 text-center">
                  <AlertCircle className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 mb-3">
                    No se encontró ningún paciente con "{searchQuery}"
                  </p>
                  <button
                    onClick={() => {
                      setShowDropdown(false);
                      setShowRegisterPrompt(true);
                      setSelectedPatient(null);
                    }}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700
                               bg-teal-50 px-4 py-2 rounded-lg hover:bg-teal-100 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    Registrar nuevo paciente
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Selected patient card */}
        {selectedPatient && (
          <div className="mt-4 bg-teal-50 rounded-xl p-4 flex items-center gap-3 animate-slide-up">
            <div className="w-10 h-10 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center">
              <UserIcon className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <p className="font-medium text-slate-800">{selectedPatient.name}</p>
              <p className="text-sm text-slate-500">CC: {selectedPatient.cedula}</p>
            </div>
            <button
              onClick={clearSelection}
              className="text-slate-400 hover:text-red-500 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Register prompt */}
        {showRegisterPrompt && !selectedPatient && (
          <div className="mt-4 bg-amber-50 rounded-xl p-4 animate-slide-up">
            <p className="text-sm text-amber-800 mb-2">
              Debes registrar al paciente antes de agendar la cita.
            </p>
            <RegisterInlineForm onRegistered={(u) => {
              selectPatient(u);
              setShowRegisterPrompt(false);
            }} />
          </div>
        )}
      </div>

      {/* Appointment form */}
      {selectedPatient && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4"
        >
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <CalendarPlus className="w-5 h-5 text-teal-600" />
            Datos de la Cita
          </h3>

          {/* Specialty filter */}
          <div>
            <label className="text-sm font-medium text-slate-600 mb-1.5 block">
              Especialidad / Categoría
            </label>
            <div className="grid grid-cols-2 gap-2">
              {specialtyList.map((s) => {
                const isAvailable = availableSpecialties.includes(s);
                return (
                  <button
                    key={s}
                    type="button"
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedSpecialty(s);
                      setSelectedDoctorCedula('');
                      setScheduledDate('');
                      setScheduledTime('');
                      setError('');
                    }}
                    className={`py-2.5 rounded-lg text-xs font-medium transition-all border text-center ${
                      selectedSpecialty === s
                        ? 'border-teal-400 bg-teal-50 text-teal-700'
                        : isAvailable
                          ? 'border-slate-200 text-slate-500 hover:border-slate-300'
                          : 'border-slate-100 text-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
            {availableSpecialties.length === 0 && (
              <p className="text-xs text-slate-400 mt-1.5">
                No hay médicos registrados todavía.
              </p>
            )}
          </div>

          {/* Doctor selector — filtered by specialty */}
          {selectedSpecialty && (
            <div>
              <label className="text-sm font-medium text-slate-600 mb-1.5 block">
                Médico
              </label>
              <div className="relative">
                <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <select
                  value={selectedDoctorCedula}
                  onChange={(e) => {
                    setSelectedDoctorCedula(e.target.value);
                    setScheduledDate('');
                    setScheduledTime('');
                    setError('');
                  }}
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200
                             focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                             outline-none transition-all text-slate-800 appearance-none bg-white"
                >
                  <option value="">Seleccionar médico...</option>
                  {filteredDoctors.map((doc) => (
                    <option key={doc.cedula} value={doc.cedula}>
                      {doc.name} — {doc.specialty || 'Médico General'}
                    </option>
                  ))}
                </select>
              </div>
              {filteredDoctors.length === 0 && (
                <p className="text-xs text-slate-400 mt-1.5">
                  No hay médicos disponibles en esta categoría.
                </p>
              )}
            </div>
          )}

          {/* Availability calendar — per-day with color coding */}
          {selectedDoctorCedula && (
            <DoctorDayCalendar
              schedule={getDoctorSchedule(selectedDoctorCedula)}
              appointments={data.appointments}
              selectedDate={scheduledDate}
              allowSameDay={data.sede.allowSameDayBooking}
              onSelectDate={(d) => { setScheduledDate(d); setScheduledTime(''); setError(''); }}
            />
          )}

          {/* Same-day warning */}
          {selectedDoctorCedula && !data.sede.allowSameDayBooking && (
            <div className="bg-amber-50 rounded-xl p-3 flex items-start gap-2.5 animate-slide-up">
              <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                Las citas deben agendarse con mínimo 1 día de anticipación. El día actual no está disponible para selección.
              </p>
            </div>
          )}

          {/* 30-min interval slot selector */}
          {selectedDoctorCedula && scheduledDate && (
            <SlotSelector
              schedule={getDoctorSchedule(selectedDoctorCedula)}
              appointments={data.appointments}
              selectedDate={scheduledDate}
              selectedTime={scheduledTime}
              onSelectTime={(t) => { setScheduledTime(t); setError(''); }}
              disabledSlots={getDisabledTimeSlots(selectedDoctorCedula, scheduledDate)}
            />
          )}

          {/* Reason / motivo de consulta */}
          {selectedDoctorCedula && scheduledDate && scheduledTime && (
            <div className="animate-slide-up">
              <label className="text-sm font-medium text-slate-600 mb-1.5 block">
                Motivo de la consulta
              </label>
              <div className="relative">
                <FileText className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ej. Control de presión arterial, Dolor de cabeza..."
                  className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200
                             focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                             outline-none transition-all text-slate-800"
                />
              </div>
              <p className="text-xs text-slate-400 mt-1.5">
                Este motivo será visible para el paciente en su panel.
              </p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3.5 flex items-start gap-2.5 animate-slide-up">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-red-700">No se pudo agendar la cita</p>
                <p className="text-sm text-red-600 mt-0.5">{error}</p>
              </div>
              <button
                type="button"
                onClick={() => setError('')}
                className="text-red-400 hover:text-red-600 flex-shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {success && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3.5 flex items-start gap-2.5 animate-slide-up">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm font-medium text-emerald-700 flex-1">{success}</p>
            </div>
          )}

          <button
            type="submit"
            className="w-full bg-teal-600 text-white font-semibold py-3.5 rounded-xl
                       hover:bg-teal-700 active:scale-[0.98] transition-all
                       flex items-center justify-center gap-2 shadow-sm shadow-teal-200"
          >
            <CalendarPlus className="w-5 h-5" />
            Agendar Cita
          </button>
        </form>
      )}
    </div>
  );
}

// ============================================================
// Doctor Day Calendar — shows doctor's per-day schedule
// Green: scheduled day with available 30-min slots
// Red: scheduled day but all slots taken
// White: not a working day (blocked)
// ============================================================
interface DoctorDayCalendarProps {
  schedule: DoctorScheduleEntry[];
  appointments: Appointment[];
  selectedDate: string;
  allowSameDay: boolean;
  onSelectDate: (date: string) => void;
}

const CalendarDayCell = memo(function CalendarDayCell({
  day,
  dateStr,
  disabled,
  cellClass,
  onSelect,
}: {
  day: number;
  dateStr: string;
  disabled: boolean;
  cellClass: string;
  onSelect: (dateStr: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(dateStr)}
      className={`aspect-square rounded-lg text-xs font-medium transition-all flex items-center justify-center touch-manipulation ${cellClass}`}
    >
      {day}
    </button>
  );
});

function DoctorDayCalendar({ schedule, appointments, selectedDate, allowSameDay, onSelectDate }: DoctorDayCalendarProps) {
  const onSelectRef = useRef(onSelectDate);
  onSelectRef.current = onSelectDate;
  const handleSelect = useCallback((d: string) => onSelectRef.current(d), []);
  const today = new Date();
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  const scheduleMap = new Map(schedule.map((s) => [s.scheduleDate, s]));

  const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoPrev = new Date(viewYear, viewMonth - 1, 1) >= currentMonthStart;
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= new Date(today.getFullYear(), today.getMonth() + 6, 1);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  const isUnavailableDay = (day: number): boolean => {
    const dateObj = new Date(viewYear, viewMonth, day);
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    return allowSameDay ? dateObj < todayMidnight : dateObj <= todayMidnight;
  };

  const getDayStatus = (day: number): 'available' | 'full' | 'off' | 'past' => {
    if (isUnavailableDay(day)) return 'past';
    const dateStr = formatDate(viewYear, viewMonth, day);
    const daySched = scheduleMap.get(dateStr);
    if (!daySched) return 'off';

    const totalSlots = FIXED_SLOTS.length;
    const takenSlots = appointments.filter(
      (a) =>
        a.scheduledDate === dateStr &&
        (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
    ).length;

    return takenSlots >= totalSlots ? 'full' : 'available';
  };

  const prevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };

  const nextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  return (
    <div className="bg-slate-50 rounded-xl p-4 space-y-3 animate-slide-up">
      {/* Legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-emerald-400" /> Disponible
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-400" /> Cupo lleno
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-white border border-slate-200" /> No labora
        </span>
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
          onClick={nextMonth}
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
          const dateStr = formatDate(viewYear, viewMonth, day);
          const isSelected = selectedDate === dateStr;

          let cellClass = 'bg-white border border-slate-200 text-slate-300 cursor-not-allowed';
          if (status === 'available') cellClass = 'bg-emerald-400 border border-emerald-400 text-white hover:bg-emerald-500';
          if (status === 'full') cellClass = 'bg-red-400 border border-red-400 text-white cursor-not-allowed';
          if (status === 'past') cellClass = 'bg-slate-50 border border-slate-100 text-slate-200 cursor-not-allowed';
          if (isSelected) cellClass += ' ring-2 ring-teal-400 ring-offset-1';

          return (
            <CalendarDayCell
              key={idx}
              day={day}
              dateStr={dateStr}
              disabled={status === 'full' || status === 'off' || status === 'past'}
              cellClass={cellClass}
              onSelect={handleSelect}
            />
          );
        })}
      </div>

      {/* Selected date info */}
      {selectedDate && scheduleMap.has(selectedDate) && (
        <div className="bg-white rounded-lg p-2.5 text-center">
          <p className="text-sm text-slate-600">
            Fecha: <span className="font-semibold text-slate-800">{formatDateDisplay(selectedDate)}</span>
          </p>
          <p className="text-xs text-slate-400 mt-0.5">
            Horario Mañana: 08:00 AM - 12:00 PM · Horario Tarde: 02:00 PM - 05:00 PM
          </p>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Slot Selector — 30-minute intervals within the doctor's
// time range, with taken slots disabled
// ============================================================
interface SlotSelectorProps {
  schedule: DoctorScheduleEntry[];
  appointments: Appointment[];
  selectedDate: string;
  selectedTime: string;
  onSelectTime: (time: string) => void;
  disabledSlots: string[];
}

function SlotSelector({ schedule, appointments, selectedDate, selectedTime, onSelectTime, disabledSlots }: SlotSelectorProps) {
  const daySched = schedule.find((s) => s.scheduleDate === selectedDate);

  if (!daySched) {
    return (
      <div className="bg-amber-50 rounded-xl p-3 text-center animate-slide-up">
        <p className="text-sm text-amber-700">El médico no atiende este día.</p>
      </div>
    );
  }

  const allSlots = FIXED_SLOTS;
  const takenSlots = new Set(
    appointments
      .filter(
        (a) =>
          a.scheduledDate === selectedDate &&
          (a.status === 'scheduled' || a.status === 'checked-in' || a.status === 'rescheduled'),
      )
      .map((a) => a.scheduledTime),
  );
  const disabledSet = new Set(disabledSlots);

  const availableCount = allSlots.filter((s) => !takenSlots.has(s) && !disabledSet.has(s)).length;

  const renderSlot = (slot: string) => {
    const isTaken = takenSlots.has(slot);
    const isDisabled = disabledSet.has(slot);
    const isSelected = selectedTime === slot;
    const isBlocked = isTaken || isDisabled;

    let cls = 'bg-white border-slate-200 text-slate-600 hover:border-teal-300 hover:bg-teal-50';
    if (isTaken) cls = 'bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed line-through';
    else if (isDisabled) cls = 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed';
    else if (isSelected) cls = 'bg-teal-600 border-teal-600 text-white shadow-sm';

    return (
      <button
        key={slot}
        type="button"
        disabled={isBlocked}
        onClick={() => onSelectTime(slot)}
        className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${cls}`}
      >
        {slot}
      </button>
    );
  };

  return (
    <div className="bg-white rounded-xl p-4 border border-slate-100 animate-slide-up space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          <Clock className="w-4 h-4 text-teal-600" />
          Intervalos disponibles (30 min)
        </p>
        <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
          {availableCount} disponibles
        </span>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2">
          {allSlots.slice(0, 8).map(renderSlot)}
        </div>
        <div className="grid grid-cols-3 gap-2">
          {allSlots.slice(8).map(renderSlot)}
        </div>
      </div>

      {availableCount === 0 && (
        <p className="text-sm text-red-500 text-center">
          Todos los intervalos de este día están ocupados o desactivados.
        </p>
      )}
    </div>
  );
}

// ============================================================
// Register Tab — Register new patients
// ============================================================
function RegisterTab() {
  const { data, addUser } = useApp();
  const [name, setName] = useState('');
  const [cedula, setCedula] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !cedula.trim()) {
      setError('Completa nombre y cédula.');
      return;
    }
    if (data.users.some((u) => u.cedula === cedula.trim())) {
      setError('Ya existe un paciente con esa cédula.');
      return;
    }

    await addUser({ cedula: cedula.trim(), name: name.trim(), role: 'patient' });
    setSuccess(`Paciente ${name.trim()} registrado exitosamente.`);
    setName('');
    setCedula('');
    setTimeout(() => setSuccess(''), 4000);
  };

  const registeredPatients = data.users.filter((u) => u.role === 'patient');

  return (
    <div className="space-y-4">
      <form
        onSubmit={handleAdd}
        className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-3"
      >
        <h3 className="font-semibold text-slate-800 flex items-center gap-2">
          <UserPlus className="w-5 h-5 text-teal-600" />
          Registrar Nuevo Paciente
        </h3>

        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">
            Nombre completo
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            placeholder="Ej. Juan Pérez"
            className="w-full px-4 py-3 rounded-xl border border-slate-200
                       focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                       outline-none transition-all text-slate-800"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-600 mb-1.5 block">
            Documento de identificación
          </label>
          <div className="relative">
            <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              inputMode="numeric"
              value={cedula}
              onChange={(e) => { setCedula(e.target.value.replace(/\D/g, '')); setError(''); }}
              placeholder="Ej. 12345678"
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200
                         focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                         outline-none transition-all text-slate-800"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && (
          <p className="text-sm text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {success}
          </p>
        )}

        <button
          type="submit"
          className="w-full bg-teal-600 text-white font-semibold py-3 rounded-xl
                     hover:bg-teal-700 active:scale-[0.98] transition-all
                     flex items-center justify-center gap-2"
        >
          <UserPlus className="w-5 h-5" />
          Registrar Paciente
        </button>
      </form>

      {/* Patient list */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up">
        <h3 className="font-semibold text-slate-800 mb-3">
          Pacientes registrados ({registeredPatients.length})
        </h3>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {registeredPatients.map((p) => (
            <div
              key={p.cedula}
              className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <UserIcon className="w-4 h-4" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-800 truncate">{p.name}</p>
                <p className="text-xs text-slate-400">CC: {p.cedula}</p>
              </div>
            </div>
          ))}
          {registeredPatients.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-4">
              No hay pacientes registrados.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Inline registration form (used in the schedule tab)
// ============================================================
function RegisterInlineForm({ onRegistered }: { onRegistered: (u: AppUser) => void }) {
  const { data, addUser } = useApp();
  const [name, setName] = useState('');
  const [cedula, setCedula] = useState('');
  const [err, setErr] = useState('');

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    if (!name.trim() || !cedula.trim()) {
      setErr('Completa nombre y cédula.');
      return;
    }
    if (data.users.some((u) => u.cedula === cedula.trim())) {
      setErr('Ya existe un paciente con esa cédula.');
      return;
    }
    const newPatient = { cedula: cedula.trim(), name: name.trim(), role: 'patient' as const };
    await addUser(newPatient);
    onRegistered(newPatient);
  };

  return (
    <form onSubmit={handleAdd} className="space-y-2.5 mt-2">
      <input
        type="text"
        value={name}
        onChange={(e) => { setName(e.target.value); setErr(''); }}
        placeholder="Nombre del paciente"
        className="w-full px-3 py-2.5 rounded-lg border border-amber-200
                   focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                   outline-none transition-all text-slate-800 text-sm"
      />
      <input
        type="text"
        inputMode="numeric"
        value={cedula}
        onChange={(e) => { setCedula(e.target.value.replace(/\D/g, '')); setErr(''); }}
        placeholder="Cédula"
        className="w-full px-3 py-2.5 rounded-lg border border-amber-200
                   focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                   outline-none transition-all text-slate-800 text-sm"
      />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button
        type="submit"
        className="w-full bg-teal-600 text-white text-sm font-semibold py-2.5 rounded-lg
                   hover:bg-teal-700 transition-colors flex items-center justify-center gap-1.5"
      >
        <UserPlus className="w-4 h-4" />
        Registrar y seleccionar
      </button>
    </form>
  );
}

// ============================================================
// Appointments list tab
// ============================================================
function AppointmentsListTab({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) {
    return (
      <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 animate-slide-up text-center">
        <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">No hay citas agendadas.</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up">
      <h3 className="font-semibold text-slate-800 mb-3">
        Citas agendadas ({appointments.length})
      </h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {appointments.map((a) => (
          <div
            key={a.id}
            className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
          >
            <div className="w-10 h-10 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center flex-shrink-0">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-800 truncate">{a.patientName}</p>
              <p className="text-xs text-slate-400">
                CC: {a.patientCedula} · Turno #{a.ticketNumber}
              </p>
              {a.reason && (
                <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                  <FileText className="w-3 h-3" /> {a.reason}
                </p>
              )}
            </div>
            <div className="text-right flex-shrink-0">
              <p className="text-sm font-semibold text-slate-700">{a.scheduledTime}</p>
              {a.scheduledDate && (
                <p className="text-xs text-slate-400">{a.scheduledDate}</p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
