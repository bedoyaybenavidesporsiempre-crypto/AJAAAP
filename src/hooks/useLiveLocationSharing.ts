import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { TEST_FALLBACK_POSITION, describeGeolocationError } from '@/lib/geolocation';

const HEARTBEAT_MS = 15000;

interface SharedPosition {
  lat: number;
  lng: number;
}

export function useLiveLocationSharing(doctorCedula: string, testMode: boolean) {
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState('');
  const watchIdRef = useRef<number | null>(null);
  const lastPositionRef = useRef<SharedPosition | null>(null);

  const publish = useCallback(
    async (isSharing: boolean, position: SharedPosition | null) => {
      const { error: upsertError } = await supabase
        .from('doctor_live_location')
        .upsert(
          {
            doctor_cedula: doctorCedula,
            lat: position?.lat ?? null,
            lng: position?.lng ?? null,
            is_sharing: isSharing,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'doctor_cedula' },
        );
      if (upsertError) {
        setError('No se pudo guardar el estado de tu ubicación. Intenta de nuevo.');
      }
    },
    [doctorCedula],
  );

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const setShareEnabled = useCallback(
    async (enabled: boolean) => {
      setError('');
      if (!enabled) {
        stopWatching();
        lastPositionRef.current = null;
        setSharing(false);
        await publish(false, null);
        return;
      }
      if (!navigator.geolocation) {
        if (!testMode) {
          setError('Geolocalización no disponible en este dispositivo.');
          return;
        }
        setSharing(true);
        lastPositionRef.current = TEST_FALLBACK_POSITION;
        await publish(true, TEST_FALLBACK_POSITION);
        return;
      }
      stopWatching();
      setSharing(true);
      await publish(true, null);
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
          lastPositionRef.current = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          publish(true, lastPositionRef.current);
        },
        (err) => {
          if (testMode) {
            lastPositionRef.current = TEST_FALLBACK_POSITION;
            publish(true, TEST_FALLBACK_POSITION);
            return;
          }
          stopWatching();
          lastPositionRef.current = null;
          setSharing(false);
          setError(describeGeolocationError(err));
          publish(false, null);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
      );
    },
    [publish, stopWatching, testMode],
  );

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('doctor_live_location')
      .select('is_sharing')
      .eq('doctor_cedula', doctorCedula)
      .maybeSingle()
      .then(({ data, error: readError }) => {
        if (cancelled) return;
        if (readError) {
          setError('No se pudo cargar el estado de tu ubicación.');
          return;
        }
        if (data?.is_sharing) setShareEnabled(true);
      });
    return () => {
      cancelled = true;
      stopWatching();
    };
  }, [doctorCedula, setShareEnabled, stopWatching]);

  useEffect(() => {
    if (!sharing) return;
    const id = window.setInterval(() => {
      if (lastPositionRef.current) publish(true, lastPositionRef.current);
    }, HEARTBEAT_MS);
    return () => window.clearInterval(id);
  }, [sharing, publish]);

  return { sharing, error, setShareEnabled };
}
