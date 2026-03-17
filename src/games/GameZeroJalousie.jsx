import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';

const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";
const GAME_DURATION = 45;
const POOL_SIZE = 100;
const PARROT_COLORS = [
  { body: '#E91E8C', eye: '#FFF', name: 'Rosa' },
  { body: '#00D4FF', eye: '#FFF', name: 'Azur' },
  { body: '#2EEAA3', eye: '#FFF', name: 'Vert' },
];
const CONSUME_RATES = [0.08, 0.14, 0.22]; // slow, medium, fast per second (satisfaction units)
const TOKEN_SPAWN_INTERVAL = 1.2;
const MAX_TOKENS = 8;
const TOKEN_RADIUS = 14;
const PARROT_RADIUS = 38;
const SATISFACTION_WARN = 30;
const SATISFACTION_GOAL = 70;

export default function GameZeroJalousie({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION,
    parrots: PARROT_COLORS.map((_, i) => ({
      satisfaction: 75,
      consumeRate: CONSUME_RATES[i],
      feedFlash: 0,
      squawkTimer: 0,
      bobPhase: Math.random() * Math.PI * 2,
    })),
    tokens: [],
    tokenSpawnTimer: 0,
    dragging: null, // { tokenIndex, x, y }
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    score: 0,
    timeSurvived: 0,
    penaltyFlash: 0,
    parrotPositions: [], // computed each frame
    centerX: 0,
    centerY: 0,
    lastWarningTime: 0,
  });

  const spawnParticles = useCallback((cx, cy, count, color) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 20;
        p.y = cy + (Math.random() - 0.5) * 20;
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 100;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.4 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = color[0]; p.g = color[1]; p.b = color[2];
        p.size = 2 + Math.random() * 3;
        p.type = Math.random() > 0.4 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const spawnToken = useCallback((w, h) => {
    const s = state.current;
    if (s.tokens.length >= MAX_TOKENS) return;
    const angle = Math.random() * Math.PI * 2;
    const dist = 15 + Math.random() * 20;
    s.tokens.push({
      x: s.centerX + Math.cos(angle) * dist,
      y: s.centerY + Math.sin(angle) * dist,
      radius: TOKEN_RADIUS,
      sparkle: Math.random() * Math.PI * 2,
    });
    sounds.pop();
  }, [sounds]);

  const getParrotPositions = useCallback((w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    const spread = Math.min(w, h) * 0.3;
    return [
      { x: cx - spread, y: h * 0.22 },
      { x: cx + spread, y: h * 0.22 },
      { x: cx, y: h * 0.82 },
    ];
  }, []);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') setPhase('playing');
    }
  }, [phase]);

  const handleDrag = useCallback(({ x, y }) => {
    if (phase !== 'playing') return;
    const s = state.current;
    if (s.dragging !== null) {
      s.dragging.x = x;
      s.dragging.y = y;
    }
  }, [phase]);

  const handlePointerDown = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        sounds.countdown(true);
        haptics.tapFeedback();
      }
      return;
    }
    const s = state.current;
    // Check if touching a token
    for (let i = 0; i < s.tokens.length; i++) {
      const tk = s.tokens[i];
      const dx = x - tk.x;
      const dy = y - tk.y;
      if (dx * dx + dy * dy < (tk.radius + 20) * (tk.radius + 20)) {
        s.dragging = { tokenIndex: i, x, y };
        sounds.tick();
        haptics.tapFeedback();
        return;
      }
    }
  }, [phase, sounds, haptics]);

  const handlePointerUp = useCallback(({ x, y }) => {
    if (phase !== 'playing') return;
    const s = state.current;
    if (s.dragging === null) return;
    const tokenIdx = s.dragging.tokenIndex;
    s.dragging = null;

    if (tokenIdx >= s.tokens.length) return;

    // Check if dropped on a parrot
    for (let pi = 0; pi < s.parrotPositions.length; pi++) {
      const pp = s.parrotPositions[pi];
      const dx = x - pp.x;
      const dy = y - pp.y;
      if (dx * dx + dy * dy < (PARROT_RADIUS + 30) * (PARROT_RADIUS + 30)) {
        // Feed this parrot
        s.parrots[pi].satisfaction = Math.min(100, s.parrots[pi].satisfaction + 15);
        s.parrots[pi].feedFlash = 0.5;
        s.tokens.splice(tokenIdx, 1);
        const col = PARROT_COLORS[pi].body;
        const r = parseInt(col.slice(1, 3), 16);
        const g = parseInt(col.slice(3, 5), 16);
        const b = parseInt(col.slice(5, 7), 16);
        spawnParticles(pp.x, pp.y, 12, [r, g, b]);
        sounds.chime();
        haptics.impactFeedback();
        juice.flash(col, 0.3);
        juice.drawGlow;
        return;
      }
    }
    // Not dropped on parrot — token stays
    sounds.drop();
  }, [phase, sounds, spawnParticles, haptics, juice]);

  // Use raw pointer events for drag support
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    el.style.touchAction = 'none';

    const onDown = (e) => {
      e.preventDefault();
      handlePointerDown({ x: e.clientX, y: e.clientY });
    };
    const onMove = (e) => {
      e.preventDefault();
      handleDrag({ x: e.clientX, y: e.clientY });
    };
    const onUp = (e) => {
      e.preventDefault();
      handlePointerUp({ x: e.clientX, y: e.clientY });
    };

    el.addEventListener('pointerdown', onDown, { passive: false });
    el.addEventListener('pointermove', onMove, { passive: false });
    el.addEventListener('pointerup', onUp, { passive: false });
    el.addEventListener('pointercancel', onUp, { passive: false });

    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [handlePointerDown, handleDrag, handlePointerUp]);

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
    const cy = h / 2;
    s.centerX = cx;
    s.centerY = cy;
    s.parrotPositions = getParrotPositions(w, h);

    if (phase === 'ready') {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1a2a1c');
      bg.addColorStop(1, '#2a4a2c');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['11']), cx, cy - 60, COLORS.mint, 32);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 8;
      ctx.fillText('Parrots share without jealousy!', cx, cy - 10);
      ctx.fillText('Drag tokens to feed each parrot fairly.', cx, cy + 16);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Keep all 3 parrots above 70% for 45s', cx, cy + 55);

      // Pulsing neon TAP TO START
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, cy + 110, COLORS.cyan, 22);
      ctx.globalAlpha = 1;

      ctx.restore();
      return;
    }

    // --- UPDATE ---
    juice.update(delta);

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.timeSurvived = elapsed;

    // Spawn tokens
    s.tokenSpawnTimer += delta;
    if (s.tokenSpawnTimer >= TOKEN_SPAWN_INTERVAL) {
      s.tokenSpawnTimer -= TOKEN_SPAWN_INTERVAL;
      spawnToken(w, h);
    }

    // Update parrots
    let anyBelow30 = false;
    for (let i = 0; i < 3; i++) {
      const p = s.parrots[i];
      p.satisfaction = Math.max(0, p.satisfaction - p.consumeRate * delta * 100);
      p.feedFlash = Math.max(0, p.feedFlash - delta * 2);
      p.bobPhase += delta * 2.5;
      p.squawkTimer = Math.max(0, p.squawkTimer - delta);

      if (p.satisfaction < SATISFACTION_WARN) {
        anyBelow30 = true;
        if (p.squawkTimer <= 0) {
          p.squawkTimer = 1.5;
          s.penaltyFlash = 0.3;
          p.satisfaction = Math.max(0, p.satisfaction - 5); // penalty
          sounds.firecrackle();
          haptics.warningFeedback();
          juice.shake(6, 0.25);
          juice.flash('#EF4444', 0.4);
        }
      }
    }

    // Warning haptic heartbeat when any parrot is low
    if (anyBelow30 && elapsed - s.lastWarningTime > 2) {
      s.lastWarningTime = elapsed;
      haptics.heartbeatFeedback();
    }

    // Low time warning
    if (s.timeLeft < 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      sounds.countdown(false);
      haptics.warningFeedback();
    }

    // Dragged token follows pointer
    if (s.dragging !== null && s.dragging.tokenIndex < s.tokens.length) {
      const tk = s.tokens[s.dragging.tokenIndex];
      tk.x = s.dragging.x;
      tk.y = s.dragging.y;
    }

    // Token sparkle animation
    for (const tk of s.tokens) {
      tk.sparkle += delta * 4;
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 30 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    s.penaltyFlash = Math.max(0, s.penaltyFlash - delta * 2);

    // Compute score
    const avgSat = s.parrots.reduce((sum, p) => sum + p.satisfaction, 0) / 3;
    s.score = Math.round(avgSat * s.timeSurvived);

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      const allAbove70 = s.parrots.every(p => p.satisfaction >= SATISFACTION_GOAL);
      if (allAbove70) {
        sounds.success();
        haptics.successFeedback();
        juice.flash('#2EEAA3', 0.5);
      } else {
        sounds.fail();
        haptics.failFeedback();
        juice.flash('#EF4444', 0.5);
        juice.shake(10, 0.4);
      }
      setPhase('ended');
      setDisplayScore(s.score);
      return;
    }

    // --- RENDER ---
    // Apply shake
    juice.applyShake(ctx);

    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1a2a1c');
    bg.addColorStop(0.6, '#2a5a2c');
    bg.addColorStop(1, '#1a3a1c');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Decorative leaves
    ctx.globalAlpha = 0.06;
    for (let i = 0; i < 6; i++) {
      const lx = (i * w / 5) + Math.sin(elapsed + i) * 10;
      const ly = Math.sin(elapsed * 0.5 + i * 1.3) * 15;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 50, 20, Math.PI / 4 + i * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#4a8a4c';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Penalty flash
    if (s.penaltyFlash > 0.01) {
      ctx.fillStyle = `rgba(239,68,68,${s.penaltyFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw parrots
    for (let i = 0; i < 3; i++) {
      const pp = s.parrotPositions[i];
      const parrot = s.parrots[i];
      const col = PARROT_COLORS[i];
      const bobY = Math.sin(parrot.bobPhase) * 4;

      ctx.save();
      ctx.translate(pp.x, pp.y + bobY);

      // Ambient glow around parrots (additive blending)
      const glowAlpha = 0.15 + Math.sin(elapsed * 2 + i) * 0.05;
      juice.drawGlow(ctx, 0, 0, PARROT_RADIUS + 30, col.body, glowAlpha);

      // Feed flash glow (enhanced)
      if (parrot.feedFlash > 0.01) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.beginPath();
        ctx.arc(0, 0, PARROT_RADIUS + 20, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,200,${parrot.feedFlash * 0.6})`;
        ctx.fill();
        ctx.restore();
      }

      // Warning glow for low satisfaction
      if (parrot.satisfaction < SATISFACTION_WARN) {
        const warnPulse = 0.2 + Math.sin(elapsed * 8) * 0.15;
        juice.drawGlow(ctx, 0, 0, PARROT_RADIUS + 25, '#EF4444', warnPulse);
      }

      // Body circle
      ctx.beginPath();
      ctx.arc(0, 0, PARROT_RADIUS, 0, Math.PI * 2);
      const bodyGrad = ctx.createRadialGradient(-8, -8, 5, 0, 0, PARROT_RADIUS);
      bodyGrad.addColorStop(0, col.body + 'CC');
      bodyGrad.addColorStop(1, col.body);
      ctx.fillStyle = bodyGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Eyes
      const eyeOff = parrot.satisfaction < SATISFACTION_WARN ? 0 : 0;
      ctx.beginPath();
      ctx.arc(-10, -8, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(-10, -8, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, -8, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#FFF';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(10, -8, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#111';
      ctx.fill();

      // Beak
      ctx.beginPath();
      ctx.moveTo(-6, 4);
      ctx.lineTo(0, 14);
      ctx.lineTo(6, 4);
      ctx.closePath();
      ctx.fillStyle = '#F5A623';
      ctx.fill();

      // Squawk indicator (neon text)
      if (parrot.squawkTimer > 0.5) {
        juice.drawNeonText(ctx, 'SQUAWK!', 0, -PARROT_RADIUS - 26, COLORS.red, 16);
      }

      // Satisfaction bar background
      const barW = PARROT_RADIUS * 2;
      const barH = 8;
      const barX = -barW / 2;
      const barY = PARROT_RADIUS + 10;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, barH);

      // Satisfaction bar fill
      const satFrac = parrot.satisfaction / 100;
      const barColor = parrot.satisfaction < SATISFACTION_WARN ? COLORS.red :
                       parrot.satisfaction < SATISFACTION_GOAL ? COLORS.gold : COLORS.green;
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW * satFrac, barH);

      // Bar glow (additive)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY - 1, barW * satFrac, barH + 2);
      ctx.restore();

      // Satisfaction percentage (neon)
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = barColor;
      ctx.shadowBlur = 6;
      ctx.fillStyle = COLORS.white;
      ctx.fillText(`${Math.round(parrot.satisfaction)}%`, 0, barY + barH + 14);
      ctx.shadowBlur = 0;

      // Parrot name
      ctx.font = `11px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText(col.name, 0, barY + barH + 28);

      ctx.restore();
    }

    // Draw center zone indicator
    ctx.beginPath();
    ctx.arc(cx, cy, 35, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.15)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw tokens with glow and additive blending
    for (let i = 0; i < s.tokens.length; i++) {
      const tk = s.tokens[i];
      const isDragged = s.dragging !== null && s.dragging.tokenIndex === i;

      ctx.save();
      ctx.translate(tk.x, tk.y);
      if (isDragged) ctx.scale(1.2, 1.2);

      // Token outer glow (additive)
      juice.drawGlow(ctx, 0, 0, tk.radius + 16, '#FFD700', 0.2 + Math.sin(tk.sparkle) * 0.1);

      // Token glow
      ctx.beginPath();
      ctx.arc(0, 0, tk.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245,166,35,${0.15 + Math.sin(tk.sparkle) * 0.1})`;
      ctx.fill();

      // Token body
      ctx.beginPath();
      ctx.arc(0, 0, tk.radius, 0, Math.PI * 2);
      const tGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, tk.radius);
      tGrad.addColorStop(0, '#FFD700');
      tGrad.addColorStop(1, '#B8860B');
      ctx.fillStyle = tGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Sparkle highlight
      ctx.beginPath();
      ctx.arc(-3, -4, 3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();

      // Dragged token trail glow
      if (isDragged) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.3;
        ctx.beginPath();
        ctx.arc(0, 0, tk.radius + 8, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    }

    // Draw particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      if (p.type === 'line') {
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.lineWidth = p.size * 0.8;
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.fill();
      }
    }
    ctx.restore();

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.mint;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer bar glow (additive)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.4;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 6);
    ctx.restore();

    // Timer text (neon)
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, s.timeLeft < 5 ? COLORS.red : COLORS.white, 24);

    // Score display (neon)
    juice.drawNeonText(ctx, t(UI_STRINGS.score) + ': ' + s.score, cx, h * 0.5, COLORS.gold, 22);

    // Instruction hint
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('Drag tokens to parrots', cx, h * 0.5 + 22);

    // All-above-70 indicator (neon green)
    const allAbove70 = s.parrots.every(p => p.satisfaction >= SATISFACTION_GOAL);
    if (allAbove70) {
      juice.drawNeonText(ctx, 'All happy!', cx, 40, COLORS.green, 16);
    }

    // Screen flash overlay
    juice.drawFlash(ctx, w, h);

    // Bloom post-processing
    juice.applyBloom(ctx, w, h, 0.08);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, spawnToken, getParrotPositions, t]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION;
      s.tokens = [];
      s.tokenSpawnTimer = 0;
      s.dragging = null;
      s.score = 0;
      s.timeSurvived = 0;
      s.penaltyFlash = 0;
      s.lastWarningTime = 0;
      for (let i = 0; i < 3; i++) {
        s.parrots[i].satisfaction = 75;
        s.parrots[i].feedFlash = 0;
        s.parrots[i].squawkTimer = 0;
      }
      for (const p of s.particles) p.active = false;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const avgSatisfaction = Math.round(state.current.parrots.reduce((s, p) => s + p.satisfaction, 0) / 3);
  const allAbove70End = state.current.parrots.every(p => p.satisfaction >= SATISFACTION_GOAL);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 32, fontWeight: 'bold', marginBottom: 16,
            textShadow: `0 0 20px ${COLORS.mint}, 0 0 40px ${COLORS.mint}80`,
          }}>
            {t(GAME_NAMES['11'])}
          </div>
          <div style={{
            color: allAbove70End ? COLORS.green : COLORS.gold,
            fontSize: 16, marginBottom: 12, fontWeight: 'bold',
            textShadow: `0 0 10px ${allAbove70End ? COLORS.green : COLORS.gold}`,
          }}>
            {allAbove70End ? 'All parrots happy!' : 'Some parrots were hungry...'}
          </div>
          <div style={{
            color: COLORS.mint, fontSize: 18, marginBottom: 8,
            textShadow: `0 0 8px ${COLORS.mint}80`,
          }}>
            Avg satisfaction: {avgSatisfaction}%
          </div>
          <div style={{
            color: COLORS.cyan, fontSize: 16, marginBottom: 4,
            textShadow: `0 0 8px ${COLORS.cyan}80`,
          }}>
            Time survived: {Math.round(state.current.timeSurvived)}s
          </div>
          <div style={{
            color: COLORS.white, fontSize: 52, fontWeight: 'bold', marginBottom: 4,
            textShadow: `0 0 30px ${COLORS.gold}, 0 0 60px ${COLORS.gold}60`,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 14, marginBottom: 28,
            textShadow: `0 0 6px ${COLORS.gray}40`,
          }}>{t(UI_STRINGS.points)}</div>
          <button
            onClick={() => {
              sounds.chime();
              haptics.tapFeedback();
              onComplete(state.current.score);
            }}
            style={{
              background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.mint})`,
              color: COLORS.primary,
              border: 'none',
              padding: '14px 44px',
              borderRadius: 14,
              fontSize: 18,
              fontWeight: 'bold',
              cursor: 'pointer',
              marginBottom: 12,
              fontFamily: FONT_FAMILY,
              boxShadow: `0 0 20px ${COLORS.cyan}60, 0 4px 12px rgba(0,0,0,0.3)`,
              textShadow: 'none',
            }}
          >{t(UI_STRINGS.continueBtn)}</button>
          <button
            onClick={() => {
              sounds.tick();
              haptics.tapFeedback();
              onBack();
            }}
            style={{
              background: 'rgba(255,255,255,0.06)',
              color: COLORS.gray,
              border: `1px solid ${COLORS.gray}60`,
              padding: '10px 32px',
              borderRadius: 14,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: FONT_FAMILY,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
              textShadow: `0 0 6px ${COLORS.gray}40`,
            }}
          >{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button
          onClick={() => {
            sounds.tick();
            haptics.tapFeedback();
            onBack();
          }}
          style={{
            position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
            color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
            fontSize: 14, cursor: 'pointer', zIndex: 10,
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}
        >{t(UI_STRINGS.back)}</button>
      )}
    </div>
  );
}
