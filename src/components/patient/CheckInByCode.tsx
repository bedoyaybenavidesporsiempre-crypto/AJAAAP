import { useEffect, useRef, useState } from 'react';
import type { Html5Qrcode as ScannerInstance } from 'html5-qrcode';
import {
  QrCode,
  Hash,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Camera,
  CameraOff,
  RefreshCw,
} from 'lucide-react';
import { useActiveCheckinCode } from '../../hooks/useCheckinCode';
import { useApp } from '../../context/AppContext';
import { useGeolocation } from '../../hooks/useGeolocation';
import type { User as AppUser, Appointment } from '../../types';
import { toLocalDateStr } from '../../lib/cutoff';

interface CheckInByCodeProps {
  user: AppUser;
  onCheckedIn: () => void;
}

type CheckinMode = 'pin' | 'qr';
type ScannerState = 'idle' | 'starting' | 'scanning' | 'error' | 'denied';

const SCANNER_ELEMENT_ID = 'checkin-qr-reader';

function extractToken(decodedText: string): string {
  try {
    const parsed = JSON.parse(decodedText) as { qr?: unknown };
    if (typeof parsed.qr === 'string') return parsed.qr.trim();
  } catch {
    return decodedText.trim();
  }
  return decodedText.trim();
}

function isPermissionError(err: unknown): boolean {
  const name = err instanceof Error ? err.name : '';
  const message = err instanceof Error ? err.message : String(err);
  return name === 'NotAllowedError' || /permission|denied|notallowed/i.test(message);
}

async function releaseScanner(scanner: ScannerInstance | null) {
  if (!scanner) return;
  try {
    if (scanner.isScanning) await scanner.stop();
    scanner.clear();
  } catch {
    // Scanner was already stopped
  }
}

