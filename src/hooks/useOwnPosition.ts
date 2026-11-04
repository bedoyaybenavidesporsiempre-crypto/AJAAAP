import { useEffect, useState } from 'react';
import { type GeoPosition, TEST_FALLBACK_POSITION, describeGeolocationError, isPositionPrecise, toGeoPosition } from '@/lib/geolocation';

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export function useOwnPosition(enabled: boolean, testMode: boolean) {
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!enabled) {
      setPosition(null);
      setError('');
      return;
    }
    if (!navigator.geolocation) {
      if (testMode) {
        setPosition(TEST_FALLBACK_POSITION);
        setError('');
      } else {
        setError('Geolocalización no disponible en este dispositivo.');
      }
      return;
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (!isPositionPrecise(pos)) {
          setError(`Lectura imprecisa (${Math.round(pos.coords.accuracy)}m). Esperando mejor señal GPS...`);
          return;
        }
        setError('');
        setPosition(toGeoPosition(pos));
      },
      (err) => {
        if (testMode) {
          setError('');
          setPosition(TEST_FALLBACK_POSITION);
          return;
        }
        setPosition(null);
        setError(describeGeolocationError(err));
      },
      HIGH_ACCURACY_OPTIONS,
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, testMode]);

  return { position, error };
}
