import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';

const GAME_DURATION = 30;
const BPM_START = 250;
const BPM_END = 1260;
const PERFECT_WINDOW = 100;
const GOOD_WINDOW = 200;
const POOL_SIZE = 120;
const RING_POOL = 40;

export default function GameHeartbeatRush({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

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
    heartRadius: 0,
    bgPulse: 0,
    // Floating text results
    floatingTexts: [],
    // Enhanced particle pools
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot', // dot | line | star
    })),
    ringParticles: Array(RING_POOL).fill(null).map(() => ({
      active: false, x: 0, y: 0, angle: 0, radius: 0, targetRadius: 0,
      life: 0, maxLife: 0, size: 0, r: 0, g: 0, b: 0,
    })),
    // Concentric shockwave rings
    shockwaves: [],
    // Background star field
    stars: Array(60).fill(null).map(() => ({
      x: Math.random(), y: Math.random(), size: 0.5 + Math.random() * 1.5,
      speed: 0.02 + Math.random() * 0.05, phase: Math.random() * Math.PI * 2,
    })),
  });

  const spawnParticles = useCallback((cx, cy, count, r, g, b, opts = {}) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * (opts.spread || 0);
        p.y = cy + (Math.random() - 0.5) * (opts.spread || 0);
        const angle = Math.random() * Math.PI * 2;
        const speed = (opts.minSpeed || 60) + Math.random() * (opts.maxSpeed || 250);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - (opts.upBias || 0);
        p.life = (opts.minLife || 0.4) + Math.random() * (opts.maxLife || 0.8);
        p.maxLife = p.life;
        p.r = r + Math.floor((Math.random() - 0.5) * 30);
        p.g = g + Math.floor((Math.random() - 0.5) * 30);
        p.b = b + Math.floor((Math.random() - 0.5) * 30);
        p.size = (opts.minSize || 2) + Math.random() * (opts.maxSize || 5);
        p.type = opts.type || (Math.random() > 0.6 ? 'line' : 'dot');
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
        p.targetRadius = baseRadius + 100 + Math.random() * 80;
        p.life = 0.6 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.size = 2 + Math.random() * 4;
        p.r = r; p.g = g; p.b = b;
        spawned++;
      }
    }
  }, []);

  const spawnShockwave = useCallback((cx, cy, color) => {
    state.current.shockwaves.push({
      x: cx, y: cy, radius: 20, maxRadius: 250, life: 0.5,
      maxLife: 0.5, color, lineWidth: 4,
    });
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        haptics.tapFeedback();
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
    const baseR = Math.min(cx * 2, cy * 2) * 0.12;

    if (closestDist <= PERFECT_WINDOW) {
      s.score += 2;
      s.streak++;
      s.lastTapResult = t(UI_STRINGS.perfect);
      s.lastTapResultTimer = 0.9;
      // Massive particle burst
      spawnParticles(cx, cy, 20, 46, 234, 163, { maxSpeed: 350, upBias: 50, maxSize: 7 });
      spawnRingParticles(cx, cy, 12, baseR * s.pulseScale, 46, 234, 163);
      spawnShockwave(cx, cy, 'rgba(46,234,163,0.6)');
      // Floating score text
      s.floatingTexts.push({ text: '+2', x: cx, y: cy - baseR - 20, life: 1, color: COLORS.mint, size: 28 });
      sounds.chime();
      haptics.impactFeedback();
      juice.shake(6, 0.15);
      juice.flash('#2EEAA3', 0.25);
    } else if (closestDist <= GOOD_WINDOW) {
      s.score += 1;
      s.streak++;
      s.lastTapResult = t(UI_STRINGS.good);
      s.lastTapResultTimer = 0.7;
      spawnParticles(cx, cy, 10, 245, 166, 35, { maxSpeed: 200 });
      s.floatingTexts.push({ text: '+1', x: cx, y: cy - baseR - 20, life: 0.8, color: COLORS.gold, size: 22 });
      sounds.tick();
      haptics.tapFeedback();
    } else {
      s.streak = 0;
      s.lastTapResult = t(UI_STRINGS.miss);
      s.lastTapResultTimer = 0.5;
      juice.shake(3, 0.1);
      haptics.failFeedback();
    }
    if (s.streak > s.bestStreak) s.bestStreak = s.streak;
    setDisplayScore(s.score);
  }, [phase, sounds, haptics, juice, spawnParticles, spawnRingParticles, spawnShockwave]);

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

    // --- READY SCREEN ---
    if (phase === 'ready') {
      ctx.fillStyle = COLORS.primary;
      ctx.fillRect(0, 0, w, h);

      // Starfield
      for (const star of s.stars) {
        const sx = star.x * w;
        const sy = star.y * h;
        const twinkle = 0.3 + Math.sin(elapsed * 2 + star.phase) * 0.3;
        ctx.globalAlpha = twinkle;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      const idlePulse = 0.95 + Math.sin(elapsed * 3) * 0.05;
      const baseR = Math.min(w, h) * 0.12;
      const cx = w / 2, cy = h / 2 - 40;

      // Large glow
      juice.drawGlow(ctx, cx, cy, baseR * 3, '#2EEAA3', 0.12);

      // Heart circle
      const circGrad = ctx.createRadialGradient(cx - baseR * 0.3, cy - baseR * 0.3, 0, cx, cy, baseR);
      circGrad.addColorStop(0, '#5BFFC4');
      circGrad.addColorStop(1, COLORS.mint);
      ctx.beginPath();
      ctx.arc(cx, cy, baseR * idlePulse, 0, Math.PI * 2);
      ctx.fillStyle = circGrad;
      ctx.fill();

      // Heart shape overlay
      ctx.save();
      ctx.translate(cx, cy - baseR * 0.1);
      ctx.scale(baseR / 50, baseR / 50);
      ctx.beginPath();
      ctx.moveTo(0, 15);
      ctx.bezierCurveTo(-35, -15, -50, -40, -25, -45);
      ctx.bezierCurveTo(0, -50, 0, -25, 0, -25);
      ctx.bezierCurveTo(0, -25, 0, -50, 25, -45);
      ctx.bezierCurveTo(50, -40, 35, -15, 0, 15);
      ctx.fillStyle = 'rgba(255,255,255,0.3)';
      ctx.fill();
      ctx.restore();

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['01']), cx, cy + baseR + 30, '#2EEAA3', 30);

      ctx.font = "16px 'Outfit', 'DM Sans', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#AAB';
      ctx.fillText(t(UI_STRINGS.heartbeatFact), cx, cy + baseR + 72);

      ctx.font = "14px 'Outfit', 'DM Sans', sans-serif";
      ctx.fillStyle = '#667';
      ctx.fillText(t(UI_STRINGS.tapInSync), cx, cy + baseR + 114);

      const tapAlpha = 0.4 + Math.sin(elapsed * 4) * 0.6;
      ctx.globalAlpha = Math.max(0, tapAlpha);
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart).toUpperCase(), cx, cy + baseR + 155, '#2EEAA3', 20);
      ctx.globalAlpha = 1;

      ctx.restore();
      return;
    }

    // --- PLAYING ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

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
      s.pulseScale = 1.5;
      s.bgPulse = 1;
      sounds.heartbeat(s.bpm);
      haptics.heartbeatFeedback();
    }

    // Pulse decay
    s.pulseScale += (1 - s.pulseScale) * Math.min(1, delta * 10);
    s.bgPulse *= Math.pow(0.03, delta);

    // Tap result timer
    if (s.lastTapResultTimer > 0) s.lastTapResultTimer -= delta;

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 80 * delta; // slight gravity
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Update ring particles
    const cx = w / 2;
    const cy = h / 2;
    for (const p of s.ringParticles) {
      if (!p.active) continue;
      p.radius += (p.targetRadius - p.radius) * delta * 3.5;
      p.x = cx + Math.cos(p.angle) * p.radius;
      p.y = cy + Math.sin(p.angle) * p.radius;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Update shockwaves
    for (let i = s.shockwaves.length - 1; i >= 0; i--) {
      const sw = s.shockwaves[i];
      sw.life -= delta;
      const prog = 1 - sw.life / sw.maxLife;
      sw.radius = 20 + (sw.maxRadius - 20) * prog;
      sw.lineWidth = 4 * (1 - prog);
      if (sw.life <= 0) s.shockwaves.splice(i, 1);
    }

    // Update floating texts
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
      const ft = s.floatingTexts[i];
      ft.y -= 60 * delta;
      ft.life -= delta;
      if (ft.life <= 0) s.floatingTexts.splice(i, 1);
    }

    // Update juice
    juice.update(delta);

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      haptics.heavyFeedback();
      sounds.success();
      setPhase('ended');
      return;
    }

    // --- RENDER ---
    // Dynamic background with color shift
    const colorProgress = progress;
    const bgR = Math.floor(10 + s.bgPulse * 40 * colorProgress);
    const bgG = Math.floor(15 - 10 * colorProgress + s.bgPulse * 5);
    const bgB = Math.floor(28 - 15 * colorProgress + s.bgPulse * 15);
    ctx.fillStyle = `rgb(${bgR},${bgG},${bgB})`;
    ctx.fillRect(0, 0, w, h);

    // Apply shake
    ctx.save();
    juice.applyShake(ctx);

    // Starfield (dimmed during play)
    for (const star of s.stars) {
      const sx = star.x * w;
      const sy = star.y * h;
      const twinkle = 0.15 + Math.sin(elapsed * 1.5 + star.phase) * 0.15;
      ctx.globalAlpha = twinkle * (1 - colorProgress * 0.7);
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Radial pulse bg
    if (s.bgPulse > 0.01) {
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 350 * s.pulseScale);
      const pr = Math.floor(46 + (239 - 46) * colorProgress);
      const pg = Math.floor(234 + (30 - 234) * colorProgress);
      const pb = Math.floor(163 + (68 - 163) * colorProgress);
      grad.addColorStop(0, `rgba(${pr},${pg},${pb},${s.bgPulse * 0.35})`);
      grad.addColorStop(0.5, `rgba(${pr},${pg},${pb},${s.bgPulse * 0.1})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);
    }

    // Shockwave rings
    for (const sw of s.shockwaves) {
      const alpha = sw.life / sw.maxLife;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color.replace(/[\d.]+\)$/, `${alpha * 0.8})`);
      ctx.lineWidth = sw.lineWidth;
      ctx.stroke();
    }

    // Heart circle
    const baseRadius = Math.min(w, h) * 0.12;
    const radius = baseRadius * s.pulseScale;
    const hr = Math.floor(46 + (239 - 46) * colorProgress);
    const hg = Math.floor(234 + (68 - 234) * colorProgress);
    const hb = Math.floor(163 + (68 - 163) * colorProgress);

    // Multi-layer glow
    juice.drawGlow(ctx, cx, cy, radius * 2.5, `rgb(${hr},${hg},${hb})`, 0.15 + s.bgPulse * 0.2);
    juice.drawGlow(ctx, cx, cy, radius * 1.5, `rgb(${hr},${hg},${hb})`, 0.1 + s.bgPulse * 0.15);

    // Main circle with gradient
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    const circGrad = ctx.createRadialGradient(cx - radius * 0.3, cy - radius * 0.3, 0, cx, cy, radius);
    circGrad.addColorStop(0, `rgba(${Math.min(255, hr + 60)},${Math.min(255, hg + 60)},${Math.min(255, hb + 60)},1)`);
    circGrad.addColorStop(0.7, `rgb(${hr},${hg},${hb})`);
    circGrad.addColorStop(1, `rgb(${Math.max(0, hr - 30)},${Math.max(0, hg - 30)},${Math.max(0, hb - 30)})`);
    ctx.fillStyle = circGrad;
    ctx.fill();

    // Inner specular highlight
    ctx.beginPath();
    ctx.arc(cx - radius * 0.2, cy - radius * 0.25, radius * 0.35, 0, Math.PI * 2);
    const specGrad = ctx.createRadialGradient(cx - radius * 0.2, cy - radius * 0.25, 0, cx - radius * 0.2, cy - radius * 0.25, radius * 0.35);
    specGrad.addColorStop(0, 'rgba(255,255,255,0.35)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
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
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fill();
    ctx.restore();

    // Ring particles
    for (const p of s.ringParticles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = alpha * 0.9;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (0.5 + alpha * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
      ctx.fill();
      ctx.restore();
    }

    // Particles with glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      if (p.type === 'line') {
        const len = Math.sqrt(p.vx * p.vx + p.vy * p.vy) * 0.04;
        ctx.strokeStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.lineWidth = p.size * alpha * 0.6;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.04, p.y - p.vy * 0.04);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fill();
      }
    }
    ctx.restore();

    // Floating score texts
    for (const ft of s.floatingTexts) {
      const alpha = Math.min(1, ft.life * 2);
      juice.drawNeonText(ctx, ft.text, ft.x, ft.y, ft.color, ft.size);
    }

    // Tap result neon text
    if (s.lastTapResultTimer > 0) {
      const alpha = Math.min(1, s.lastTapResultTimer * 2);
      const yOffset = (1 - alpha) * -30;
      const resultColor = s.lastTapResult === t(UI_STRINGS.perfect) ? '#2EEAA3'
        : s.lastTapResult === t(UI_STRINGS.good) ? '#F5A623' : '#FF4444';
      ctx.globalAlpha = alpha;
      juice.drawNeonText(ctx, s.lastTapResult, cx, cy + radius + 65 + yOffset, resultColor, 34);
      ctx.globalAlpha = 1;
    }

    // Streak with neon
    if (s.streak > 1) {
      juice.drawNeonText(ctx, `× ${s.streak}`, cx, cy - radius - 45, '#F5A623', 26);
    }

    // BPM display
    ctx.font = "14px 'Outfit', 'DM Sans', sans-serif";
    ctx.textAlign = 'center';
    ctx.fillStyle = '#667';
    ctx.fillText(`${Math.round(s.bpm)} BPM`, cx, cy + radius + 110);

    // Screen flash
    juice.drawFlash(ctx, w, h);

    ctx.restore(); // end shake transform

    // Timer bar at top (outside shake)
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(0, 0, w, 5);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerGrad = ctx.createLinearGradient(0, 0, w * timerFrac, 0);
    if (s.timeLeft < 5) {
      timerGrad.addColorStop(0, '#FF4444');
      timerGrad.addColorStop(1, '#FF8800');
    } else {
      timerGrad.addColorStop(0, '#2EEAA3');
      timerGrad.addColorStop(1, '#00D4FF');
    }
    ctx.fillStyle = timerGrad;
    ctx.fillRect(0, 0, w * timerFrac, 5);

    // Glow on timer bar edge
    if (timerFrac > 0.01) {
      const edgeX = w * timerFrac;
      const edgeGrad = ctx.createRadialGradient(edgeX, 2, 0, edgeX, 2, 15);
      edgeGrad.addColorStop(0, s.timeLeft < 5 ? 'rgba(255,68,68,0.6)' : 'rgba(46,234,163,0.6)');
      edgeGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = edgeGrad;
      ctx.fillRect(edgeX - 15, 0, 30, 15);
    }

    // Timer text
    ctx.font = "bold 22px 'Outfit', 'DM Sans', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 5 ? '#FF4444' : '#FFFFFF';
    ctx.shadowColor = s.timeLeft < 5 ? '#FF4444' : '#2EEAA3';
    ctx.shadowBlur = 8;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 16, 36);
    ctx.shadowBlur = 0;

    // Score
    ctx.font = "bold 22px 'Outfit', 'DM Sans', sans-serif";
    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = '#2EEAA3';
    ctx.shadowBlur = 6;
    ctx.fillText(`${s.score}`, 16, 36);
    ctx.shadowBlur = 0;
    ctx.font = "12px 'Outfit', 'DM Sans', sans-serif";
    ctx.fillStyle = '#667';
    ctx.fillText('pts', 16 + ctx.measureText(`${s.score}`).width + 4, 36);

    // Subtle bloom post-process
    if (s.bgPulse > 0.3) {
      juice.applyBloom(ctx, w, h, s.bgPulse * 0.08);
    }

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, spawnRingParticles, spawnShockwave]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      state.current.lastBeatTime = 0;
      state.current.nextBeatTime = 0;
      state.current.beatCount = 0;
      state.current.score = 0;
      state.current.streak = 0;
      state.current.timeLeft = GAME_DURATION;
      state.current.floatingTexts = [];
      state.current.shockwaves = [];
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

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
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ color: '#AAB', fontSize: 16, letterSpacing: 4, marginBottom: 8, textTransform: 'uppercase' }}>{t(UI_STRINGS.timesUp)}</div>
          <div style={{
            color: COLORS.mint, fontSize: 56, fontWeight: 'bold', marginBottom: 4,
            textShadow: '0 0 30px rgba(46,234,163,0.5)',
          }}>{displayScore}</div>
          <div style={{ color: '#667', fontSize: 14, marginBottom: 4 }}>{t(UI_STRINGS.bestStreak)}: {state.current.bestStreak}</div>
          <div style={{ color: '#556', fontSize: 13, marginBottom: 32 }}>
            {t(UI_STRINGS.heartbeatFact)}
          </div>
          <button
            onClick={() => onComplete(state.current.score)}
            style={{
              background: 'linear-gradient(135deg, #2EEAA3, #00D4FF)', color: '#0A0F1C', border: 'none',
              padding: '14px 48px', borderRadius: 14, fontSize: 18, fontWeight: 'bold', cursor: 'pointer',
              marginBottom: 12, boxShadow: '0 0 20px rgba(46,234,163,0.3)',
            }}
          >{t(UI_STRINGS.continueBtn)}</button>
          <button
            onClick={onBack}
            style={{
              background: 'transparent', color: '#667', border: '1px solid #334',
              padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            }}
          >{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button
          onClick={onBack}
          style={{
            position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.08)',
            color: '#AAB', border: 'none', borderRadius: 10, padding: '8px 16px',
            fontSize: 13, cursor: 'pointer', zIndex: 10, backdropFilter: 'blur(4px)',
          }}
        >← {t(UI_STRINGS.back)}</button>
      )}
    </div>
  );
}