export function CheckInByCode({ user, onCheckedIn }: CheckInByCodeProps) {
  const { isValid, loading: validating } = useActiveCheckinCode();
  const { checkIn, data } = useApp();
  const { result } = useGeolocation(data.sede.lat, data.sede.lng, data.sede.allowSameDayBooking);

  const [mode, setMode] = useState<CheckinMode>('pin');
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [scannerState, setScannerState] = useState<ScannerState>('idle');
  const [choices, setChoices] = useState<Appointment[]>([]);
  const [pendingToken, setPendingToken] = useState('');

  const scannerRef = useRef<ScannerInstance | null>(null);
  const handledRef = useRef(false);
  const onDecodeRef = useRef<(decodedText: string) => void>(() => {});

  const stopCamera = () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    return releaseScanner(scanner);
  };

  const validateAppointmentTime = (apt: Appointment, todayStr: string): string | null => {
    if (apt.scheduledDate !== todayStr) {
      return `Tu cita es el ${apt.scheduledDate}. Solo puedes hacer check-in el día de tu cita.`;
    }
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(apt.scheduledTime);
    if (!timeMatch) return 'La hora de tu cita no es válida. Consulta en recepción.';
    if (!data.sede.checkinTimeRestriction) return null;
    const nowDate = new Date();
    const scheduledAt = new Date(nowDate);
    scheduledAt.setHours(Number(timeMatch[1]), Number(timeMatch[2]), 0, 0);
    if (scheduledAt.getTime() - nowDate.getTime() > 30 * 60 * 1000) {
      return `El check-in se habilita 30 minutos antes de tu cita (${apt.scheduledTime}).`;
    }
    return null;
  };

  const checkInAppointment = async (apt: Appointment) => {
    setBusy(true);
    setError('');
    const gpsDistance = result.distance ?? 0;
    const checked = await checkIn(user.cedula, user.name, gpsDistance, 'code', apt.id);
    setBusy(false);
    if (checked) {
      setChoices([]);
      onCheckedIn();
      return true;
    }
    setError('No se pudo registrar el check-in. Intenta de nuevo.');
    return false;
  };

  const processToken = async (token: string): Promise<boolean> => {
    setBusy(true);
    setError('');
    setChoices([]);

    const valid = await isValid(token);
    if (!valid) {
      setError('El código no es válido o ya expiró. Revisa la pantalla en la sala de espera.');
      setBusy(false);
      return false;
    }

    const candidates = data.appointments.filter(
      (a) =>
        a.patientCedula === user.cedula &&
        (a.status === 'scheduled' || a.status === 'rescheduled'),
    );
    if (candidates.length === 0) {
      setError('No tienes una cita agendada.');
      setBusy(false);
      return false;
    }
    if (candidates.length > 1) {
      setPendingToken(token);
      setChoices(candidates);
      setBusy(false);
      return true;
    }

    const nowDate = new Date();
    const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
    const timeError = validateAppointmentTime(candidates[0], todayStr);
    if (timeError) {
      setError(timeError);
      setBusy(false);
      return false;
    }
    return checkInAppointment(candidates[0]);
  };

  const handleChoose = async (apt: Appointment) => {
    setBusy(true);
    setError('');
    const valid = await isValid(pendingToken);
    if (!valid) {
      setChoices([]);
      setError('El código no es válido o ya expiró. Revisa la pantalla en la sala de espera.');
      setBusy(false);
      return;
    }
    const nowDate = new Date();
    const todayStr = `${nowDate.getFullYear()}-${String(nowDate.getMonth() + 1).padStart(2, '0')}-${String(nowDate.getDate()).padStart(2, '0')}`;
    const timeError = validateAppointmentTime(apt, todayStr);
    if (timeError) {
      setError(timeError);
      setBusy(false);
      return;
    }
    await checkInAppointment(apt);
  };

  useEffect(() => {
    onDecodeRef.current = (decodedText: string) => {
      setScannerState('idle');
      void stopCamera()
        .then(() => processToken(extractToken(decodedText)))
        .then((checkedIn) => {
          if (!checkedIn) void startCamera();
        });
    };
  });

  useEffect(() => {
    return () => {
      void releaseScanner(scannerRef.current);
      scannerRef.current = null;
    };
  }, []);

  const startCamera = async () => {
    handledRef.current = false;
    setScannerState('starting');
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID, { verbose: false });
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: 220, aspectRatio: 1 },
        (decodedText) => {
          if (handledRef.current) return;
          handledRef.current = true;
          onDecodeRef.current(decodedText);
        },
        () => {}
      );
      setScannerState('scanning');
    } catch (err) {
      await stopCamera();
      setScannerState(isPermissionError(err) ? 'denied' : 'error');
    }
  };

  const handleStartCamera = () => {
    setError('');
    void startCamera();
  };

  const handleStopCamera = async () => {
    await stopCamera();
    setScannerState('idle');
  };

  const selectMode = (next: CheckinMode) => {
    if (next === mode) return;
    void stopCamera();
    setScannerState('idle');
    setError('');
    setInput('');
    setChoices([]);
    setMode(next);
  };

  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Ingresa el código PIN mostrado en la pantalla.');
      return;
    }
    void processToken(trimmed);
  };

  const cameraOverlayIcon =
    scannerState === 'starting' ? (
      <Loader2 className="w-10 h-10 animate-spin text-white" />
    ) : scannerState === 'denied' || scannerState === 'error' ? (
      <CameraOff className="w-10 h-10 text-red-300" />
    ) : (
      <Camera className="w-10 h-10 text-white/70" />
    );

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 animate-slide-up space-y-4">
      <h2 className="font-semibold text-slate-800 flex items-center gap-2">
        <QrCode className="w-5 h-5 text-blue-700" />
        Check-in por Código Rotatorio
      </h2>
      <p className="text-sm text-slate-500">
        Ingresa el código PIN de 4 dígitos o escanea el código QR que aparece en la pantalla de la sala de espera.
        El código cambia cada 5 minutos.
      </p>

      <div className="flex gap-2">
        <button
          onClick={() => selectMode('pin')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            mode === 'pin'
              ? 'bg-blue-700 text-white shadow-sm shadow-blue-200'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          <Hash className="w-4 h-4" />
          Código PIN
        </button>
        <button
          onClick={() => selectMode('qr')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-sm transition-all ${
            mode === 'qr'
              ? 'bg-blue-700 text-white shadow-sm shadow-blue-200'
              : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
          }`}
        >
          <QrCode className="w-4 h-4" />
          Código QR
        </button>
      </div>

      {choices.length > 0 && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-slate-700">Tienes varias citas. Elige a cuál quieres hacer check-in:</p>
          {choices.map((apt) => {
            const todayStr = toLocalDateStr(new Date());
            const isToday = apt.scheduledDate === todayStr;
            return (
              <button
                key={apt.id}
                onClick={() => void handleChoose(apt)}
                disabled={busy || !isToday}
                className="w-full flex items-center justify-between rounded-xl border-2 border-slate-200 px-4 py-3 text-left hover:border-blue-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="text-sm font-semibold text-slate-800">{apt.scheduledTime}</span>
                <span className="text-xs text-slate-500">
                  {isToday ? 'Hoy' : `Solo disponible el ${apt.scheduledDate}`}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {mode === 'pin' ? (
        <form onSubmit={handlePinSubmit} className="space-y-3">
          <input
            type="text"
            inputMode="numeric"
            maxLength={4}
            value={input}
            onChange={(e) => {
              setInput(e.target.value.replace(/\D/g, '').slice(0, 4));
              setError('');
            }}
            placeholder="0000"
            className="w-full text-center text-3xl font-extrabold tracking-[0.5em] font-mono py-4 rounded-xl border-2 border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 outline-none transition-all text-slate-800"
          />

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy || validating || !input.trim()}
            className="w-full bg-emerald-500 text-white font-semibold py-3.5 rounded-xl
                       hover:bg-emerald-600 active:scale-[0.98] transition-all
                       disabled:opacity-40 disabled:cursor-not-allowed
                       flex items-center justify-center gap-2 shadow-sm shadow-emerald-200"
          >
            {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
            {busy ? 'Validando...' : 'Confirmar Check-in'}
            {!busy && <ArrowRight className="w-4 h-4" />}
          </button>
        </form>
      ) : (
        <div className="space-y-3">
          <div className="relative mx-auto w-full max-w-[280px] aspect-square rounded-2xl overflow-hidden bg-slate-900">
            <div id={SCANNER_ELEMENT_ID} className="w-full h-full" />
            {scannerState !== 'scanning' && (
              <div className="absolute inset-0 flex items-center justify-center">{cameraOverlayIcon}</div>
            )}
          </div>

          {busy && (
            <p className="text-sm text-slate-600 flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Validando código...
            </p>
          )}

          {!busy && scannerState === 'idle' && (
            <button
              onClick={handleStartCamera}
              className="w-full bg-blue-700 text-white font-semibold py-3.5 rounded-xl
                         hover:bg-blue-800 active:scale-[0.98] transition-all
                         flex items-center justify-center gap-2 shadow-sm shadow-blue-200"
            >
              <Camera className="w-5 h-5" />
              Activar Cámara
            </button>
          )}

          {!busy && scannerState === 'starting' && (
            <p className="text-sm text-slate-500 text-center">Iniciando cámara...</p>
          )}

          {!busy && scannerState === 'scanning' && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500 text-center">Apunta la cámara al código QR de la pantalla.</p>
              <button
                onClick={handleStopCamera}
                className="w-full border-2 border-slate-200 text-slate-700 font-semibold py-3 rounded-xl
                           hover:bg-slate-50 active:scale-[0.98] transition-all"
              >
                Detener cámara
              </button>
            </div>
          )}

          {!busy && (scannerState === 'denied' || scannerState === 'error') && (
            <div className="rounded-xl bg-red-50 border border-red-100 p-4 space-y-3">
              <p className="text-sm text-red-700 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                {scannerState === 'denied'
                  ? 'No diste permiso para usar la cámara. Habilítalo en la configuración de tu navegador o ingresa el código PIN de 4 dígitos.'
                  : 'No se pudo iniciar la cámara de tu dispositivo. Intenta de nuevo o ingresa el código PIN de 4 dígitos.'}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={handleStartCamera}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-red-200 text-red-700 font-semibold py-2.5 rounded-lg text-sm hover:bg-red-50 transition-all"
                >
                  <RefreshCw className="w-4 h-4" />
                  Reintentar
                </button>
                <button
                  onClick={() => selectMode('pin')}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm hover:bg-blue-800 transition-all"
                >
                  <Hash className="w-4 h-4" />
                  Usar PIN
                </button>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
