import { MapPin, Navigation } from 'lucide-react';
import type { SedeConfig } from '@/types';
import { CHECKIN_RADIUS_METERS } from '@/hooks/useGeolocation';
import { useOwnPosition } from '@/hooks/useOwnPosition';
import { usePatientLocationPublishing } from '@/hooks/usePatientLiveLocation';
import { calculateDistance, formatDistance } from '@/lib/distance';

interface CheckInZoneCardProps {
  sede: SedeConfig;
  patientCedula: string;
  doctorCedula?: string;
}

export function CheckInZoneCard({ sede, patientCedula, doctorCedula }: CheckInZoneCardProps) {
  const own = useOwnPosition(true, sede.allowSameDayBooking);
  usePatientLocationPublishing(patientCedula, doctorCedula, true, own.position);

  const distance = own.position
    ? calculateDistance(own.position.lat, own.position.lng, sede.lat, sede.lng)
    : null;

  let distanceText: string;
  if (distance !== null) {
    distanceText = formatDistance(distance);
  } else {
    distanceText = own.error || 'Obteniendo tu ubicación...';
  }

  return (
    <div className="bg-blue-50 rounded-xl p-3">
      <div className="flex items-start gap-2.5">
        <MapPin className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{sede.name}</p>
          <p className="text-sm text-slate-500">{sede.address}</p>
          <p className="text-xs text-blue-700 mt-1">
            Zona de check-in: {CHECKIN_RADIUS_METERS}m a la redonda
          </p>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-blue-100 flex items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-slate-600">
          <Navigation className="w-3.5 h-3.5 text-blue-700" />
          Ver distancia al centro de atención
        </p>
        <p className="text-sm font-semibold text-slate-800 text-right">{distanceText}</p>
      </div>
    </div>
  );
}
