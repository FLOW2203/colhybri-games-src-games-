import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 15;
const POOL_SIZE = 100;
const FRUIT_COLORS = [
  { fill: '#FF6B35', stroke: '#CC4400', name: 'orange' },
  { fill: '#FFD700', stroke: '#B8960F', name: 'banana' },
  { fill: '#FF4757', stroke: '#C0392B', name: 'berry' },
  { fill: '#7BED9F', stroke: '#2ECC71', name: 'lime' },
  { fill: '#E056A0', stroke: '#A0306A', name: 'dragonfruit' },
];

export default function GameLancerFruits({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();

  const state = useRef({
    timeLeft: GAME_DURATION,
    score: 0,
    streak: 0,
    bestStreak: 0,
    fruit: {
      active: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      flying: false,
      returning: false,
      caught: false,
      waitingCatch: false,
      size: 20,
      colorIdx: 0,
      rotation: 0,
      flyProgress: 0,
      startX: 0, startY: 0, endX: 0, endY: 0,
    },
    speed: 1.0,
    canThrow: true,
    canCatch: false,
    catchWindow: false,
    catchTimer: 0,
    feedbackText: '',
    feedbackTimer: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    trailParticles: Array(50).fill(null).map(() => ({
      active: false, x: 0, y: 0, life: 0, maxLife: 0, size: 0, r: 0, g: 0, b: 0,
    })),
    leftToucanBob: 0,
    rightToucanBob: 0,
    bgLeaves: Array(12).fill(null).map(() => ({
      x: Math.random() * 1000,
      y: Math.random() * 800,
      size: 10 + Math.random() * 20,
      angle: Math.random() * Math.PI * 2,
      speed: 5 + Math.random() * 15,
      rotSpeed: 0.5 + Math.random() * 2,
    })),
    missFlash: 0,
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
        const speed = 40 + Math.random() * 160;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 2 + Math.random() * 5;
        spawned++;
      }
    }
  }, []);

  const spawnTrail = useCallback((x, y, r, g, b) => {
    const s = state.current;
    for (let i = 0; i < s.trailParticles.length; i++) {
      const p = s.trailParticles[i];
      if (!p.active) {
        p.active = true;
        p.x = x; p.y = y;
        p.life = 0.2 + Math.random() * 0.15;
        p.maxLife = p.life;
        p.size = 3 + Math.random() * 5;
        p.r = r; p.g = g; p.b = b;
        break;
      }
    }
  }, []);

  const setupFruit = useCallback((w, h) => {
    const s = state.current;
    const f = s.fruit;
    f.active = true;
    f.x = w * 0.18;
    f.y = h * 0.42;
    f.flying = false;
    f.returning = false;
    f.waitingCatch = false;
    f.caught = false;
    f.flyProgress = 0;
    f.colorIdx = Math.floor(Math.random() * FRUIT_COLORS.length);
    f.size = 16 + Math.min(8, s.streak * 1.5);
    f.rotation = 0;
    s.canThrow = true;
    s.canCatch = false;
    s.catchWindow = false;
    s.catchTimer = 0;
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') setPhase('playing');
      return;
    }
    const s = state.current;
    const f = s.fruit;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (s.canCatch && f.waitingCatch) {
      // Catch the returning fruit
      f.waitingCatch = false;
      f.caught = true;
      s.canCatch = false;
      s.score++;
      s.streak++;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      s.speed = Math.min(3.0, 1.0 + s.streak * 0.15);
      s.feedbackText = s.streak > 3 ? `Streak ${s.streak}!` : 'Catch!';
      s.feedbackTimer = 0.5;
      spawnParticles(f.x, f.y, 10, 46, 234, 163);
      sounds.chime();
      setDisplayScore(s.score);

      // Setup next throw after brief delay
      setTimeout(() => setupFruit(w, h), 250);
      return;
    }

    if (s.canThrow && f.active && !f.flying && !f.returning) {
      // Throw fruit to right toucan
      f.flying = true;
      f.startX = f.x;
      f.startY = f.y;
      f.endX = w * 0.82;
      f.endY = h * 0.42;
      f.flyProgress = 0;
      s.canThrow = false;
      sounds.whoosh();
    }
  }, [phase, sounds, spawnParticles, setupFruit]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    if (direction === 'right') {
      const s = state.current;
      const f = s.fruit;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (s.canThrow && f.active && !f.flying && !f.returning) {
        f.flying = true;
        f.startX = f.x;
        f.startY = f.y;
        f.endX = w * 0.82;
        f.endY = h * 0.42;
        f.flyProgress = 0;
        s.canThrow = false;
        sounds.whoosh();
      }
    }
  }, [phase, sounds]);

  useTouch(canvasRef, { onTap: handleTap, onSwipe: handleSwipe });

  const drawToucan = useCallback((ctx, x, y, facing, bob, beakColor) => {
    ctx.save();
    ctx.translate(x, y + Math.sin(bob) * 5);
    const dir = facing === 'right' ? 1 : -1;
    ctx.scale(dir, 1);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // White chest
    ctx.beginPath();
    ctx.ellipse(5, 8, 14, 18, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f0e0';
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(8, -25, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // Eye ring
    ctx.beginPath();
    ctx.arc(14, -27, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#87ceeb';
    ctx.fill();
    // Eye
    ctx.beginPath();
    ctx.arc(15, -27, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15.5, -28, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(20, -25);
    ctx.quadraticCurveTo(55, -30, 60, -20);
    ctx.quadraticCurveTo(55, -12, 20, -18);
    ctx.closePath();
    const beakGrad = ctx.createLinearGradient(20, -30, 60, -15);
    beakGrad.addColorStop(0, beakColor);
    beakGrad.addColorStop(0.5, '#FFD700');
    beakGrad.addColorStop(1, '#FF6B35');
    ctx.fillStyle = beakGrad;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Beak line
    ctx.beginPath();
    ctx.moveTo(22, -21);
    ctx.lineTo(55, -21);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-15, 20);
    ctx.lineTo(-28, 40);
    ctx.lineTo(-18, 38);
    ctx.lineTo(-22, 48);
    ctx.lineTo(-10, 35);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

    ctx.restore();
  }, []);

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

    if (phase === 'ready') {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#0b3d0b');
      bgGrad.addColorStop(0.6, '#1a5c1a');
      bgGrad.addColorStop(1, '#0d2a0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      drawToucan(ctx, w * 0.2, cy, 'right', elapsed * 2, '#FF6B35');
      drawToucan(ctx, w * 0.8, cy, 'left', elapsed * 2 + 1, '#e74c3c');

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Lancer de Fruits', cx, cy - 80);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('Toucans toss fruit as', cx, cy - 40);
      ctx.fillText('a courtship ritual!', cx, cy - 16);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Swipe to throw, tap to catch!', cx, cy + 80);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      ctx.fillText('TAP TO START', cx, cy + 130);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.leftToucanBob = elapsed * 2.5;
    s.rightToucanBob = elapsed * 2.5 + 1;

    const f = s.fruit;

    // Flying to right toucan
    if (f.flying && !f.returning) {
      f.flyProgress += delta * (2.5 * s.speed);
      const p = Math.min(1, f.flyProgress);
      const ease = 1 - Math.pow(1 - p, 3);
      f.x = f.startX + (f.endX - f.startX) * ease;
      const arc = -100 * Math.sin(p * Math.PI);
      f.y = f.startY + (f.endY - f.startY) * ease + arc;
      f.rotation += delta * 8 * s.speed;

      const fc = FRUIT_COLORS[f.colorIdx];
      const rgb = hexToRgb(fc.fill);
      spawnTrail(f.x, f.y, rgb.r, rgb.g, rgb.b);

      if (p >= 1) {
        // Right toucan catches, then throws back
        f.flying = false;
        spawnParticles(f.endX, f.endY, 8, 245, 166, 35);
        sounds.tick();

        // Auto-return after short delay
        setTimeout(() => {
          if (phase !== 'playing') return;
          f.returning = true;
          f.flyProgress = 0;
          f.startX = w * 0.82;
          f.startY = h * 0.42;
          f.endX = w * 0.18;
          f.endY = h * 0.42;
          s.canCatch = true;
          f.waitingCatch = true;
          s.catchTimer = 0;
          sounds.whoosh();
        }, 300 / s.speed);
      }
    }

    // Returning fruit
    if (f.returning) {
      f.flyProgress += delta * (2.5 * s.speed);
      const p = Math.min(1, f.flyProgress);
      const ease = 1 - Math.pow(1 - p, 3);
      f.x = f.startX + (f.endX - f.startX) * ease;
      const arc = -100 * Math.sin(p * Math.PI);
      f.y = f.startY + (f.endY - f.startY) * ease + arc;
      f.rotation -= delta * 8 * s.speed;

      const fc = FRUIT_COLORS[f.colorIdx];
      const rgb = hexToRgb(fc.fill);
      spawnTrail(f.x, f.y, rgb.r, rgb.g, rgb.b);

      s.catchTimer += delta;

      if (p >= 1 && !f.caught) {
        // Missed catch
        f.returning = false;
        f.active = false;
        s.streak = 0;
        s.speed = Math.max(1.0, s.speed - 0.2);
        s.feedbackText = 'Miss!';
        s.feedbackTimer = 0.6;
        s.missFlash = 0.3;
        s.canCatch = false;

        setTimeout(() => setupFruit(w, h), 400);
      }
    }

    // Miss flash
    if (s.missFlash > 0) s.missFlash -= delta;

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 80 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    if (s.feedbackTimer > 0) s.feedbackTimer -= delta;

    // Leaves
    for (const leaf of s.bgLeaves) {
      leaf.y += leaf.speed * delta;
      leaf.x += Math.sin(elapsed + leaf.angle) * 10 * delta;
      leaf.angle += leaf.rotSpeed * delta;
      if (leaf.y > h + 30) {
        leaf.y = -30;
        leaf.x = Math.random() * w;
      }
    }

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(s.score);
      return;
    }

    // --- RENDER ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0b3d0b');
    bgGrad.addColorStop(0.4, '#1a5c1a');
    bgGrad.addColorStop(0.8, '#0d3a0d');
    bgGrad.addColorStop(1, '#0a2a0a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Falling leaves
    for (const leaf of s.bgLeaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34,139,34,0.15)';
      ctx.fill();
      ctx.restore();
    }

    // Miss flash
    if (s.missFlash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${s.missFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Branches
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, cy + 40);
    ctx.quadraticCurveTo(w * 0.15, cy + 30, w * 0.3, cy + 45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w, cy + 40);
    ctx.quadraticCurveTo(w * 0.85, cy + 30, w * 0.7, cy + 45);
    ctx.stroke();

    // Toucans
    drawToucan(ctx, w * 0.15, cy, 'right', s.leftToucanBob, '#FF6B35');
    drawToucan(ctx, w * 0.85, cy, 'left', s.rightToucanBob, '#e74c3c');

    // Catch indicator
    if (s.canCatch && f.waitingCatch) {
      const indicatorAlpha = 0.5 + Math.sin(elapsed * 12) * 0.5;
      ctx.beginPath();
      ctx.arc(w * 0.18, h * 0.42, 35, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(46,234,163,${indicatorAlpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(46,234,163,${indicatorAlpha})`;
      ctx.fillText('TAP!', w * 0.18, h * 0.42 + 50);
    }

    // Trail particles
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      const alpha = (p.life / p.maxLife) * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }

    // Draw fruit
    if (f.active) {
      const fc = FRUIT_COLORS[f.colorIdx];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      // Glow
      const glowGrad = ctx.createRadialGradient(0, 0, f.size * 0.5, 0, 0, f.size * 2);
      glowGrad.addColorStop(0, `${fc.fill}33`);
      glowGrad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, f.size * 2, 0, Math.PI * 2);
      ctx.fill();

      // Fruit body
      ctx.beginPath();
      ctx.arc(0, 0, f.size, 0, Math.PI * 2);
      const fruitGrad = ctx.createRadialGradient(-f.size * 0.3, -f.size * 0.3, 0, 0, 0, f.size);
      fruitGrad.addColorStop(0, '#fff');
      fruitGrad.addColorStop(0.3, fc.fill);
      fruitGrad.addColorStop(1, fc.stroke);
      ctx.fillStyle = fruitGrad;
      ctx.fill();

      // Stem
      ctx.beginPath();
      ctx.moveTo(0, -f.size);
      ctx.lineTo(2, -f.size - 6);
      ctx.strokeStyle = '#4a2a0a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Leaf on stem
      ctx.beginPath();
      ctx.ellipse(5, -f.size - 4, 5, 3, 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#228B22';
      ctx.fill();

      ctx.restore();
    }

    // Burst particles
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }

    // Speed indicator
    if (s.speed > 1.1) {
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(`Speed x${s.speed.toFixed(1)}`, cx, 80);
    }

    // Streak
    if (s.streak > 1) {
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText(`Streak: ${s.streak}`, cx, 110);
    }

    // Feedback
    if (s.feedbackTimer > 0) {
      const alpha = Math.min(1, s.feedbackTimer * 2);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 30px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = s.feedbackText === 'Miss!' ? COLORS.red : COLORS.mint;
      ctx.fillText(s.feedbackText, cx, cy - 60);
      ctx.globalAlpha = 1;
    }

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.green;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer + score
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${s.score}`, 20, 40);

    ctx.restore();
  }, [phase, sounds, spawnParticles, spawnTrail, setupFruit, drawToucan]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0;
      s.streak = 0;
      s.bestStreak = 0;
      s.speed = 1.0;
      s.timeLeft = GAME_DURATION;
      setupFruit(window.innerWidth, window.innerHeight);
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop, setupFruit]);

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
          <div style={{ color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 12 }}>Time's Up!</div>
          <div style={{ color: COLORS.green, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>{displayScore}</div>
          <div style={{ color: COLORS.gray, fontSize: 16, marginBottom: 4 }}>exchanges completed</div>
          <div style={{ color: COLORS.gold, fontSize: 14, marginBottom: 4 }}>Best Streak: {state.current.bestStreak}</div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
            Toucans toss fruit to show love!
          </div>
          <button onClick={() => onComplete(state.current.score)} style={{
            background: COLORS.green, color: COLORS.primary, border: 'none',
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

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 255, g: 255, b: 255 };
}
