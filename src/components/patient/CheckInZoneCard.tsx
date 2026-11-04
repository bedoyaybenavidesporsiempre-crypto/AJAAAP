import { MapPin } from 'lucide-react';
import type { SedeConfig } from '../../types';
import { useOwnPosition } from '../../hooks/useOwnPosition';
import { usePatientLocationPublishing } from '../../hooks/usePatientLiveLocation';

interface CheckInZoneCardProps {
  sede: SedeConfig;
  patientCedula: string;
  doctorCedula?: string;
}

export function CheckInZoneCard({ sede, patientCedula, doctorCedula }: CheckInZoneCardProps) {
  const own = useOwnPosition(true, sede.allowSameDayBooking);
  usePatientLocationPublishing(patientCedula, doctorCedula, true, own.position);

  return (
    <div className="bg-blue-50 rounded-xl p-3">
      <div className="flex items-start gap-2.5">
        <MapPin className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{sede.name}</p>
          <p className="text-sm text-slate-500">{sede.address}</p>
        </div>
      </div>
    </div>
  );
}
