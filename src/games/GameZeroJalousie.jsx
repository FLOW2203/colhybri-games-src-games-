import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

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
  }, []);

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
      if (phase === 'ready') setPhase('playing');
      return;
    }
    const s = state.current;
    // Check if touching a token
    for (let i = 0; i < s.tokens.length; i++) {
      const t = s.tokens[i];
      const dx = x - t.x;
      const dy = y - t.y;
      if (dx * dx + dy * dy < (t.radius + 20) * (t.radius + 20)) {
        s.dragging = { tokenIndex: i, x, y };
        sounds.tick();
        return;
      }
    }
  }, [phase, sounds]);

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
        spawnParticles(pp.x, pp.y, 8, [r, g, b]);
        sounds.chime();
        return;
      }
    }
    // Not dropped on parrot — token stays
  }, [phase, sounds, spawnParticles]);

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

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Zéro Jalousie', cx, cy - 60);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Parrots share without jealousy!', cx, cy - 10);
      ctx.fillText('Drag tokens to feed each parrot fairly.', cx, cy + 16);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Keep all 3 parrots above 70% for 45s', cx, cy + 55);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      ctx.fillText('TAP TO START', cx, cy + 110);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // --- UPDATE ---
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
        }
      }
    }

    // Dragged token follows pointer
    if (s.dragging !== null && s.dragging.tokenIndex < s.tokens.length) {
      const t = s.tokens[s.dragging.tokenIndex];
      t.x = s.dragging.x;
      t.y = s.dragging.y;
    }

    // Token sparkle animation
    for (const t of s.tokens) {
      t.sparkle += delta * 4;
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
      setPhase('ended');
      setDisplayScore(s.score);
      return;
    }

    // --- RENDER ---
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

      // Feed flash glow
      if (parrot.feedFlash > 0.01) {
        ctx.beginPath();
        ctx.arc(0, 0, PARROT_RADIUS + 12, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,200,${parrot.feedFlash * 0.4})`;
        ctx.fill();
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

      // Squawk indicator
      if (parrot.squawkTimer > 0.5) {
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = COLORS.red;
        ctx.fillText('SQUAWK!', 0, -PARROT_RADIUS - 22);
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

      // Satisfaction percentage
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.white;
      ctx.fillText(`${Math.round(parrot.satisfaction)}%`, 0, barY + barH + 14);

      // Parrot name
      ctx.font = '11px sans-serif';
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

    // Draw tokens
    for (let i = 0; i < s.tokens.length; i++) {
      const t = s.tokens[i];
      const isDragged = s.dragging !== null && s.dragging.tokenIndex === i;

      ctx.save();
      ctx.translate(t.x, t.y);
      if (isDragged) ctx.scale(1.2, 1.2);

      // Token glow
      ctx.beginPath();
      ctx.arc(0, 0, t.radius + 4, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245,166,35,${0.15 + Math.sin(t.sparkle) * 0.1})`;
      ctx.fill();

      // Token body
      ctx.beginPath();
      ctx.arc(0, 0, t.radius, 0, Math.PI * 2);
      const tGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, t.radius);
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

      ctx.restore();
    }

    // Draw particles
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

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.mint;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer text
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    // Score display
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`Score: ${s.score}`, cx, h * 0.5);

    // Instruction hint
    ctx.font = '13px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('Drag tokens to parrots', cx, h * 0.5 + 22);

    // All-above-70 indicator
    const allAbove70 = s.parrots.every(p => p.satisfaction >= SATISFACTION_GOAL);
    if (allAbove70) {
      ctx.font = 'bold 14px sans-serif';
      ctx.fillStyle = COLORS.green;
      ctx.textAlign = 'center';
      ctx.fillText('All happy!', cx, 40);
    }

    ctx.restore();
  }, [phase, sounds, spawnParticles, spawnToken, getParrotPositions]));

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }}>
          <div style={{ color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>
            Zéro Jalousie
          </div>
          <div style={{ color: COLORS.mint, fontSize: 18, marginBottom: 8 }}>
            Avg satisfaction: {Math.round(state.current.parrots.reduce((s, p) => s + p.satisfaction, 0) / 3)}%
          </div>
          <div style={{ color: COLORS.cyan, fontSize: 16, marginBottom: 4 }}>
            Time survived: {Math.round(state.current.timeSurvived)}s
          </div>
          <div style={{ color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4 }}>
            {displayScore}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>points</div>
          <button onClick={() => onComplete(state.current.score)} style={{
            background: COLORS.cyan, color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginBottom: 12,
          }}>Continue</button>
          <button onClick={onBack} style={{
            background: 'transparent', color: COLORS.gray, border: `1px solid ${COLORS.gray}`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
          }}>Back</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={onBack} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
          color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 14, cursor: 'pointer', zIndex: 10,
        }}>Back</button>
      )}
    </div>
  );
}
