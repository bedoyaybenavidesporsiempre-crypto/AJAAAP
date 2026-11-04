import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';

export interface CheckinCode {
  pin: string;
  qrCode: string;
  expiresAt: string;
  updatedAt: string;
}

interface DbCheckinCode {
  id: number;
  pin: string;
  qr_code: string;
  expires_at: string;
  updated_at: string;
}

const POLL_MS = 5000;

export function useCheckinCode() {
  const [code, setCode] = useState<CheckinCode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCode = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('checkin_codes')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }

    if (!data) {
      setError('No hay código de check-in activo.');
      setLoading(false);
      return;
    }

    const row = data as DbCheckinCode;
    setCode({
      pin: row.pin,
      qrCode: row.qr_code,
      expiresAt: row.expires_at,
      updatedAt: row.updated_at,
    });
    setError(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCode();
    timerRef.current = setInterval(fetchCode, POLL_MS);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchCode]);

  return { code, loading, error, refresh: fetchCode };
}

export function useActiveCheckinCode(): {
  isValid: (input: string) => Promise<boolean>;
  loading: boolean;
} {
  const [loading, setLoading] = useState(false);

  const isValid = useCallback(async (input: string): Promise<boolean> => {
    const trimmed = input.trim().toUpperCase();
    if (!trimmed) return false;

    setLoading(true);
    const { data, error } = await supabase
      .from('checkin_codes')
      .select('pin, qr_code, expires_at')
      .eq('id', 1)
      .maybeSingle();

    setLoading(false);

    if (error || !data) return false;

    const row = data as { pin: string; qr_code: string; expires_at: string };
    const now = new Date();
    const expires = new Date(row.expires_at);
    if (now > expires) return false;

    return trimmed === row.pin || trimmed === row.qr_code.toUpperCase();
  }, []);

  return { isValid, loading };
}
