import { useState, useCallback } from 'react';
import { calculateDistance, isWithinGeofence } from '../lib/distance';
import { readPosition } from '../lib/geolocation';

export type GeoStatus = 'idle' | 'checking' | 'success' | 'too-far' | 'error' | 'simulated';

export interface GeoResult {
  status: GeoStatus;
  distance: number | null;
  message: string;
}

export const CHECKIN_RADIUS_METERS = 100;

export function useGeolocation(sedeLat: number, sedeLng: number, testMode: boolean) {
  const [result, setResult] = useState<GeoResult>({
    status: 'idle',
    distance: null,
    message: '',
  });
  const [loading, setLoading] = useState(false);

  const checkLocation = useCallback((): Promise<GeoResult> => {
    setLoading(true);
    return readPosition(testMode).then(
      (position) => {
        const distance = calculateDistance(position.lat, position.lng, sedeLat, sedeLng);
        const withinRange = isWithinGeofence(distance, CHECKIN_RADIUS_METERS);
        const r: GeoResult = {
          status: withinRange ? 'success' : 'too-far',
          distance: Math.round(distance),
          message: withinRange
            ? `Estás a ${Math.round(distance)}m de la sede. Check-in autorizado.`
            : `Estás a ${Math.round(distance)}m de la sede. Acércate a menos de ${CHECKIN_RADIUS_METERS}m para hacer check-in.`,
        };
        setResult(r);
        setLoading(false);
        return r;
      },
      (err: Error) => {
        const r: GeoResult = { status: 'error', distance: null, message: err.message };
        setResult(r);
        setLoading(false);
        return r;
      },
    );
  }, [sedeLat, sedeLng, testMode]);

  const simulateNear = useCallback(() => {
    const r: GeoResult = {
      status: 'simulated',
      distance: 75,
      message: 'Ubicación simulada: a 75m de la sede. Check-in autorizado.',
    };
    setResult(r);
  }, []);

  const reset = useCallback(() => {
    setResult({ status: 'idle', distance: null, message: '' });
  }, []);

  return { result, loading, checkLocation, simulateNear, reset };
}
