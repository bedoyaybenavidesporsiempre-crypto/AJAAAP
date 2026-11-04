import { useState, useEffect, useMemo, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Lock, Hash, Clock, Maximize2, LogOut, Loader2, AlertTriangle, DoorClosed } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCheckinActive } from '@/hooks/useCheckinActive';
import { AppLogoMark } from '@/components/FastyTurnLogo';

const ACCESS_CODE = '05062023';
const STORAGE_KEY = 'tv-codes-auth';

interface DbCheckinCode {
  pin: string;
  qr_code: string;
  expires_at: string;
  updated_at: string;
}

export function TvCodesScreen() {
  const [authed, setAuthed] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === ACCESS_CODE) setAuthed(true);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim() === ACCESS_CODE) {
      sessionStorage.setItem(STORAGE_KEY, ACCESS_CODE);
      setAuthed(true);
      setError('');
    } else {
      setError('Clave incorrecta. Acceso denegado.');
    }
  };

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-6">
        <div className="w-full max-w-sm">
          <div className="flex flex-col items-center mb-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-white/10 ring-1 ring-white/10 mb-4">
              <AppLogoMark size={40} className="" />
            </div>
            <h1 className="text-xl font-extrabold text-white">Vista Previa de Códigos</h1>
            <p className="text-sm text-slate-400 mt-1">Ingresa la clave de acceso para continuar</p>
          </div>

          <form
            onSubmit={handleLogin}
            className="bg-slate-800/50 rounded-2xl p-6 border border-slate-700 space-y-4"
          >
            <div>
              <label className="text-sm font-medium text-slate-300 mb-1.5 block">
                Clave de acceso
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-500" />
                <input
                  type="password"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setError('');
                  }}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full pl-11 pr-4 py-3 rounded-xl bg-slate-900 border border-slate-700
                             focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20
                             outline-none transition-all text-white text-lg tracking-wider font-mono"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                {error}
              </p>
            )}

            <button
              type="submit"
              className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl
                         hover:bg-blue-700 active:scale-[0.98] transition-all
                         flex items-center justify-center gap-2 shadow-lg shadow-blue-600/20"
            >
              <Lock className="w-5 h-5" />
              Ingresar
            </button>
          </form>
        </div>
      </div>
    );
  }

  return <TvCodesPreview onLogout={() => { sessionStorage.removeItem(STORAGE_KEY); setAuthed(false); setCode(''); }} />;
}

function TvCodesPreview({ onLogout }: { onLogout: () => void }) {
  const [code, setCode] = useState<DbCheckinCode | null>(null);
  const { active: checkinActive, loading: activeLoading } = useCheckinActive();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const containerRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCode = async () => {
    const { data, error: err } = await supabase
      .from('checkin_codes')
      .select('pin, qr_code, expires_at, updated_at')
      .eq('id', 1)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    if (!data) {
      setError('No hay código activo.');
      setLoading(false);
      return;
    }
    setCode(data as DbCheckinCode);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    fetchCode();
    timerRef.current = setInterval(fetchCode, 5000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const countdown = useMemo(() => {
    if (!code || !checkinActive) return 0;
    const remaining = new Date(code.expires_at).getTime() - now;
    return Math.max(0, Math.floor(remaining / 1000));
  }, [code, now, checkinActive]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  const qrPayload = useMemo(() => {
    if (!code) return '';
    return JSON.stringify({ qr: code.qr_code, pin: code.pin });
  }, [code]);

  const handleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
      </div>
    );
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-950/50 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <AppLogoMark size={28} className="" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Vista Previa</p>
            <h1 className="text-lg font-extrabold leading-tight">Códigos de Check-in</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleFullscreen}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-700 active:scale-95 transition-all"
          >
            <Maximize2 className="w-4 h-4" />
            <span className="hidden sm:inline">Pantalla Completa</span>
          </button>
          <button
            onClick={onLogout}
            className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400 hover:bg-red-500/20 active:scale-95 transition-all"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Salir</span>
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-center justify-center p-6">
        {!activeLoading && !checkinActive ? (
          <div className="flex flex-col items-center justify-center text-center">
            <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center mb-6">
              <DoorClosed className="w-12 h-12 text-slate-500" />
            </div>
            <h2 className="text-3xl font-extrabold text-slate-300 mb-2">Recepción Cerrada</h2>
            <p className="text-lg text-slate-500">Fuera de Servicio</p>
            <p className="text-sm text-slate-600 mt-3 max-w-sm">
              El check-in está pausado. El sistema de códigos está inhabilitado temporalmente.
            </p>
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-500/40 rounded-2xl px-8 py-6 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3" />
            <p className="text-red-400 font-semibold text-lg">{error}</p>
          </div>
        ) : code ? (
          <div className="flex flex-col lg:flex-row items-center gap-10">
            {/* QR */}
            <div className="flex flex-col items-center gap-4">
              <div className="bg-white rounded-3xl p-6 shadow-2xl shadow-blue-500/10">
                <QRCodeSVG
                  value={qrPayload}
                  size={260}
                  level="M"
                  marginSize={0}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>
              <p className="text-sm text-slate-400 font-medium">Código QR rotatorio</p>
            </div>

            {/* PIN + Countdown */}
            <div className="flex flex-col items-center gap-6">
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Hash className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Código PIN</span>
                </div>
                <div className="flex gap-3">
                  {code.pin.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-20 h-24 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-5xl font-extrabold text-blue-400 font-mono shadow-lg"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-slate-400">
                  <Clock className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Próxima renovación</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`text-5xl font-extrabold font-mono ${countdown <= 30 ? 'text-amber-400' : 'text-white'}`}>
                    {String(mins).padStart(2, '0')}
                  </span>
                  <span className="text-3xl text-slate-600 font-bold">:</span>
                  <span className={`text-5xl font-extrabold font-mono ${countdown <= 30 ? 'text-amber-400' : 'text-white'}`}>
                    {String(secs).padStart(2, '0')}
                  </span>
                </div>
                <div className="w-56 h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${countdown <= 30 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${(countdown / 300) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
