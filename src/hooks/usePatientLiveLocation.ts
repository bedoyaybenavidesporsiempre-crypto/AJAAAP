import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { GeoPosition } from '../lib/geolocation';
import { ACCURACY_THRESHOLD_METERS } from '../lib/geolocation';

export interface PatientLiveLocation {
  lat: number;
  lng: number;
  updatedAt: number;
}

const POLL_MS = 20000;

function isPrecise(pos: GeoPosition): boolean {
  return pos.accuracy <= ACCURACY_THRESHOLD_METERS;
}

export function usePatientLocationPublishing(
  patientCedula: string,
  doctorCedula: string | undefined,
  enabled: boolean,
  position: GeoPosition | null,
) {
  useEffect(() => {
    if (!enabled || !position || !doctorCedula) return;
    if (!isPrecise(position)) return;
    supabase
      .from('patient_live_location')
      .upsert(
        {
          patient_cedula: patientCedula,
          doctor_cedula: doctorCedula,
          lat: position.lat,
          lng: position.lng,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'patient_cedula' },
      )
      .then(({ error }) => {
        if (error) console.error('No se pudo publicar la ubicación del paciente', error.message);
      });
  }, [enabled, position, patientCedula, doctorCedula]);

  useEffect(() => {
    if (enabled) return;
    supabase.from('patient_live_location').delete().eq('patient_cedula', patientCedula).then(() => undefined);
  }, [enabled, patientCedula]);

  useEffect(() => {
    return () => {
      supabase.from('patient_live_location').delete().eq('patient_cedula', patientCedula).then(() => undefined);
    };
  }, [patientCedula]);
}

export function usePatientLiveLocation(patientCedula: string | undefined): PatientLiveLocation | null {
  const [location, setLocation] = useState<PatientLiveLocation | null>(null);

  useEffect(() => {
    if (!patientCedula) {
      setLocation(null);
      return;
    }
    let cancelled = false;

    const load = async () => {
      const { data, error } = await supabase
        .from('patient_live_location')
        .select('lat, lng, updated_at')
        .eq('patient_cedula', patientCedula)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setLocation(null);
        return;
      }
      setLocation({ lat: data.lat, lng: data.lng, updatedAt: new Date(data.updated_at).getTime() });
    };

    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [patientCedula]);

  return location;
}
