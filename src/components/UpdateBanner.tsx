import { useState, useEffect } from 'react';
import { RefreshCw, X, Sparkles } from 'lucide-react';

export function UpdateBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const handler = () => setShow(true);
    window.addEventListener('sw-update-available', handler);

    // Also check on mount: if there's a waiting worker already
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/').then((reg) => {
        if (reg?.waiting && navigator.serviceWorker.controller) {
          setShow(true);
        }
      }).catch(() => {});
    }

    return () => window.removeEventListener('sw-update-available', handler);
  }, []);

  if (!show) return null;

  const handleUpdate = () => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistration('/').then((reg) => {
        if (reg?.waiting) {
          reg.waiting.postMessage({ type: 'SKIP_WAITING' });
        } else {
          window.location.reload();
        }
      }).catch(() => {
        window.location.reload();
      });
    } else {
      window.location.reload();
    }
  };

  return (
    <div className="fixed top-0 inset-x-0 z-[200] animate-slide-up">
      <div className="max-w-md mx-auto mt-3 mx-3 rounded-2xl shadow-xl border border-blue-100 overflow-hidden"
           style={{ backgroundColor: '#21638b' }}>
        <div className="flex items-center gap-3 p-3.5">
          <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white">Nueva actualización disponible</p>
            <p className="text-xs text-white/80 mt-0.5">
              Hemos mejorado AJA' APP. Actualiza para disfrutar de las últimas novedades.
            </p>
          </div>
          <button
            onClick={() => setShow(false)}
            className="text-white/60 hover:text-white p-1.5 rounded-lg hover:bg-white/10 transition-colors flex-shrink-0"
            aria-label="Cerrar aviso"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <button
          onClick={handleUpdate}
          className="w-full bg-white/15 hover:bg-white/25 text-white font-semibold py-3
                     transition-all flex items-center justify-center gap-2 text-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Actualizar ahora
        </button>
      </div>
    </div>
  );
}
