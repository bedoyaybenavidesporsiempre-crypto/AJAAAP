import { Radio, MapPin } from 'lucide-react';
import type { SedeConfig } from '../../types';
import { usePatientLiveLocation } from '../../hooks/usePatientLiveLocation';
import { useOwnPosition } from '../../hooks/useOwnPosition';
import { calculateDistance, formatDistance } from '../../lib/distance';

interface PatientDistanceNoticeProps {
  patientCedula: string;
  sede: SedeConfig;
}

export function PatientDistanceNotice({ patientCedula, sede }: PatientDistanceNoticeProps) {
  const patientLive = usePatientLiveLocation(patientCedula);
  const own = useOwnPosition(true, sede.allowSameDayBooking);

  const distance =
    own.position && patientLive
      ? calculateDistance(own.position.lat, own.position.lng, patientLive.lat, patientLive.lng)
      : null;

  let text: string;
  if (distance !== null) {
    text = formatDistance(distance);
  } else if (!patientLive) {
    text = 'Esperando la ubicación en vivo del paciente...';
  } else {
    text = own.error || 'Obteniendo tu ubicación...';
  }

  return (
    <div className="flex items-center justify-between gap-3 bg-blue-50 rounded-xl px-3 py-2.5 mt-3">
      <p className="flex items-center gap-1.5 text-xs text-slate-600">
        <Radio className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
        Distancia al paciente (en vivo)
      </p>
      <p className="text-sm font-semibold text-slate-800 text-right">{text}</p>
    </div>
  );
}
