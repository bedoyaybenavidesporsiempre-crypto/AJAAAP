import { useDoctorLiveLocation } from '@/hooks/useDoctorLiveLocation';
import { useOwnPosition } from '@/hooks/useOwnPosition';
import { calculateDistance, formatDistance } from '@/lib/distance';

interface DoctorLiveDistanceProps {
  doctorCedula: string | undefined;
  testMode: boolean;
}

export function DoctorLiveDistance({ doctorCedula, testMode }: DoctorLiveDistanceProps) {
  const doctorLive = useDoctorLiveLocation(doctorCedula);
  const own = useOwnPosition(true, testMode);

  let text: string;
  if (!doctorLive) {
    text = 'El médico no comparte su ubicación en este momento';
  } else if (own.position) {
    text = formatDistance(
      calculateDistance(own.position.lat, own.position.lng, doctorLive.lat, doctorLive.lng),
    );
  } else {
    text = own.error || 'Obteniendo tu ubicación...';
  }

  return (
    <div className="flex items-center justify-between gap-3 pt-1">
      <span className="text-sm text-white/80">Distancia al médico (en vivo)</span>
      <span className="font-bold text-right">{text}</span>
    </div>
  );
}
