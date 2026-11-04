import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface DoctorLiveLocation {
  lat: number;
  lng: number;
  updatedAt: number;
}

const POLL_MS = 10000;
const STALE_MS = 60000;

export async function fetchDoctorLiveLocation(doctorCedula: string): Promise<DoctorLiveLocation | null> {
  const { data, error } = await supabase
    .from('doctor_live_location')
    .select('lat, lng, is_sharing, updated_at')
    .eq('doctor_cedula', doctorCedula)
    .maybeSingle();
  if (error || !data || !data.is_sharing || data.lat == null || data.lng == null) return null;
  const updatedAt = new Date(data.updated_at).getTime();
  if (Date.now() - updatedAt > STALE_MS) return null;
  return { lat: data.lat, lng: data.lng, updatedAt };
}

export function useDoctorLiveLocation(doctorCedula: string | undefined): DoctorLiveLocation | null {
  const [location, setLocation] = useState<DoctorLiveLocation | null>(null);

  useEffect(() => {
    if (!doctorCedula) {
      setLocation(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      const next = await fetchDoctorLiveLocation(doctorCedula);
      if (!cancelled) setLocation(next);
    };
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [doctorCedula]);

  return location;
}
