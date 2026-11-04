import { useState, useEffect, useMemo } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Tv, Clock, Hash, Users, RefreshCw, DoorClosed } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useCheckinCode } from '@/hooks/useCheckinCode';
import { useCheckinActive } from '@/hooks/useCheckinActive';
import { AppLogoMark } from '@/components/FastyTurnLogo';
import type { Appointment } from '@/types';

interface DbAppointment {
  id: string;
  patient_name: string;
  ticket_number: number;
  status: string;
  doctor_name: string | null;
  doctor_specialty: string | null;
}

const POLL_MS = 2000;

export function TvScreen() {
  const { code, loading, error } = useCheckinCode();
  const { active: checkinActive, loading: activeLoading } = useCheckinActive();
  const [now, setNow] = useState(Date.now());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [sedeName, setSedeName] = useState('Centro de Atención');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const fetchSede = async () => {
      const { data } = await supabase
        .from('sede_config')
        .select('name')
        .eq('id', 1)
        .maybeSingle();
      if (data) setSedeName((data as { name: string }).name);
    };
    fetchSede();
  }, []);

  useEffect(() => {
    const fetchCalled = async () => {
      const { data, error: err } = await supabase
        .from('queue_state')
        .select('current_called_id')
        .eq('id', 1)
        .maybeSingle();

      if (err || !data) return;
      const calledId = (data as { current_called_id: string | null }).current_called_id;
      if (!calledId) {
        setAppointments([]);
        return;
      }

      const { data: apptData } = await supabase
        .from('appointments')
        .select('id, patient_name, ticket_number, status, doctor_name, doctor_specialty')
        .eq('id', calledId)
        .maybeSingle();

      if (apptData) {
        const row = apptData as DbAppointment;
        setAppointments([
          {
            id: row.id,
            patientCedula: '',
            patientName: row.patient_name,
            scheduledTime: '--:--',
            status: row.status as Appointment['status'],
            ticketNumber: row.ticket_number,
            rescheduleCount: 0,
            doctorName: row.doctor_name ?? undefined,
            doctorSpecialty: row.doctor_specialty ?? undefined,
          },
        ]);
      } else {
        setAppointments([]);
      }
    };

    fetchCalled();
    const timer = setInterval(fetchCalled, POLL_MS);
    return () => clearInterval(timer);
  }, []);

  const countdown = useMemo(() => {
    if (!code || !checkinActive) return 0;
    const remaining = new Date(code.expiresAt).getTime() - now;
    return Math.max(0, Math.floor(remaining / 1000));
  }, [code, now, checkinActive]);

  const mins = Math.floor(countdown / 60);
  const secs = countdown % 60;

  const qrPayload = useMemo(() => {
    if (!code) return '';
    return JSON.stringify({ qr: code.qrCode, pin: code.pin });
  }, [code]);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-slate-950/50 border-b border-slate-800 shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/10">
            <AppLogoMark size={32} className="" />
          </div>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">Sala de Espera</p>
            <h1 className="text-xl font-extrabold leading-tight">{sedeName}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-400">
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
            </span>
            En vivo
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <Tv className="w-5 h-5" />
            <span className="text-sm font-medium hidden sm:inline">Pantalla TV</span>
          </div>
        </div>
      </header>

      {/* Main horizontal layout */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-6 overflow-hidden">
        {/* Left: QR + PIN */}
        <div className="flex-1 flex flex-col items-center justify-center lg:max-w-xl">
          {/* Recepción Cerrada overlay */}
          {!activeLoading && !checkinActive && (
            <div className="flex flex-col items-center justify-center text-center py-12">
              <div className="w-24 h-24 rounded-3xl bg-slate-800 flex items-center justify-center mb-6">
                <DoorClosed className="w-12 h-12 text-slate-500" />
              </div>
              <h2 className="text-3xl font-extrabold text-slate-300 mb-2">Recepción Cerrada</h2>
              <p className="text-lg text-slate-500">Fuera de Servicio</p>
              <p className="text-sm text-slate-600 mt-3 max-w-sm">
                El check-in está pausado. Dirígete a secretaría para ser atendido.
              </p>
            </div>
          )}

          {checkinActive && (
            <>
          <div className="text-center mb-4">
            <h2 className="text-2xl font-extrabold mb-1">Escanea para hacer Check-in</h2>
            <p className="text-slate-400">El código se renueva cada 5 minutos</p>
          </div>

          {loading && (
            <div className="flex items-center gap-3 text-slate-400">
              <RefreshCw className="w-6 h-6 animate-spin" />
              <span className="text-lg">Cargando código...</span>
            </div>
          )}

          {error && !loading && (
            <div className="bg-red-500/20 border border-red-500/40 rounded-2xl px-6 py-4 text-center">
              <p className="text-red-400 font-semibold">{error}</p>
            </div>
          )}

          {code && !loading && (
            <div className="flex flex-col lg:flex-row items-center gap-6 w-full justify-center">
              {/* QR */}
              <div className="bg-white rounded-3xl p-5 shadow-2xl shadow-blue-500/10 shrink-0">
                <QRCodeSVG
                  value={qrPayload}
                  size={240}
                  level="M"
                  marginSize={0}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                />
              </div>

              {/* PIN */}
              <div className="flex flex-col items-center gap-3">
                <div className="flex items-center gap-2 text-slate-400">
                  <Hash className="w-5 h-5" />
                  <span className="text-sm font-semibold uppercase tracking-wider">Código PIN</span>
                </div>
                <div className="flex gap-2">
                  {code.pin.split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-16 h-20 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-4xl font-extrabold text-blue-400 font-mono shadow-lg"
                    >
                      {digit}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Countdown */}
          {code && !loading && (
            <div className="mt-8 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-slate-400">
                <Clock className="w-5 h-5" />
                <span className="text-sm font-semibold uppercase tracking-wider">Próxima renovación</span>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-1">
                  <span className={`text-6xl font-extrabold font-mono ${countdown <= 30 ? 'text-amber-400' : 'text-white'}`}>
                    {String(mins).padStart(2, '0')}
                  </span>
                  <span className="text-2xl text-slate-500 font-bold">min</span>
                </div>
                <span className="text-4xl text-slate-600 font-bold">:</span>
                <div className="flex items-baseline gap-1">
                  <span className={`text-6xl font-extrabold font-mono ${countdown <= 30 ? 'text-amber-400' : 'text-white'}`}>
                    {String(secs).padStart(2, '0')}
                  </span>
                  <span className="text-2xl text-slate-500 font-bold">seg</span>
                </div>
              </div>
              <div className="w-64 h-2 bg-slate-800 rounded-full overflow-hidden mt-2">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${countdown <= 30 ? 'bg-amber-500' : 'bg-blue-500'}`}
                  style={{ width: `${(countdown / 300) * 100}%` }}
                />
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* Right: Called turns */}
        <div className="flex-1 flex flex-col lg:max-w-2xl">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-6 h-6 text-blue-400" />
            <h2 className="text-xl font-extrabold">Turno Llamado</h2>
          </div>

          {appointments.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 rounded-3xl bg-slate-800 flex items-center justify-center mb-4">
                <Users className="w-10 h-10 text-slate-600" />
              </div>
              <p className="text-xl font-bold text-slate-500">No hay turnos llamados</p>
              <p className="text-sm text-slate-600 mt-1">Esperando que el médico llame al siguiente paciente</p>
            </div>
          ) : (
            <div className="space-y-3 overflow-y-auto">
              {appointments.map((apt) => (
                <div
                  key={apt.id}
                  className="bg-gradient-to-r from-red-600 to-rose-600 rounded-3xl p-6 shadow-xl shadow-red-500/20 animate-bounce-in"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-white/70 font-semibold uppercase tracking-wider">Turno</p>
                      <div className="text-7xl font-extrabold tracking-tight mt-1">
                        #{String(apt.ticketNumber).padStart(2, '0')}
                      </div>
                      <p className="text-2xl font-bold mt-2">{apt.patientName}</p>
                      {apt.doctorName && (
                        <p className="text-sm text-white/80 mt-1">
                          {apt.doctorName}
                          {apt.doctorSpecialty ? ` — ${apt.doctorSpecialty}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="w-20 h-20 rounded-2xl bg-white/15 flex items-center justify-center shrink-0">
                      <Users className="w-10 h-10" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Instructions */}
          <div className="mt-6 bg-slate-800/50 rounded-2xl p-5 border border-slate-700">
            <p className="text-sm text-slate-400 font-medium text-center">
              Escanea el código QR con tu celular o ingresa el PIN en la app para confirmar tu llegada a la sala de espera.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
