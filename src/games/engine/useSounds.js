import { useRef, useCallback } from 'react';

export default function useSounds() {
  const ctxRef = useRef(null);
  const mutedRef = useRef(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (ctxRef.current.state === 'suspended') {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const heartbeat = useCallback((bpm = 72) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const interval = 60 / bpm;

    // Two-beat pulse: lub-dub
    for (let i = 0; i < 2; i++) {
      const offset = i * interval * 0.3;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(i === 0 ? 55 : 45, now + offset);

      gain.gain.setValueAtTime(0, now + offset);
      gain.gain.linearRampToValueAtTime(0.6, now + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.15);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + offset);
      osc.stop(now + offset + 0.2);
    }
  }, [getCtx]);

  const splash = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const duration = 0.4;

    const bufferSize = ctx.sampleRate * duration;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(8000, now);
    filter.frequency.exponentialRampToValueAtTime(200, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);
  }, [getCtx]);

  const firecrackle = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    const burstCount = 5 + Math.floor(Math.random() * 5);
    for (let i = 0; i < burstCount; i++) {
      const offset = Math.random() * 0.3;
      const burstDuration = 0.01 + Math.random() * 0.03;
      const bufferSize = Math.ceil(ctx.sampleRate * burstDuration);
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let j = 0; j < bufferSize; j++) {
        data[j] = (Math.random() * 2 - 1);
      }

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(1000 + Math.random() * 3000, now + offset);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.15 + Math.random() * 0.2, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + burstDuration);

      source.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      source.start(now + offset);
      source.stop(now + offset + burstDuration);
    }
  }, [getCtx]);

  const chime = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const baseFreq = 880;
    const harmonics = [1, 2, 3, 5];

    harmonics.forEach((h, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * h, now);

      const amplitude = 0.3 / (idx + 1);
      gain.gain.setValueAtTime(amplitude, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.7);
    });
  }, [getCtx]);

  const tick = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, now);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.03);
  }, [getCtx]);

  const whoosh = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const duration = 0.3;

    const bufferSize = Math.ceil(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1);
    }

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(5, now);
    filter.frequency.setValueAtTime(200, now);
    filter.frequency.exponentialRampToValueAtTime(4000, now + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(300, now + duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.4, now + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    source.start(now);
    source.stop(now + duration);
  }, [getCtx]);

  // --- NEW SOUNDS ---

  // Pop - bubble burst, token collect
  const pop = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(600, now);
    osc.frequency.exponentialRampToValueAtTime(1200, now + 0.05);
    osc.frequency.exponentialRampToValueAtTime(200, now + 0.12);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }, [getCtx]);

  // Impact - collision, hit
  const impact = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    // Low thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.2);
    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
    // Noise burst layer
    const dur = 0.08;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(0.3, now);
    g2.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(g2);
    g2.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur);
  }, [getCtx]);

  // Success - ascending arpeggio, achievement
  const success = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const notes = [523, 659, 784, 1047]; // C5 E5 G5 C6
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.1);
      gain.gain.setValueAtTime(0, now + i * 0.1);
      gain.gain.linearRampToValueAtTime(0.3, now + i * 0.1 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.1 + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.1);
      osc.stop(now + i * 0.1 + 0.45);
    });
  }, [getCtx]);

  // Fail - descending buzz
  const fail = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.4);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.5);
  }, [getCtx]);

  // PowerUp - rising shimmer
  const powerup = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(400 + i * 200, now);
      osc.frequency.exponentialRampToValueAtTime(1200 + i * 400, now + 0.3);
      gain.gain.setValueAtTime(0.2 / (i + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.35);
    }
  }, [getCtx]);

  // Combo - stacked chime with increasing pitch
  const combo = useCallback((level = 1) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const baseFreq = 600 + Math.min(level, 10) * 80;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(baseFreq, now);
    osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 0.08);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }, [getCtx]);

  // Countdown beep - 3, 2, 1, GO
  const countdown = useCallback((isGo = false) => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isGo ? 880 : 440, now);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + (isGo ? 0.3 : 0.15));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + (isGo ? 0.35 : 0.2));
  }, [getCtx]);

  // Wing flap - short breathy whoosh
  const wingflap = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const dur = 0.12;
    const bufSz = Math.ceil(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSz, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < bufSz; i++) d[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.Q.setValueAtTime(2, now);
    filt.frequency.setValueAtTime(800, now);
    filt.frequency.exponentialRampToValueAtTime(2000, now + dur * 0.3);
    filt.frequency.exponentialRampToValueAtTime(500, now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.01, now);
    g.gain.linearRampToValueAtTime(0.25, now + dur * 0.2);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);
    src.connect(filt);
    filt.connect(g);
    g.connect(ctx.destination);
    src.start(now);
    src.stop(now + dur);
  }, [getCtx]);

  // Water drop - plip
  const drop = useCallback(() => {
    if (mutedRef.current) return;
    const ctx = getCtx();
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.1);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.15);
  }, [getCtx]);

  const setMuted = useCallback((muted) => {
    mutedRef.current = muted;
  }, []);

  return {
    heartbeat,
    splash,
    firecrackle,
    chime,
    tick,
    whoosh,
    // New sounds
    pop,
    impact,
    success,
    fail,
    powerup,
    combo,
    countdown,
    wingflap,
    drop,
    setMuted,
  };
}
