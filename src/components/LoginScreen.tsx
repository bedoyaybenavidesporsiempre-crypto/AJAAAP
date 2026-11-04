import { useState } from 'react';
import { CreditCard, ArrowRight, AlertCircle, Loader2, MapPin } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { AppLogoMark } from '@/components/FastyTurnLogo';

export function LoginScreen() {
  const { login, data } = useApp();
  const [cedula, setCedula] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!cedula.trim()) {
      setError('Ingresa tu número de documento de identificación.');
      return;
    }
    setLoading(true);
    const user = await login(cedula);
    if (!user) {
      setError('Documento no encontrado. Verifica el número e intenta de nuevo.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50/70 to-white/70 flex flex-col px-4 py-8 max-w-md mx-auto">
      {/* Logo with solid white backdrop so animated particles don't show through */}
      <div className="mt-6 mb-8 animate-slide-up">
        <div className="bg-white rounded-3xl px-8 py-7 shadow-sm border border-slate-100 flex flex-col items-center gap-3">
          <AppLogoMark size={96} />
          <p className="text-slate-500 text-sm">Citas Médicas Sincronizadas</p>
        </div>
      </div>

      {/* Sede info */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 mb-6 animate-slide-up flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <MapPin className="w-5 h-5 text-blue-700" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-800 text-sm">{data.sede.name}</p>
          <p className="text-sm text-slate-500">{data.sede.address}</p>
        </div>
      </div>

      {/* Login form */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100 animate-slide-up"
      >
        <h2 className="font-bold text-slate-800 mb-1">Iniciar Sesión</h2>
        <p className="text-sm text-slate-500 mb-4">
          Ingresa tu documento de identificación para continuar.
        </p>

        <label className="text-sm font-medium text-slate-600 mb-1.5 block">
          Documento de identificación
        </label>
        <div className="relative">
          <CreditCard className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            inputMode="numeric"
            value={cedula}
            onChange={(e) => {
              setCedula(e.target.value.replace(/\D/g, ''));
              setError('');
            }}
            placeholder="Ej. 12345678"
            className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200
                       focus:border-blue-600 focus:ring-2 focus:ring-blue-100
                       outline-none transition-all text-slate-800 text-lg tracking-wide"
            autoFocus
          />
        </div>

        {error && (
          <p className="text-sm text-red-600 mt-3 flex items-center gap-1.5 animate-slide-up">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full mt-4 bg-blue-700 text-white font-semibold py-3.5 rounded-xl
                     hover:bg-blue-800 active:scale-[0.98] transition-all
                     disabled:opacity-60 flex items-center justify-center gap-2
                     shadow-sm shadow-blue-200"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Ingresar
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>

    </div>
  );
}
