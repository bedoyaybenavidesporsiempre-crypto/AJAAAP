export interface GeoPosition {
  lat: number;
  lng: number;
  accuracy: number;
}

export const TEST_FALLBACK_POSITION: GeoPosition = { lat: 11.2255, lng: -74.1864, accuracy: 10 };

export const ACCURACY_THRESHOLD_METERS = 50;

const HIGH_ACCURACY_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

const NO_GEOLOCATION_MESSAGE = 'Geolocalización no disponible en este dispositivo.';

export function describeGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado (PERMISSION_DENIED). Permite el acceso a tu ubicación en el navegador.';
    case error.POSITION_UNAVAILABLE:
      return 'Ubicación no disponible (POSITION_UNAVAILABLE). Revisa que el GPS esté encendido.';
    case error.TIMEOUT:
      return 'Tiempo agotado al obtener tu ubicación (TIMEOUT). Intenta de nuevo.';
    default:
      return 'No se pudo acceder a tu ubicación.';
  }
}

export function isPositionPrecise(pos: GeolocationPosition): boolean {
  return pos.coords.accuracy <= ACCURACY_THRESHOLD_METERS;
}

export function toGeoPosition(pos: GeolocationPosition): GeoPosition {
  return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
}

function getPositionOnce(enableHighAccuracy: boolean): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error(NO_GEOLOCATION_MESSAGE));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (enableHighAccuracy && !isPositionPrecise(pos)) {
          reject(new Error(
            `Precisión insuficiente (${Math.round(pos.coords.accuracy)}m). Se requieren ${ACCURACY_THRESHOLD_METERS}m o menos.`,
          ));
          return;
        }
        resolve(toGeoPosition(pos));
      },
      (err) => reject(new Error(describeGeolocationError(err))),
      enableHighAccuracy ? HIGH_ACCURACY_OPTIONS : { enableHighAccuracy: false, timeout: 10000, maximumAge: 0 },
    );
  });
}

export function readPosition(testMode: boolean): Promise<GeoPosition> {
  return getPositionOnce(true)
    .catch(() => getPositionOnce(false))
    .catch((err: Error) => {
      if (testMode) return TEST_FALLBACK_POSITION;
      throw err;
    });
}
