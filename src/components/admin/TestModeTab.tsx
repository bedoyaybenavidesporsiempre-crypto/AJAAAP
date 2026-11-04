import { useState, useEffect, useCallback } from 'react';
import { FlaskConical, Loader2, MapPin, QrCode, Power } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { DEFAULT_SEDE } from '@/data/mockData';
import type { CheckinMethod } from '@/types';

interface SedeConfigRow {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  consultation_minutes: number;
  same_day_booking: boolean;
  allow_weekend_booking: boolean;
}

const DEFAULT_ROW: SedeConfigRow = {
  id: 1,
  name: DEFAULT_SEDE.name,
  address: DEFAULT_SEDE.address,
  lat: DEFAULT_SEDE.lat,
  lng: DEFAULT_SEDE.lng,
  consultation_minutes: DEFAULT_SEDE.consultationMinutes,
  same_day_booking: false,
  allow_weekend_booking: false,
};

async function ensureSedeRow(): Promise<void> {
  const { data } = await supabase
    .from('sede_config')
    .select('id')
    .eq('id', 1)
    .maybeSingle();
  if (!data) {
    await supabase.from('sede_config').insert({
      id: 1,
      name: DEFAULT_SEDE.name,
      address: DEFAULT_SEDE.address,
      lat: DEFAULT_SEDE.lat,
      lng: DEFAULT_SEDE.lng,
      consultation_minutes: DEFAULT_SEDE.consultationMinutes,
      same_day_booking: false,
      allow_weekend_booking: false,
    });
  }
}

interface TestSwitchProps {
  title: string;
  description: string;
  statusOn: string;
  statusOff: string;
  field: 'same_day_booking' | 'allow_weekend_booking';
}

function TestSwitch({ title, description, statusOn, statusOff, field }: TestSwitchProps) {
  const [enabled, setEnabled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('sede_config')
      .select('same_day_booking, allow_weekend_booking')
      .eq('id', 1)
      .maybeSingle();
    const row = data as { same_day_booking: boolean; allow_weekend_booking: boolean } | null;
    setEnabled(row ? row[field] : false);
    setLoaded(true);
  }, [field]);

  useEffect(() => {
    (async () => {
      await ensureSedeRow();
      await refresh();
    })();
  }, [refresh]);

  const handleClick = async () => {
    if (busy) return;
    const next = !enabled;
    setBusy(true);
    try {
      const { data, error } = await supabase
        .from('sede_config')
        .update({ [field]: next, updated_at: new Date().toISOString() })
        .eq('id', 1)
        .select('same_day_booking, allow_weekend_booking')
        .maybeSingle();

      if (error || !data) {
        setEnabled(!next);
        return;
      }

      const row = data as { same_day_booking: boolean; allow_weekend_booking: boolean };
      setEnabled(row[field]);
    } catch {
      setEnabled(!next);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{title}</p>
          <p className="text-xs text-slate-500 mt-0.5">{description}</p>
        </div>
        <button
          role="switch"
          aria-checked={enabled}
          onClick={handleClick}
          disabled={busy}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            enabled ? 'bg-emerald-500' : 'bg-slate-300'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              enabled ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <p className="text-xs text-slate-400">{enabled ? statusOn : statusOff}</p>
    </div>
  );
}

