import { useState } from 'react';
import { Calendar } from 'lucide-react';
import type { Appointment, AppointmentStatus } from '../../types';
import { toLocalDateStr } from '../../lib/cutoff';

const RANGE_OPTIONS = [
  { months: 1, label: 'Último mes' },
  { months: 3, label: 'Últimos 3 meses' },
  { months: 12, label: 'Último año' },
];

const STATUS_LABELS: Record<AppointmentStatus, string> = {
  scheduled: 'Agendada',
  'checked-in': 'Check-in',
  called: 'Llamado',
  'in-attendance': 'En consulta',
  attended: 'Atendida',
  absent: 'Ausente',
  rescheduled: 'Reagendada',
};

const STATUS_STYLES: Record<AppointmentStatus, string> = {
  scheduled: 'bg-amber-50 text-amber-700',
  'checked-in': 'bg-blue-50 text-blue-800',
  called: 'bg-red-50 text-red-700',
  'in-attendance': 'bg-emerald-50 text-emerald-700',
  attended: 'bg-slate-100 text-slate-600',
  absent: 'bg-rose-50 text-rose-700',
  rescheduled: 'bg-orange-50 text-orange-700',
};

function getRangeStart(months: number, today: Date): string {
  const start = new Date(today);
  start.setMonth(start.getMonth() - months);
  return toLocalDateStr(start);
}

export function AppointmentsHistoryTab({ appointments }: { appointments: Appointment[] }) {
  const [months, setMonths] = useState(1);
  const today = new Date();
  const todayStr = toLocalDateStr(today);
  const rangeStart = getRangeStart(months, today);

  const rows = appointments
    .filter((a) => !!a.scheduledDate && a.scheduledDate >= rangeStart)
    .sort(
      (a, b) =>
        (a.scheduledDate ?? '').localeCompare(b.scheduledDate ?? '') ||
        a.scheduledTime.localeCompare(b.scheduledTime),
    );

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold text-slate-800">Citas ({rows.length})</h3>
        <select
          aria-label="Periodo"
          value={months}
          onChange={(e) => setMonths(Number(e.target.value))}
          className="rounded-lg border-2 border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:border-teal-600 outline-none"
        >
          {RANGE_OPTIONS.map((opt) => (
            <option key={opt.months} value={opt.months}>
              {opt.label}
            </option>
          ))}
        </select>
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
