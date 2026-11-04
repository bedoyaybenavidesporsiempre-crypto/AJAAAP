import { useEffect, useState } from 'react';
import { MapPin } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import type { SedeConfig } from '@/types';

interface SedeOption {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
}

interface SedeSelectorProps {
  activeName: string;
  onSelect: (sede: Pick<SedeConfig, 'name' | 'address' | 'lat' | 'lng'>) => void;
}

export function SedeSelector({ activeName, onSelect }: SedeSelectorProps) {
  const [sedes, setSedes] = useState<SedeOption[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('sedes')
      .select('id, name, address, lat, lng')
      .order('name')
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) {
          setError('No se pudo cargar la lista de sedes.');
          return;
        }
        setSedes((data ?? []) as SedeOption[]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const activeId = sedes.find((s) => s.name === activeName)?.id ?? '';

  const handleChange = (id: string) => {
    const selected = sedes.find((s) => s.id === id);
    if (!selected) return;
    onSelect({ name: selected.name, address: selected.address, lat: selected.lat, lng: selected.lng });
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-600 mb-1.5 flex items-center gap-1.5">
        <MapPin className="w-4 h-4 text-blue-700" />
        Sede activa
      </label>
      <select
        value={activeId}
        onChange={(e) => handleChange(e.target.value)}
        className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white
                   focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                   outline-none transition-all text-slate-800"
      >
        {!activeId && <option value="">Sede personalizada</option>}
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      {error ? (
        <p className="text-xs text-red-600 mt-1.5">{error}</p>
      ) : (
        <p className="text-xs text-slate-400 mt-1.5">
          Al elegir una sede, sus coordenadas se usan para el check-in y la distancia.
        </p>
      )}
    </div>
  );
}
