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
    setMuted,
  };
}
