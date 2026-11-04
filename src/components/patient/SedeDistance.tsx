import { MapPin } from 'lucide-react';
import type { SedeConfig } from '../../types';
import { useOwnPosition } from '../../hooks/useOwnPosition';
import { calculateDistance, formatDistance } from '../../lib/distance';

interface SedeDistanceProps {
  sede: SedeConfig;
}

export function SedeDistance({ sede }: SedeDistanceProps) {
  const own = useOwnPosition(true, sede.allowSameDayBooking);

  let text: string;
  if (own.position) {
    text = formatDistance(
      calculateDistance(own.position.lat, own.position.lng, sede.lat, sede.lng),
    );
  } else {
    text = own.error || 'Obteniendo tu ubicación...';
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <span className="text-sm text-white/80 flex items-center gap-1.5">
        <MapPin className="w-3.5 h-3.5" />
        Distancia al centro de atención
      </span>
      <span className="font-bold text-right">{text}</span>
    </div>
  );
}
