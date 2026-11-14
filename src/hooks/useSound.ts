import { useCallback, useEffect, useRef } from 'react';

let globalAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (globalAudioCtx) return globalAudioCtx;
  try {
    const Ctx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    globalAudioCtx = new Ctx();
    return globalAudioCtx;
  } catch {
    return null;
  }
}

export function unlockAudioOnFirstTouch() {
  const unlock = () => {
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume();
    }
    window.removeEventListener('touchstart', unlock);
    window.removeEventListener('click', unlock);
  };
  window.addEventListener('touchstart', unlock, { once: true });
  window.addEventListener('click', unlock, { once: true });
}

export function useNotificationSound() {
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    unlockAudioOnFirstTouch();
  }, []);

  const play = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = getAudioContext();
      }
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const start = now + i * 0.18;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.25, start + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(start);
        osc.stop(start + 0.5);
      });
    } catch {
      // Audio not available
    }
  }, []);

  const playAlert = useCallback(() => {
    try {
      if (!ctxRef.current) {
        ctxRef.current = getAudioContext();
      }
      const ctx = ctxRef.current;
      if (!ctx) return;
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;
      // Two repetitions of a sharp bell-like tone
      for (let rep = 0; rep < 2; rep++) {
        const repStart = now + rep * 0.55;
        [880, 1046.5].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'square';
          osc.frequency.value = freq;
          const start = repStart + i * 0.12;
          gain.gain.setValueAtTime(0, start);
          gain.gain.linearRampToValueAtTime(0.18, start + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.001, start + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(start);
          osc.stop(start + 0.35);
        });
      }
    } catch {
      // Audio not available
    }
  }, []);

  return { play, playAlert };
}
