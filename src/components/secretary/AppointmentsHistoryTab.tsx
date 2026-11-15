import { useState } from 'react';
import { Calendar, Search, XCircle } from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../../types';
import { toLocalDateStr } from '../../lib/cutoff';

type DateFilter = 'today' | '1d' | '1w' | '1m' | '1y';

const DATE_FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'today', label: 'Hoy' },
  { key: '1d', label: 'Hace 1 día' },
  { key: '1w', label: 'Hace 1 semana' },
  { key: '1m', label: 'Hace 1 mes' },
  { key: '1y', label: 'Hace 1 año' },
];

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendada',
  'checked-in': 'Check-in',
  called: 'Llamado',
  'in-attendance': 'En consulta',
  attended: 'Atendida',
  absent: 'Ausente',
  rescheduled: 'Reagendada',
  cancelled: 'Cancelada',
};

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-50 text-amber-700',
  'checked-in': 'bg-blue-50 text-blue-800',
  called: 'bg-red-50 text-red-700',
  'in-attendance': 'bg-emerald-50 text-emerald-700',
  attended: 'bg-slate-100 text-slate-600',
  absent: 'bg-rose-50 text-rose-700',
  rescheduled: 'bg-orange-50 text-orange-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

function getDateStart(filter: DateFilter, today: Date): string {
  const start = new Date(today);
  start.setHours(0, 0, 0, 0);
  switch (filter) {
    case 'today':
      return toLocalDateStr(start);
    case '1d':
      start.setDate(start.getDate() - 1);
      return toLocalDateStr(start);
    case '1w':
      start.setDate(start.getDate() - 7);
      return toLocalDateStr(start);
    case '1m':
      start.setMonth(start.getMonth() - 1);
      return toLocalDateStr(start);
    case '1y':
      start.setFullYear(start.getFullYear() - 1);
      return toLocalDateStr(start);
  }
}

interface AppointmentsHistoryTabProps {
  appointments: Appointment[];
}

export function AppointmentsHistoryTab({ appointments }: AppointmentsHistoryTabProps) {
  const [dateFilter, setDateFilter] = useState<DateFilter>('1m');
  const [searchQuery, setSearchQuery] = useState('');
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const rangeStart = getDateStart(dateFilter, today);

  const rows = appointments
    .filter((a) => a.status !== 'cancelled')
    .filter((a) => !!a.scheduledDate && a.scheduledDate >= rangeStart)
    .filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        a.patientName.toLowerCase().includes(q) ||
        a.patientCedula.includes(searchQuery.trim())
      );
    })
    .sort(
      (a, b) =>
        (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '') ||
        a.scheduledTime.localeCompare(b.scheduledTime),
    );

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre o cédula..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200
                     focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                     outline-none transition-all text-slate-800 text-sm"
        />
      </div>

      {/* Quick date filters */}
      <div className="flex gap-2 flex-wrap">
        {DATE_FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setDateFilter(f.key)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              dateFilter === f.key
                ? 'bg-teal-600 text-white shadow-sm'
                : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-slate-800">Citas Agendadas ({rows.length})</h3>
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No hay citas en este periodo.</p>
        </div>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                <th className="py-2 pr-3 font-medium">Paciente</th>
                <th className="py-2 pr-3 font-medium">Médico</th>
                <th className="py-2 pr-3 font-medium">Fecha y hora</th>
                <th className="py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b border-slate-50 last:border-0 align-top">
                  <td className="py-2.5 pr-3">
                    <p className="font-medium text-slate-800">{a.patientName}</p>
                    <p className="text-xs text-slate-400">CC: {a.patientCedula}</p>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{a.doctorName || 'Por asignar'}</td>
                  <td className="py-2.5 pr-3 whitespace-nowrap">
                    <p className={`font-semibold ${a.scheduledDate === todayStr ? 'text-teal-700' : 'text-slate-800'}`}>
                      {a.scheduledDate === todayStr ? 'Hoy' : a.scheduledDate}
                    </p>
                    <p className="text-xs text-slate-400">{a.scheduledTime}</p>
                  </td>
                  <td className="py-2.5">
                    <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap ${STATUS_STYLES[a.status]}`}>
                      {STATUS_LABELS[a.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Cancelled Appointments Tab
// ============================================================
interface CancelledAppointmentsTabProps {
  appointments: Appointment[];
}

export function CancelledAppointmentsTab({ appointments }: CancelledAppointmentsTabProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const rows = appointments
    .filter((a) => a.status === 'cancelled')
    .filter((a) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        a.patientName.toLowerCase().includes(q) ||
        a.patientCedula.includes(searchQuery.trim())
      );
    })
    .sort((a, b) => (b.cancelledAt ?? 0) - (a.cancelledAt ?? 0));

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        <XCircle className="w-5 h-5 text-rose-500" />
        Citas Canceladas ({rows.length})
      </h3>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nombre o cédula..."
          className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200
                     focus:border-teal-400 focus:ring-2 focus:ring-teal-100
                     outline-none transition-all text-slate-800 text-sm"
        />
      </div>

      {rows.length === 0 ? (
        <div className="py-8 text-center">
          <XCircle className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 text-sm">No hay citas canceladas.</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((a) => (
            <div
              key={a.id}
              className="rounded-xl border border-slate-100 p-3.5 bg-rose-50/30"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <p className="font-medium text-slate-800">{a.patientName}</p>
                  <p className="text-xs text-slate-400">CC: {a.patientCedula}</p>
                </div>
                <span className="inline-block rounded-md px-2 py-0.5 text-xs font-semibold whitespace-nowrap bg-rose-50 text-rose-700">
                  Cancelada
                </span>
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                <span><strong className="text-slate-600">Fecha:</strong> {a.scheduledDate || 'Sin fecha'}</span>
                <span><strong className="text-slate-600">Hora:</strong> {a.scheduledTime}</span>
                {a.doctorName && <span><strong className="text-slate-600">Médico:</strong> {a.doctorName}</span>}
                {a.cancelledBy && (
                  <span><strong className="text-slate-600">Cancelada por:</strong> {a.cancelledBy === 'patient' ? 'Paciente' : 'Secretaría'}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
