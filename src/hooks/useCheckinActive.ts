import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const POLL_MS = 5000;

export function useCheckinActive(): { active: boolean; loading: boolean } {
  const [active, setActive] = useState(true);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data } = await supabase
      .from('sede_config')
      .select('is_active')
      .eq('id', 1)
      .maybeSingle();
    const row = data as { is_active: boolean } | null;
    setActive(row ? row.is_active !== false : true);
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    return () => clearInterval(timer);
  }, [refresh]);

  return { active, loading };
}
