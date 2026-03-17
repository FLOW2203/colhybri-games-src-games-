import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';

const GAME_DURATION = 45;
const POOL_SIZE = 120;
const NUM_PELICANS = 5;
const NUM_FISH = 8;
const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";

export default function GameSemiCercle({ onComplete, onBack }) {
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
    timeLeft: GAME_DURATION,
    round: 1,
    pelicans: Array(NUM_PELICANS).fill(null).map((_, i) => ({
      x: 0, y: 0,
      targetX: 0, targetY: 0,
      dragging: false,
      diveState: 'idle',
      diveY: 0,
      diveTimer: 0,
    })),
    fish: [],
    formationAccuracy: 0,
    waterLevel: 0,
    divePhase: 'none',
    diveTimingWindow: 0,
    diveTimingResult: '',
    diveResultTimer: 0,
    roundTimer: 0,
    fishCaught: 0,
    fishSpeed: 40,
    dragIdx: -1,
    ripples: [],
    splashes: [],
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    waveOffset: 0,
    lastWarningTick: -1,
  });

  const spawnParticles = useCallback((cx, cy, count, r, g, b) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx; p.y = cy;
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 100;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - 50;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 2 + Math.random() * 4;
        spawned++;
      }
    }
  }, []);

  function resetFormation(s, w, h) {
    const waterY = h * 0.5;
    s.waterLevel = waterY;
    const cx = w / 2;
    const formY = waterY - 50;
    for (let i = 0; i < NUM_PELICANS; i++) {
      const t = (i / (NUM_PELICANS - 1)) * Math.PI;
      const radius = Math.min(w * 0.35, 160);
      s.pelicans[i].x = cx + Math.cos(t) * radius * (i === 0 ? 1 : 1);
      s.pelicans[i].x = cx - radius + (i / (NUM_PELICANS - 1)) * radius * 2;
      s.pelicans[i].y = formY - Math.sin(t) * 40;
      s.pelicans[i].diveState = 'idle';
      s.pelicans[i].diveY = 0;
      s.pelicans[i].dragging = false;
    }
    s.fish = [];
    for (let i = 0; i < NUM_FISH + s.round * 2; i++) {
      s.fish.push({
        x: Math.random() * w,
        y: waterY + 30 + Math.random() * (h - waterY - 60),
        vx: (Math.random() - 0.5) * s.fishSpeed,
        size: 8 + Math.random() * 6,
        caught: false,
      });
    }
    s.divePhase = 'none';
  }

  function computeFormationAccuracy(pelicans, cx, waterY) {
    const targetRadius = 120;
    const targetY = waterY - 50;
    let totalError = 0;
    for (let i = 0; i < NUM_PELICANS; i++) {
      const idealT = (i / (NUM_PELICANS - 1)) * Math.PI;
      const idealX = cx + Math.cos(idealT + Math.PI) * targetRadius;
      const idealY = targetY - Math.sin(idealT) * 40;
      const dx = pelicans[i].x - idealX;
      const dy = pelicans[i].y - idealY;
      totalError += Math.hypot(dx, dy);
    }
    const maxError = targetRadius * 2 * NUM_PELICANS;
    return Math.max(0, Math.min(100, 100 - (totalError / maxError) * 200));
  }

  const handleTap = useCallback(({ x, y }) => {
    if (phase === 'ready') {
      setPhase('playing');
      sounds.countdown(true);
      haptics.tapFeedback();
      return;
    }
    if (phase !== 'playing') return;
    const s = state.current;

    if (s.divePhase === 'ready' && s.formationAccuracy >= 80) {
      // Trigger dive
      s.divePhase = 'diving';
      s.diveTimingWindow = 0;
      for (const p of s.pelicans) {
        p.diveState = 'diving';
        p.diveTimer = 0;
      }
      sounds.splash();
      sounds.whoosh();
      haptics.impactFeedback();
      juice.shake(6, 0.3);
      juice.flash('#1E90FF', 0.3);
      return;
    }

    if (s.divePhase === 'timing') {
      const timingScore = Math.max(0, 1 - Math.abs(s.diveTimingWindow - 0.5) * 2);
      const fishInRange = s.fish.filter(f => !f.caught);
      const catchCount = Math.ceil(fishInRange.length * timingScore * (s.formationAccuracy / 100));
      for (let i = 0; i < catchCount && i < fishInRange.length; i++) {
        fishInRange[i].caught = true;
        s.fishCaught++;
        spawnParticles(fishInRange[i].x, fishInRange[i].y, 8, 0, 191, 255);
      }
      const pts = Math.floor(catchCount * (s.formationAccuracy / 100) * 5);
      s.score += pts;
      setDisplayScore(s.score);
      s.diveTimingResult = catchCount > 0 ? `Caught ${catchCount}!` : 'Missed!';
      s.diveResultTimer = 1.5;
      s.divePhase = 'surfacing';
      for (const p of s.pelicans) p.diveState = 'surfacing';

      if (catchCount > 0) {
        sounds.chime();
        sounds.pop();
        haptics.successFeedback();
        juice.flash('#2EEAA3', 0.35);
        juice.shake(4, 0.2);
      } else {
        sounds.fail();
        haptics.failFeedback();
        juice.flash('#EF4444', 0.3);
        juice.shake(10, 0.4);
      }
    }
  }, [phase, sounds, spawnParticles, haptics, juice]);

  const handleDrag = useCallback(({ x, y, dx, dy }) => {
    if (phase !== 'playing') return;
    const s = state.current;
    if (s.dragIdx >= 0) {
      s.pelicans[s.dragIdx].x += dx;
      s.pelicans[s.dragIdx].y += dy;
      s.pelicans[s.dragIdx].y = Math.min(s.waterLevel - 15, s.pelicans[s.dragIdx].y);
    } else {
      let nearest = -1;
      let nearestDist = 50;
      for (let i = 0; i < s.pelicans.length; i++) {
        if (s.pelicans[i].diveState !== 'idle') continue;
        const d = Math.hypot(s.pelicans[i].x - x, s.pelicans[i].y - y);
        if (d < nearestDist) {
          nearestDist = d;
          nearest = i;
        }
      }
      if (nearest >= 0) {
        s.dragIdx = nearest;
        s.pelicans[nearest].dragging = true;
        haptics.tapFeedback();
        sounds.tick();
      }
    }
  }, [phase, haptics, sounds]);

  const handleSwipe = useCallback(() => {
    if (phase === 'ready') setPhase('playing');
  }, [phase]);

  useTouch(canvasRef, {
    onTap: handleTap,
    onDrag: handleDrag,
    onSwipe: handleSwipe,
    onHoldEnd: useCallback(() => {
      const s = state.current;
      if (s.dragIdx >= 0) {
        s.pelicans[s.dragIdx].dragging = false;
        s.dragIdx = -1;
      }
    }, []),
  });

  function drawPelican(ctx, x, y, diving, time) {
    ctx.save();
    ctx.translate(x, y);
    const wingFlap = Math.sin(time * 5) * 8;
    // Body
    ctx.fillStyle = '#F5F5DC';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head
    ctx.beginPath();
    ctx.arc(12, -8, 7, 0, Math.PI * 2);
    ctx.fill();
    // Beak/pouch
    ctx.fillStyle = '#F5A623';
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.lineTo(30, -6);
    ctx.quadraticCurveTo(25, 0, 18, -4);
    ctx.closePath();
    ctx.fill();
    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(14, -10, 1.5, 0, Math.PI * 2);
    ctx.fill();
    // Wings
    ctx.fillStyle = '#D4C9A8';
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.quadraticCurveTo(-20, -14 + wingFlap, -12, -2);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, -4);
    ctx.quadraticCurveTo(-18, -16 - wingFlap, -14, -3);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFish(ctx, f, time) {
    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.vx > 0 ? 1 : -1, 1);
    ctx.fillStyle = `rgba(150,200,220,0.6)`;
    ctx.beginPath();
    ctx.ellipse(0, 0, f.size, f.size * 0.4, 0, 0, Math.PI * 2);
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(-f.size, 0);
    ctx.lineTo(-f.size - 5, -4);
    ctx.lineTo(-f.size - 5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

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
    const cx = w / 2;

    // Update juice effects
    juice.update(delta);

    if (phase === 'ready') {
      ctx.fillStyle = '#0A1628';
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['15']), w / 2, h / 2 - 70, COLORS.cyan, 28);

      // Subtitle with glow
      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Pelicans form semi-circles and', w / 2, h / 2 - 20);
      ctx.fillText('synchronize their catches!', w / 2, h / 2 + 4);
      ctx.shadowBlur = 0;

      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('DRAG pelicans into formation', w / 2, h / 2 + 44);
      ctx.fillText('TAP to trigger synchronized dive', w / 2, h / 2 + 66);

      // Pulsing start text with neon
      const pulse = 0.6 + 0.4 * Math.sin(elapsed * 3);
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), w / 2, h / 2 + 120, COLORS.mint, 20);
      ctx.globalAlpha = pulse;
      juice.drawGlow(ctx, w / 2, h / 2 + 120, 80, COLORS.mint, 0.2);
      ctx.globalAlpha = 1;

      ctx.restore();
      return;
    }

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    // Low time warning haptics
    if (s.timeLeft <= 5 && s.timeLeft > 0) {
      const sec = Math.ceil(s.timeLeft);
      if (sec !== s.lastWarningTick) {
        s.lastWarningTick = sec;
        haptics.warningFeedback();
        sounds.tick();
      }
    }

    // Init first round fish
    if (s.fish.length === 0) {
      resetFormation(s, w, h);
    }

    s.waterLevel = h * 0.5;
    s.waveOffset += delta;

    // Formation accuracy
    s.formationAccuracy = computeFormationAccuracy(s.pelicans, cx, s.waterLevel);
    if (s.formationAccuracy >= 80 && s.divePhase === 'none') {
      s.divePhase = 'ready';
    }
    if (s.formationAccuracy < 80 && s.divePhase === 'ready') {
      s.divePhase = 'none';
    }

    // Dive animation
    if (s.divePhase === 'diving') {
      let allDone = true;
      for (const p of s.pelicans) {
        p.diveTimer += delta;
        p.diveY = Math.min(80, p.diveTimer * 200);
        if (p.diveTimer < 0.5) allDone = false;
      }
      if (allDone) {
        s.divePhase = 'timing';
        s.diveTimingWindow = 0;
      }
    }

    if (s.divePhase === 'timing') {
      s.diveTimingWindow += delta * 1.5;
      if (s.diveTimingWindow > 1) {
        s.diveTimingResult = 'Too late!';
        s.diveResultTimer = 1;
        s.divePhase = 'surfacing';
        for (const p of s.pelicans) p.diveState = 'surfacing';
        sounds.fail();
        haptics.failFeedback();
        juice.flash('#EF4444', 0.25);
        juice.shake(8, 0.35);
      }
    }

    if (s.divePhase === 'surfacing') {
      let allUp = true;
      for (const p of s.pelicans) {
        p.diveY = Math.max(0, p.diveY - delta * 150);
        if (p.diveY > 0) allUp = false;
      }
      if (allUp) {
        s.divePhase = 'none';
        for (const p of s.pelicans) p.diveState = 'idle';
        // Next round
        s.round++;
        s.fishSpeed += 15;
        resetFormation(s, w, h);
        sounds.powerup();
        haptics.comboFeedback(s.round);
      }
    }

    if (s.diveResultTimer > 0) s.diveResultTimer -= delta;

    // Fish movement
    for (const f of s.fish) {
      if (f.caught) continue;
      f.x += f.vx * delta;
      if (f.x < -20) f.x = w + 20;
      if (f.x > w + 20) f.x = -20;
      f.y += Math.sin(elapsed * 2 + f.x * 0.01) * delta * 10;
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 80 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      if (s.score > 0) {
        sounds.success();
        haptics.successFeedback();
      } else {
        sounds.fail();
        haptics.heavyFeedback();
      }
      return;
    }

    // Apply shake transform
    juice.applyShake(ctx);

    // --- RENDER ---
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, s.waterLevel);
    skyGrad.addColorStop(0, '#87CEEB');
    skyGrad.addColorStop(1, '#B0E0E6');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, s.waterLevel);

    // Water
    const waterGrad = ctx.createLinearGradient(0, s.waterLevel, 0, h);
    waterGrad.addColorStop(0, '#1E90FF');
    waterGrad.addColorStop(0.3, '#1873CC');
    waterGrad.addColorStop(1, '#0A2F5C');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, s.waterLevel, w, h - s.waterLevel);

    // Water surface waves
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1.5;
    for (let row = 0; row < 3; row++) {
      ctx.beginPath();
      const wy = s.waterLevel + row * 15;
      for (let x = 0; x < w; x += 3) {
        const wave = Math.sin(x * 0.03 + s.waveOffset * 2 + row) * 4;
        if (x === 0) ctx.moveTo(x, wy + wave);
        else ctx.lineTo(x, wy + wave);
      }
      ctx.stroke();
    }

    // Fish shadows (below surface) with subtle glow
    for (const f of s.fish) {
      if (f.caught) continue;
      juice.drawGlow(ctx, f.x, f.y, f.size * 2, '#00BFFF', 0.12);
      drawFish(ctx, f, elapsed);
    }

    // Ideal formation guide (subtle)
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    const guideR = 120;
    const guideY = s.waterLevel - 50;
    for (let i = 0; i <= 40; i++) {
      const t = (i / 40) * Math.PI;
      const gx = cx + Math.cos(t + Math.PI) * guideR;
      const gy = guideY - Math.sin(t) * 40;
      if (i === 0) ctx.moveTo(gx, gy);
      else ctx.lineTo(gx, gy);
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // Pelicans with glow
    for (let i = 0; i < NUM_PELICANS; i++) {
      const p = s.pelicans[i];
      const py = p.y + p.diveY;

      // Glow behind pelican
      if (p.dragging) {
        juice.drawGlow(ctx, p.x, py, 35, COLORS.cyan, 0.35);
      } else if (s.divePhase === 'ready') {
        juice.drawGlow(ctx, p.x, py, 28, COLORS.mint, 0.15 + 0.1 * Math.sin(elapsed * 4));
      }

      drawPelican(ctx, p.x, py, p.diveState === 'diving', elapsed);

      if (p.dragging) {
        ctx.strokeStyle = 'rgba(0,212,255,0.6)';
        ctx.lineWidth = 2;
        ctx.shadowColor = COLORS.cyan;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(p.x, py, 22, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Splash effects during dive with additive blending
    if (s.divePhase === 'diving' || s.divePhase === 'timing') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (const p of s.pelicans) {
        if (p.diveY > 30) {
          spawnParticles(p.x, s.waterLevel, 1, 150, 220, 255);
          juice.drawGlow(ctx, p.x, s.waterLevel, 30, '#00BFFF', 0.25);
        }
      }
      ctx.restore();
    }

    // Particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // Formation accuracy meter with glow
    const meterW = w * 0.4;
    const meterH = 10;
    const meterX = (w - meterW) / 2;
    const meterY = 65;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(meterX, meterY, meterW, meterH);
    const meterColor = s.formationAccuracy >= 80 ? '#22C55E' : s.formationAccuracy >= 50 ? '#F5A623' : '#EF4444';
    ctx.fillStyle = meterColor;
    ctx.fillRect(meterX, meterY, meterW * (s.formationAccuracy / 100), meterH);

    // Meter glow when full
    if (s.formationAccuracy >= 80) {
      juice.drawGlow(ctx, w / 2, meterY + meterH / 2, meterW * 0.3, '#22C55E', 0.15);
    }

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX, meterY, meterW, meterH);
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Formation: ${Math.floor(s.formationAccuracy)}%`, w / 2, meterY - 4);

    // Dive ready indicator - neon
    if (s.divePhase === 'ready') {
      const glowPulse = 0.6 + 0.4 * Math.sin(elapsed * 4);
      juice.drawNeonText(ctx, 'TAP TO DIVE!', w / 2, s.waterLevel - 100, '#22C55E', 18);
      juice.drawGlow(ctx, w / 2, s.waterLevel - 100, 60, '#22C55E', 0.15 * glowPulse);
    }

    // Timing bar with glow
    if (s.divePhase === 'timing') {
      const barW = w * 0.6;
      const barH = 20;
      const barX = (w - barW) / 2;
      const barY = h * 0.4;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(barX, barY, barW, barH);
      // Sweet spot with glow
      ctx.fillStyle = 'rgba(34,197,94,0.4)';
      ctx.fillRect(barX + barW * 0.35, barY, barW * 0.3, barH);
      juice.drawGlow(ctx, barX + barW * 0.5, barY + barH / 2, barW * 0.15, '#22C55E', 0.2);
      // Cursor with glow
      const cursorX = barX + barW * s.diveTimingWindow;
      ctx.fillStyle = '#FFE066';
      ctx.shadowColor = '#FFE066';
      ctx.shadowBlur = 10;
      ctx.fillRect(cursorX - 2, barY - 3, 4, barH + 6);
      ctx.shadowBlur = 0;
      juice.drawNeonText(ctx, 'TAP NOW!', w / 2, barY - 12, '#FFE066', 14);
    }

    // Dive result - neon text
    if (s.diveResultTimer > 0) {
      const resultAlpha = Math.min(1, s.diveResultTimer);
      ctx.globalAlpha = resultAlpha;
      const resultColor = s.diveTimingResult.includes('Caught') ? COLORS.mint : COLORS.red;
      juice.drawNeonText(ctx, s.diveTimingResult, w / 2, h * 0.35, resultColor, 24);
      ctx.globalAlpha = 1;
    }

    // Round - neon
    juice.drawNeonText(ctx, `Round ${s.round}`, w / 2, 90, COLORS.cyan, 14);

    // Score - neon text
    ctx.textAlign = 'left';
    ctx.save();
    ctx.font = `bold 22px ${FONT_FAMILY}`;
    ctx.shadowColor = COLORS.mint;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.white;
    ctx.fillText(t(UI_STRINGS.score) + ': ' + s.score, 20, 40);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Timer - neon with warning glow
    ctx.save();
    ctx.textAlign = 'right';
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.shadowColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.shadowBlur = s.timeLeft < 5 ? 16 : 8;
    ctx.fillStyle = timerColor;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Draw screen flash overlay
    juice.drawFlash(ctx, w, h);

    // Subtle bloom
    juice.applyBloom(ctx, w, h, 0.08);

    ctx.restore();
  }, [phase, sounds, spawnParticles, haptics, juice, t]));

  useEffect(() => { if (phase === 'ready') gameLoop.start(); }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0; s.round = 1; s.fishCaught = 0; s.fishSpeed = 40;
      s.divePhase = 'none'; s.diveResultTimer = 0; s.dragIdx = -1;
      s.fish = []; s.lastWarningTick = -1;
      gameLoop.reset(); gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => { if (phase === 'ended') gameLoop.stop(); }, [phase, gameLoop]);
  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(10,15,28,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 30, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 20px ${COLORS.cyan}, 0 0 40px ${COLORS.cyan}`,
          }}>{t(UI_STRINGS.timesUp)}</div>
          <div style={{
            color: COLORS.mint, fontSize: 48, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 24px ${COLORS.mint}, 0 0 48px ${COLORS.mint}`,
          }}>{state.current.score}</div>
          <div style={{
            color: COLORS.gray, fontSize: 15, marginBottom: 4,
            textShadow: '0 0 8px rgba(156,163,175,0.4)',
          }}>
            Fish caught: {state.current.fishCaught} | Rounds: {state.current.round}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 13, marginBottom: 24,
            textShadow: '0 0 6px rgba(156,163,175,0.3)',
          }}>
            Synchronized teamwork is key!
          </div>
          <button onClick={() => {
            sounds.chime();
            haptics.tapFeedback();
            onComplete(state.current.score);
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.mint}, ${COLORS.cyan})`,
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.mint}80, 0 4px 15px rgba(0,0,0,0.3)`,
            textShadow: 'none',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={() => {
            sounds.tick();
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.08)',
            color: COLORS.gray, border: `1px solid ${COLORS.gray}50`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            textShadow: '0 0 8px rgba(156,163,175,0.3)',
          }}>{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => {
          haptics.tapFeedback();
          onBack();
        }} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
          color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 14, cursor: 'pointer', zIndex: 10,
          fontFamily: FONT_FAMILY,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>{t(UI_STRINGS.back)}</button>
      )}
    </div>
  );
}
