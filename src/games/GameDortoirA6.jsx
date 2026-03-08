import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 45;
const TARGET_TEMP = 38;
const NUM_TOUCANS = 6;
const POOL_SIZE = 100;
const WIND_INTERVAL = 10;

export default function GameDortoirA6({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();

  const makeToucans = () => {
    const baseColors = [
      '#FF6B35', '#F7C948', '#2EC4B6', '#E71D36', '#7209B7', '#3A86FF',
    ];
    return Array(NUM_TOUCANS).fill(null).map((_, i) => {
      const sizeOrder = NUM_TOUCANS - i; // 6=biggest, 1=smallest
      const rx = 18 + sizeOrder * 5;
      const ry = 12 + sizeOrder * 3;
      return {
        id: i,
        order: sizeOrder,
        rx, ry,
        color: baseColors[i],
        beakColor: '#F5A623',
        homeX: 0, homeY: 0,
        x: 0, y: 0,
        placed: false,
        slotIndex: -1,
        wobble: 0,
        popAnim: 0,
        visible: true,
      };
    });
  };

  const state = useRef({
    toucans: makeToucans(),
    temperature: 18,
    targetTemp: TARGET_TEMP,
    timeLeft: GAME_DURATION,
    placedCount: 0,
    lastPlacedOrder: 7,
    dragging: null,
    dragOffX: 0,
    dragOffY: 0,
    holeX: 0,
    holeY: 0,
    holeRadius: 60,
    windTimer: WIND_INTERVAL,
    windActive: false,
    windAlpha: 0,
    windDir: 1,
    wrongFlash: 0,
    correctFlash: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    layoutDone: false,
    slots: [],
  });

  const spawnParticles = useCallback((cx, cy, count, colors) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 24;
        p.y = cy + (Math.random() - 0.5) * 16;
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 80;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.r = c[0]; p.g = c[1]; p.b = c[2];
        p.size = 1.5 + Math.random() * 3;
        p.type = Math.random() > 0.5 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const layoutPositions = useCallback((w, h) => {
    const s = state.current;
    s.holeX = w / 2;
    s.holeY = h * 0.4;
    s.holeRadius = Math.min(w, h) * 0.12;

    // Scatter toucans around edges
    const margin = 50;
    const positions = [
      { x: margin + 40, y: h * 0.75 },
      { x: w - margin - 40, y: h * 0.75 },
      { x: margin + 30, y: h * 0.88 },
      { x: w - margin - 30, y: h * 0.88 },
      { x: w * 0.3, y: h * 0.92 },
      { x: w * 0.7, y: h * 0.92 },
    ];

    // Shuffle positions
    for (let i = positions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [positions[i], positions[j]] = [positions[j], positions[i]];
    }

    for (let i = 0; i < NUM_TOUCANS; i++) {
      const t = s.toucans[i];
      if (!t.placed) {
        t.homeX = positions[i].x;
        t.homeY = positions[i].y;
        t.x = t.homeX;
        t.y = t.homeY;
      }
    }

    // Pre-compute slots inside hole for placed toucans
    s.slots = [];
    const slotAngles = [0, Math.PI * 0.33, Math.PI * 0.66, Math.PI, Math.PI * 1.33, Math.PI * 1.66];
    for (let i = 0; i < NUM_TOUCANS; i++) {
      const r = s.holeRadius * 0.35;
      s.slots.push({
        x: s.holeX + Math.cos(slotAngles[i]) * r,
        y: s.holeY + Math.sin(slotAngles[i]) * r,
      });
    }

    s.layoutDone = true;
  }, []);

  const handleDragStart = useCallback((info) => {
    if (phase !== 'playing') {
      if (phase === 'ready') setPhase('playing');
      return;
    }
    const s = state.current;
    // Find touched toucan (unplaced, nearest)
    let best = null;
    let bestDist = 60;
    for (const t of s.toucans) {
      if (t.placed || !t.visible) continue;
      const dx = info.x - t.x;
      const dy = info.y - t.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < bestDist) {
        bestDist = dist;
        best = t;
      }
    }
    if (best) {
      s.dragging = best;
      s.dragOffX = best.x - info.x;
      s.dragOffY = best.y - info.y;
    }
  }, [phase]);

  const handleDrag = useCallback((info) => {
    const s = state.current;
    if (!s.dragging) return;
    s.dragging.x = info.x + s.dragOffX;
    s.dragging.y = info.y + s.dragOffY;
  }, []);

  const handleDragEnd = useCallback(() => {
    const s = state.current;
    if (!s.dragging) return;
    const t = s.dragging;
    s.dragging = null;

    // Check if dropped in hole
    const dx = t.x - s.holeX;
    const dy = t.y - s.holeY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < s.holeRadius + 15) {
      // Check order: must place biggest first (order 6, 5, 4...)
      const expectedOrder = NUM_TOUCANS - s.placedCount;
      if (t.order === expectedOrder) {
        // Correct placement
        t.placed = true;
        const slotIdx = s.placedCount;
        t.slotIndex = slotIdx;
        t.x = s.slots[slotIdx].x;
        t.y = s.slots[slotIdx].y;
        s.placedCount++;
        s.lastPlacedOrder = t.order;
        // Temperature rises per toucan
        s.temperature = Math.min(TARGET_TEMP, s.temperature + (TARGET_TEMP - 18) / NUM_TOUCANS);
        s.correctFlash = 0.4;

        spawnParticles(s.holeX, s.holeY, 10, [
          [46, 234, 163], [245, 166, 35], [255, 255, 255],
        ]);
        sounds.chime();
      } else {
        // Wrong order: pop out with squawk
        t.popAnim = 1.0;
        t.x = t.homeX;
        t.y = t.homeY;
        s.wrongFlash = 0.4;
        spawnParticles(s.holeX, s.holeY, 6, [
          [239, 68, 68], [255, 100, 100], [255, 200, 200],
        ]);
        sounds.tick();
      }
    } else {
      // Snap back
      t.x = t.homeX;
      t.y = t.homeY;
    }
  }, [sounds, spawnParticles]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') setPhase('playing');
  }, [phase]);

  useTouch(canvasRef, {
    onTap: handleTap,
    onHoldStart: handleDragStart,
    onDrag: handleDrag,
    onHoldEnd: handleDragEnd,
  });

  // Also handle quick drags (not just holds)
  const pointerState = useRef({ down: false, startX: 0, startY: 0 });
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onDown = (e) => {
      pointerState.current.down = true;
      pointerState.current.startX = e.clientX;
      pointerState.current.startY = e.clientY;
      if (phase === 'playing') {
        handleDragStart({ x: e.clientX, y: e.clientY });
      }
    };
    const onMove = (e) => {
      if (!pointerState.current.down) return;
      handleDrag({ x: e.clientX, y: e.clientY, dx: 0, dy: 0 });
    };
    const onUp = () => {
      if (pointerState.current.down) {
        pointerState.current.down = false;
        handleDragEnd();
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, [phase, handleDragStart, handleDrag, handleDragEnd]);

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

    if (!s.layoutDone) layoutPositions(w, h);

    if (phase === 'ready') {
      // Night jungle background
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#0B132B');
      bg.addColorStop(0.6, '#1C2541');
      bg.addColorStop(1, '#3A506B');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Dortoir \u00e0 6', cx, h * 0.22);
      ctx.font = '17px sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('Toucans sleep 6 in a tree hole', cx, h * 0.32);
      ctx.fillText('to stay warm!', cx, h * 0.32 + 24);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('DRAG toucans into the hole', cx, h * 0.45);
      ctx.fillText('Biggest first, smallest last!', cx, h * 0.45 + 22);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      ctx.fillText('TAP TO START', cx, h * 0.6);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // --- UPDATE ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);

    // Wind events
    s.windTimer -= delta;
    if (s.windTimer <= 0) {
      s.windTimer = WIND_INTERVAL;
      if (s.placedCount < NUM_TOUCANS) {
        s.temperature = Math.max(10, s.temperature - 5);
        s.windActive = true;
        s.windAlpha = 1.0;
        s.windDir = Math.random() > 0.5 ? 1 : -1;
        sounds.whoosh();
      }
    }

    // Wind visual decay
    if (s.windActive) {
      s.windAlpha -= delta * 1.5;
      if (s.windAlpha <= 0) {
        s.windActive = false;
        s.windAlpha = 0;
      }
    }

    // Flash decays
    s.wrongFlash *= Math.pow(0.01, delta);
    s.correctFlash *= Math.pow(0.01, delta);

    // Toucan pop animation decay
    for (const t of s.toucans) {
      if (t.popAnim > 0) t.popAnim -= delta * 3;
      t.wobble = Math.sin(elapsed * 3 + t.id * 1.5) * 2;
    }

    // Particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 40 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over
    if ((s.timeLeft <= 0 || s.placedCount === NUM_TOUCANS) && phase === 'playing') {
      const speedBonus = Math.max(1, 1 + (s.timeLeft / GAME_DURATION));
      const score = Math.round(s.temperature * speedBonus * s.placedCount);
      setPhase('ended');
      setDisplayScore(score);
      return;
    }

    // --- RENDER ---
    // Night jungle background
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0B132B');
    bg.addColorStop(0.5, '#1C2541');
    bg.addColorStop(1, '#2A3A50');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Stars
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 30; i++) {
      const sx = ((i * 137.5) % w);
      const sy = ((i * 97.3) % (h * 0.4));
      const twinkle = 0.2 + Math.sin(elapsed * 2 + i) * 0.15;
      ctx.globalAlpha = twinkle;
      ctx.beginPath();
      ctx.arc(sx, sy, 1 + (i % 3) * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Tree trunk
    const trunkW = 90;
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(cx - trunkW / 2, h * 0.15, trunkW, h * 0.7);
    // Bark texture lines
    ctx.strokeStyle = '#5D4037';
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const ly = h * 0.2 + i * (h * 0.06);
      ctx.beginPath();
      ctx.moveTo(cx - trunkW / 2 + 5, ly);
      ctx.quadraticCurveTo(cx, ly + 5, cx + trunkW / 2 - 5, ly - 3);
      ctx.stroke();
    }

    // Branches
    ctx.strokeStyle = '#4E342E';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx - trunkW / 2, h * 0.25);
    ctx.quadraticCurveTo(cx - 80, h * 0.2, cx - 110, h * 0.18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + trunkW / 2, h * 0.22);
    ctx.quadraticCurveTo(cx + 80, h * 0.17, cx + 100, h * 0.15);
    ctx.stroke();

    // Tree hole (dark cavity)
    const hx = s.holeX;
    const hy = s.holeY;
    const hr = s.holeRadius;
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr + 8, hr * 0.85 + 8, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2E1B0F';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(hx, hy, hr, hr * 0.85, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1A0F05';
    ctx.fill();

    // Warm glow inside hole based on temperature
    const warmth = Math.max(0, (s.temperature - 18) / (TARGET_TEMP - 18));
    if (warmth > 0) {
      const glow = ctx.createRadialGradient(hx, hy, 0, hx, hy, hr);
      glow.addColorStop(0, `rgba(255,140,50,${warmth * 0.3})`);
      glow.addColorStop(1, 'rgba(255,100,30,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.ellipse(hx, hy, hr, hr * 0.85, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw placed toucans inside hole
    for (const t of s.toucans) {
      if (!t.placed) continue;
      drawToucan(ctx, t.x, t.y + t.wobble, t.rx * 0.7, t.ry * 0.7, t.color, t.beakColor, 0.85);
    }

    // Draw unplaced toucans (including the one being dragged)
    for (const t of s.toucans) {
      if (t.placed || !t.visible) continue;
      const scale = t.popAnim > 0 ? 1 + t.popAnim * 0.3 : 1;
      const alpha = t.popAnim > 0 ? 0.6 + t.popAnim * 0.4 : 1;
      drawToucan(ctx, t.x, t.y + t.wobble, t.rx * scale, t.ry * scale, t.color, t.beakColor, alpha);
      // Order label
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.white;
      ctx.globalAlpha = 0.7;
      ctx.fillText(`#${t.order}`, t.x, t.y + t.ry + 14);
      ctx.globalAlpha = 1;
    }

    // Order hint at hole
    if (s.placedCount < NUM_TOUCANS) {
      const expected = NUM_TOUCANS - s.placedCount;
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(`Next: #${expected}`, hx, hy + hr + 20);
    }

    // Particles
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

    // Wind visual
    if (s.windAlpha > 0.01) {
      ctx.save();
      ctx.globalAlpha = s.windAlpha * 0.5;
      ctx.strokeStyle = '#AED9E0';
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 12; i++) {
        const lx = (i * w / 12) + s.windDir * (1 - s.windAlpha) * 60;
        const ly = h * 0.2 + (i % 4) * h * 0.15;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + s.windDir * 40, ly + 3);
        ctx.stroke();
      }
      ctx.restore();
    }

    // Wrong flash
    if (s.wrongFlash > 0.01) {
      ctx.fillStyle = `rgba(239,68,68,${s.wrongFlash * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }
    // Correct flash
    if (s.correctFlash > 0.01) {
      ctx.fillStyle = `rgba(46,234,163,${s.correctFlash * 0.25})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Temperature gauge (right side)
    const gaugeX = w - 30;
    const gaugeTop = h * 0.15;
    const gaugeH = h * 0.35;
    const gaugeW = 18;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(gaugeX - gaugeW / 2, gaugeTop, gaugeW, gaugeH, 6);
    ctx.fill();
    ctx.stroke();
    // Fill
    const tempFrac = Math.max(0, (s.temperature - 10) / (TARGET_TEMP - 10));
    const fillH = gaugeH * Math.min(1, tempFrac);
    const tempGrad = ctx.createLinearGradient(0, gaugeTop + gaugeH - fillH, 0, gaugeTop + gaugeH);
    tempGrad.addColorStop(0, '#FF6B35');
    tempGrad.addColorStop(1, '#E71D36');
    ctx.fillStyle = tempGrad;
    ctx.beginPath();
    ctx.roundRect(gaugeX - gaugeW / 2 + 2, gaugeTop + gaugeH - fillH + 2, gaugeW - 4, Math.max(0, fillH - 4), 4);
    ctx.fill();
    // Thermometer bulb
    ctx.beginPath();
    ctx.arc(gaugeX, gaugeTop + gaugeH + 14, 10, 0, Math.PI * 2);
    ctx.fillStyle = s.temperature >= TARGET_TEMP ? COLORS.red : '#FF6B35';
    ctx.fill();
    // Label
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`${Math.round(s.temperature)}\u00b0C`, gaugeX, gaugeTop - 10);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`Goal: ${TARGET_TEMP}\u00b0`, gaugeX, gaugeTop - 10 + 14);

    // Placed counter
    ctx.font = '15px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Toucans: ${s.placedCount}/${NUM_TOUCANS}`, 20, h * 0.15 - 5);

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer text
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    // Wind warning
    if (s.windTimer < 2 && !s.windActive) {
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      const warnAlpha = 0.5 + Math.sin(elapsed * 8) * 0.5;
      ctx.globalAlpha = warnAlpha;
      ctx.fillText('WIND INCOMING!', cx, 65);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [phase, sounds, spawnParticles, layoutPositions]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.toucans = makeToucans();
      s.temperature = 18;
      s.timeLeft = GAME_DURATION;
      s.placedCount = 0;
      s.lastPlacedOrder = 7;
      s.dragging = null;
      s.windTimer = WIND_INTERVAL;
      s.windActive = false;
      s.windAlpha = 0;
      s.wrongFlash = 0;
      s.correctFlash = 0;
      s.layoutDone = false;
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
          <div style={{ color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>Results</div>
          <div style={{ color: COLORS.gold, fontSize: 20, marginBottom: 8 }}>
            {state.current.placedCount}/{NUM_TOUCANS} toucans placed
          </div>
          <div style={{ color: COLORS.cyan, fontSize: 18, marginBottom: 8 }}>
            Temperature: {Math.round(state.current.temperature)}&deg;C
          </div>
          <div style={{ color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4 }}>
            {displayScore}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>points</div>
          <button onClick={() => onComplete(displayScore)} style={{
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

function drawToucan(ctx, x, y, rx, ry, bodyColor, beakColor, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(x, y);

  // Body (ellipse)
  ctx.beginPath();
  ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = bodyColor;
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // Belly
  ctx.beginPath();
  ctx.ellipse(2, 2, rx * 0.6, ry * 0.7, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#FFF8E1';
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(rx * 0.7, -ry * 0.4, ry * 0.55, 0, Math.PI * 2);
  ctx.fillStyle = '#111';
  ctx.fill();

  // Eye
  ctx.beginPath();
  ctx.arc(rx * 0.8, -ry * 0.5, 2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();
  ctx.beginPath();
  ctx.arc(rx * 0.85, -ry * 0.52, 1, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  // Beak (large colorful toucan beak)
  ctx.beginPath();
  ctx.moveTo(rx * 0.95, -ry * 0.3);
  ctx.quadraticCurveTo(rx * 1.6, -ry * 0.5, rx * 1.7, -ry * 0.2);
  ctx.quadraticCurveTo(rx * 1.5, ry * 0.1, rx * 0.9, 0);
  ctx.closePath();
  ctx.fillStyle = beakColor;
  ctx.fill();
  // Beak tip
  ctx.beginPath();
  ctx.arc(rx * 1.65, -ry * 0.2, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#333';
  ctx.fill();

  ctx.restore();
}
