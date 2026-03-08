import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 30;
const BPM_START = 250;
const BPM_END = 1260;
const PERFECT_WINDOW = 100;
const GOOD_WINDOW = 200;
const POOL_SIZE = 80;

export default function GameHeartbeatRush({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const sounds = useSounds();

  const state = useRef({
    score: 0,
    streak: 0,
    bestStreak: 0,
    timeLeft: GAME_DURATION,
    bpm: BPM_START,
    beatPhase: 0,
    lastBeatTime: 0,
    nextBeatTime: 0,
    beatCount: 0,
    lastTapResult: '',
    lastTapResultTimer: 0,
    pulseScale: 1,
    pulseTarget: 1,
    heartRadius: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0, r: 0, g: 0, b: 0, size: 0,
    })),
    bgPulse: 0,
    ringParticles: Array(30).fill(null).map(() => ({
      active: false, x: 0, y: 0, angle: 0, radius: 0, targetRadius: 0, life: 0, maxLife: 0, size: 0, r: 0, g: 0, b: 0,
    })),
  });

  const spawnParticles = useCallback((cx, cy, count, r, g, b) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx;
        p.y = cy;
        const angle = Math.random() * Math.PI * 2;
        const speed = 80 + Math.random() * 200;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.5 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = r;
        p.g = g;
        p.b = b;
        p.size = 2 + Math.random() * 4;
        spawned++;
      }
    }
  }, []);

  const spawnRingParticles = useCallback((cx, cy, count, baseRadius, r, g, b) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.ringParticles.length && spawned < count; i++) {
      const p = s.ringParticles[i];
      if (!p.active) {
        p.active = true;
        p.angle = Math.random() * Math.PI * 2;
        p.x = cx + Math.cos(p.angle) * baseRadius;
        p.y = cy + Math.sin(p.angle) * baseRadius;
        p.radius = baseRadius;
        p.targetRadius = baseRadius + 80 + Math.random() * 60;
        p.life = 0.6 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.size = 2 + Math.random() * 3;
        p.r = r; p.g = g; p.b = b;
        spawned++;
      }
    }
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
      }
      return;
    }
    const s = state.current;
    const now = performance.now();
    const beatInterval = 60000 / s.bpm;
    const timeSinceLastBeat = now - s.lastBeatTime;
    const timeToNextBeat = s.nextBeatTime - now;
    const closestDist = Math.min(timeSinceLastBeat, timeToNextBeat);

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cx = canvas ? canvas.width / (2 * dpr) : 200;
    const cy = canvas ? canvas.height / (2 * dpr) : 300;

    if (closestDist <= PERFECT_WINDOW) {
      s.score += 2;
      s.streak++;
      s.lastTapResult = 'PERFECT!';
      s.lastTapResultTimer = 0.8;
      spawnParticles(cx, cy, 15, 46, 234, 163);
      spawnRingParticles(cx, cy, 8, Math.min(cx, cy) * 0.12 * s.pulseScale, 46, 234, 163);
      sounds.chime();
    } else if (closestDist <= GOOD_WINDOW) {
      s.score += 1;
      s.streak++;
      s.lastTapResult = 'GOOD';
      s.lastTapResultTimer = 0.6;
      spawnParticles(cx, cy, 8, 245, 166, 35);
      sounds.tick();
    } else {
      s.streak = 0;
      s.lastTapResult = 'MISS';
      s.lastTapResultTimer = 0.5;
    }
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    setDisplayScore(s.score);
  }, [phase, sounds, spawnParticles, spawnRingParticles]);

  useTouch(canvasRef, { onTap: handleTap });

  const gameLoop = useGameLoop(useCallback(({ elapsed, delta }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    const s = state.current;

    if (phase === 'ready') {
      ctx.fillStyle = COLORS.primary;
      ctx.fillRect(0, 0, w, h);

      // Animated idle pulse
      const idlePulse = 0.95 + Math.sin(elapsed * 3) * 0.05;
      const baseR = Math.min(w, h) * 0.1;

      // Glow
      const grad = ctx.createRadialGradient(w / 2, h / 2 - 40, 0, w / 2, h / 2 - 40, baseR * 2);
      grad.addColorStop(0, 'rgba(46,234,163,0.15)');
      grad.addColorStop(1, 'rgba(46,234,163,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Heart circle
      ctx.beginPath();
      ctx.arc(w / 2, h / 2 - 40, baseR * idlePulse, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.mint;
      ctx.fill();

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Heartbeat Rush', w / 2, h / 2 + baseR + 20);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText("A hummingbird's heart beats", w / 2, h / 2 + baseR + 52);
      ctx.fillText('1,260 times per minute!', w / 2, h / 2 + baseR + 76);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Tap in sync with the pulse', w / 2, h / 2 + baseR + 110);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      ctx.fillText('TAP TO START', w / 2, h / 2 + baseR + 150);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    // BPM ramp
    const progress = Math.min(elapsed / GAME_DURATION, 1);
    s.bpm = BPM_START + (BPM_END - BPM_START) * progress;

    // Beat logic
    const now = performance.now();
    const beatInterval = 60000 / s.bpm;
    if (s.lastBeatTime === 0) {
      s.lastBeatTime = now;
      s.nextBeatTime = now + beatInterval;
    }
    if (now >= s.nextBeatTime) {
      s.lastBeatTime = s.nextBeatTime;
      s.nextBeatTime = s.lastBeatTime + beatInterval;
      s.beatCount++;
      s.pulseScale = 1.4;
      s.bgPulse = 1;
      sounds.heartbeat(s.bpm);
    }

    // Pulse decay
    s.pulseScale += (1 - s.pulseScale) * Math.min(1, delta * 12);
    s.bgPulse *= Math.pow(0.05, delta);

    // Tap result timer
    if (s.lastTapResultTimer > 0) s.lastTapResultTimer -= delta;

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vx *= 0.96;
      p.vy *= 0.96;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Update ring particles
    const cx = w / 2;
    const cy = h / 2;
    for (const p of s.ringParticles) {
      if (!p.active) continue;
      p.radius += (p.targetRadius - p.radius) * delta * 4;
      p.x = cx + Math.cos(p.angle) * p.radius;
      p.y = cy + Math.sin(p.angle) * p.radius;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      return;
    }

    // --- RENDER ---
    const colorProgress = progress;
    const bgR = Math.floor(10 + s.bgPulse * 30 * colorProgress);
    const bgG = Math.floor(15 - 10 * colorProgress);
    const bgB = Math.floor(28 - 15 * colorProgress);
    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(0, 0, w, h);

    // Radial pulse bg effect
    if (s.bgPulse > 0.01) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 300 * s.pulseScale);
      const pulseAlpha = s.bgPulse * 0.3;
      const pr = Math.floor(46 + (239 - 46) * colorProgress);
      const pg = Math.floor(234 + (30 - 234) * colorProgress);
      const pb = Math.floor(163 + (68 - 163) * colorProgress);
      grad.addColorStop(0, `rgba(${pr},${pg},${pb},${pulseAlpha})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Concentric ring pulse
    if (s.bgPulse > 0.05) {
      const ringR = 300 * (1 - s.bgPulse) + 60;
      ctx.beginPath();
      ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${s.bgPulse * 0.15})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Heart circle
    const baseRadius = Math.min(w, h) * 0.12;
    const radius = baseRadius * s.pulseScale;
    const hr = Math.floor(46 + (239 - 46) * colorProgress);
    const hg = Math.floor(234 + (68 - 234) * colorProgress);
    const hb = Math.floor(163 + (68 - 163) * colorProgress);

    // Outer glow
    const glowGrad = ctx.createRadialGradient(cx, cy, radius * 0.8, cx, cy, radius + 30);
    glowGrad.addColorStop(0, `rgba(${hr},${hg},${hb},0.2)`);
    glowGrad.addColorStop(1, `rgba(${hr},${hg},${hb},0)`);
    ctx.fillStyle = glowGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, radius + 30, 0, Math.PI * 2);
    ctx.fill();

    // Main circle
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    const circGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
    circGrad.addColorStop(0, `rgba(${Math.min(255, hr + 40)},${Math.min(255, hg + 40)},${Math.min(255, hb + 40)},1)`);
    circGrad.addColorStop(1, `rgb(${hr},${hg},${hb})`);
    ctx.fillStyle = circGrad;
    ctx.fill();

    // Heart shape overlay
    ctx.save();
    ctx.translate(cx, cy - radius * 0.1);
    ctx.scale(radius / 50, radius / 50);
    ctx.beginPath();
    ctx.moveTo(0, 15);
    ctx.bezierCurveTo(-35, -15, -50, -40, -25, -45);
    ctx.bezierCurveTo(0, -50, 0, -25, 0, -25);
    ctx.bezierCurveTo(0, -25, 0, -50, 25, -45);
    ctx.bezierCurveTo(50, -40, 35, -15, 0, 15);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fill();
    ctx.restore();

    // Ring particles
    for (const p of s.ringParticles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.8})`;
      ctx.fill();
    }

    // Particles
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }

    // Tap result text
    if (s.lastTapResultTimer > 0) {
      const alpha = Math.min(1, s.lastTapResultTimer * 2);
      const yOffset = (1 - alpha) * -20;
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      const resultColor = s.lastTapResult === 'PERFECT!' ? COLORS.mint
        : s.lastTapResult === 'GOOD' ? COLORS.gold : COLORS.red;
      ctx.fillStyle = resultColor;
      ctx.globalAlpha = alpha;
      ctx.fillText(s.lastTapResult, cx, cy + radius + 60 + yOffset);
      ctx.globalAlpha = 1;
    }

    // Streak
    if (s.streak > 1) {
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(`Streak: ${s.streak}`, cx, cy - radius - 40);
    }

    // BPM display
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText(`${Math.round(s.bpm)} BPM`, cx, cy + radius + 100);

    // Timer bar at top
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.mint;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer text
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    // Score
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${s.score}`, 20, 40);

    ctx.restore();
  }, [phase, sounds, spawnParticles, spawnRingParticles]));

  useEffect(() => {
    if (phase === 'ready') {
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      state.current.lastBeatTime = 0;
      state.current.nextBeatTime = 0;
      state.current.beatCount = 0;
      state.current.score = 0;
      state.current.streak = 0;
      state.current.timeLeft = GAME_DURATION;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') {
      gameLoop.stop();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    return () => gameLoop.stop();
  }, [gameLoop]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }}>
          <div style={{ color: COLORS.white, fontSize: 32, fontWeight: 'bold', marginBottom: 8 }}>Time's Up!</div>
          <div style={{ color: COLORS.mint, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>{displayScore}</div>
          <div style={{ color: COLORS.gray, fontSize: 16, marginBottom: 4 }}>Best Streak: {state.current.bestStreak}</div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
            A hummingbird heart: 1,260 BPM!
          </div>
          <button
            onClick={() => onComplete(state.current.score)}
            style={{
              background: COLORS.mint, color: COLORS.primary, border: 'none',
              padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold', cursor: 'pointer',
              marginBottom: 12,
            }}
          >Continue</button>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', color: COLORS.gray, border: `1px solid ${COLORS.gray}`,
              padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            }}
          >Back</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button
          onClick={onBack}
          style={{
            position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
            color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: 14, cursor: 'pointer', zIndex: 10,
          }}
        >Back</button>
      )}
    </div>
  );
}