function CheckinMethodSelector() {
  const [method, setMethod] = useState<CheckinMethod>('gps');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('sede_config')
      .select('checkin_method')
      .eq('id', 1)
      .maybeSingle();
    const row = data as { checkin_method: string } | null;
    setMethod(row && row.checkin_method === 'code' ? 'code' : 'gps');
    setLoaded(true);
  }, []);

  useEffect(() => {
    (async () => {
      await ensureSedeRow();
      await refresh();
    })();
  }, [refresh]);

  const handleSelect = async (next: CheckinMethod) => {
    if (busy || next === method) return;
    setBusy(true);
    setMethod(next);
    try {
      const { error } = await supabase
        .from('sede_config')
        .update({ checkin_method: next, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) setMethod(method === 'code' ? 'gps' : 'code');
    } catch {
      setMethod(method === 'code' ? 'gps' : 'code');
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">Método de Check-in</p>
          <p className="text-xs text-slate-500 mt-0.5">Cargando...</p>
        </div>
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="font-semibold text-slate-800 text-sm">Método de Check-in</p>
      </div>
      <p className="text-xs text-slate-500">
        Selecciona cómo los pacientes confirman su llegada a la sala de espera.
      </p>
      <div className="grid grid-cols-2 gap-2 mt-2">
        <button
          onClick={() => handleSelect('gps')}
          disabled={busy}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all border ${
            method === 'gps'
              ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          } disabled:opacity-60`}
        >
          <MapPin className="w-4 h-4" />
          GPS
        </button>
        <button
          onClick={() => handleSelect('code')}
          disabled={busy}
          className={`flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all border ${
            method === 'code'
              ? 'border-blue-600 bg-blue-50 text-blue-800 shadow-sm'
              : 'border-slate-200 text-slate-500 hover:bg-slate-50'
          } disabled:opacity-60`}
        >
          <QrCode className="w-4 h-4" />
          Código (PIN/QR)
        </button>
      </div>
      <p className="text-xs text-slate-400">
        {method === 'gps'
          ? 'Activo: los pacientes verifican su ubicación por GPS para hacer check-in.'
          : 'Activo: los pacientes ingresan el PIN o escanean el QR de la pantalla de la sala de espera.'}
      </p>
    </div>
  );
}

function CheckinActiveSwitch() {
  const [active, setActive] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('sede_config')
      .select('is_active')
      .eq('id', 1)
      .maybeSingle();
    const row = data as { is_active: boolean } | null;
    setActive(row ? row.is_active !== false : true);
    setLoaded(true);
  }, []);

  useEffect(() => {
    (async () => {
      await ensureSedeRow();
      await refresh();
    })();
  }, [refresh]);

  const handleToggle = async () => {
    if (busy) return;
    const next = !active;
    setBusy(true);
    setActive(next);
    try {
      const { error } = await supabase
        .from('sede_config')
        .update({ is_active: next, updated_at: new Date().toISOString() })
        .eq('id', 1);
      if (error) setActive(!next);
    } catch {
      setActive(!next);
    } finally {
      setBusy(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex items-center justify-between gap-3 py-1">
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 text-sm">Estado del Check-in</p>
          <p className="text-xs text-slate-500 mt-0.5">Cargando...</p>
        </div>
        <Loader2 className="w-5 h-5 text-slate-300 animate-spin flex-shrink-0" />
      </div>
    );
  }

  return (
    <div className={`space-y-2 rounded-xl p-3 border ${active ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-300 bg-slate-100'}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex items-center gap-2">
          <Power className={`w-4 h-4 flex-shrink-0 ${active ? 'text-emerald-600' : 'text-slate-400'}`} />
          <div>
            <p className="font-semibold text-slate-800 text-sm">Estado del Check-in</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Pausa el check-in al finalizar la jornada.
            </p>
          </div>
        </div>
        <button
          role="switch"
          aria-checked={active}
          onClick={handleToggle}
          disabled={busy}
          className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
            active ? 'bg-emerald-500' : 'bg-slate-400'
          }`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
              active ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>
      <p className={`text-xs font-medium ${active ? 'text-emerald-700' : 'text-slate-500'}`}>
        {active
          ? 'Activo: los pacientes pueden hacer check-in normalmente.'
          : 'Pausado: Recepción Cerrada / Fuera de Servicio. El check-in está inhabilitado.'}
      </p>
    </div>
  );
}

export function TestModeTab() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-5">
      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
        <FlaskConical className="w-5 h-5 text-blue-700" />
        Prueba Test
      </h3>
      <CheckinActiveSwitch />
      <CheckinMethodSelector />
      <TestSwitch
        title="Agendar citas para hoy"
        description="Desactiva temporalmente la regla de un día de anticipación para demostraciones en vivo."
        statusOn="Activo: la secretaria puede agendar citas para el día de hoy."
        statusOff="Inactivo: se requiere al menos un día de anticipación."
        field="same_day_booking"
      />
      <TestSwitch
        title="Permitir citas en fines de semana"
        description="Habilita o deshabilita el agendamiento los sábados y domingos."
        statusOn="Activo: se pueden agendar citas los sábados y domingos."
        statusOff="Inactivo: solo se agendan citas de lunes a viernes."
        field="allow_weekend_booking"
      />
    </div>
  );
}
