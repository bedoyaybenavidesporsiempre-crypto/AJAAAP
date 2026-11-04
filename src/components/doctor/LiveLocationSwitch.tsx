import { MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { useLiveLocationSharing } from '@/hooks/useLiveLocationSharing';

interface LiveLocationSwitchProps {
  doctorCedula: string;
}

export function LiveLocationSwitch({ doctorCedula }: LiveLocationSwitchProps) {
  const { data } = useApp();
  const { sharing, error, setShareEnabled } = useLiveLocationSharing(doctorCedula, data.sede.allowSameDayBooking);

  return (
    <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-4 animate-slide-up">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
            <MapPin className="w-4.5 h-4.5 text-blue-700" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-800 text-sm">Compartir ubicación en vivo</p>
            <p className="text-xs text-slate-500">
              {sharing
                ? 'Los pacientes ven tu ubicación actual.'
                : 'Los pacientes ven el centro de atención.'}
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={sharing}
          onClick={() => setShareEnabled(!sharing)}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${
            sharing ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              sharing ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}
