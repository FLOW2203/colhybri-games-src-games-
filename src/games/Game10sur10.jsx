import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 15;
const TOTAL_TOKENS = 10;
const POOL_SIZE = 100;

export default function Game10sur10({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();

  const state = useRef({
    timeLeft: GAME_DURATION,
    tokensGiven: 0,
    currentToken: {
      active: true,
      x: 0, y: 0,
      targetX: 0, targetY: 0,
      grabbed: false,
      flying: false,
      flyProgress: 0,
      startX: 0, startY: 0,
      endX: 0, endY: 0,
      spawnTime: 0,
    },
    multiplier: 1.0,
    lastGiveTime: 0,
    consecutiveSpeed: 0,
    score: 0,
    feedbackText: '',
    feedbackTimer: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    trailParticles: Array(40).fill(null).map(() => ({
      active: false, x: 0, y: 0, life: 0, maxLife: 0, size: 0, alpha: 0,
    })),
    dragX: 0,
    dragY: 0,
    isDragging: false,
    tokenAngle: 0,
    leftParrotBob: 0,
    rightParrotBob: 0,
    tokenScale: 1,
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
        const speed = 50 + Math.random() * 150;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 2 + Math.random() * 4;
        spawned++;
      }
    }
  }, []);

  const spawnTrail = useCallback((x, y) => {
    const s = state.current;
    for (let i = 0; i < s.trailParticles.length; i++) {
      const p = s.trailParticles[i];
      if (!p.active) {
        p.active = true;
        p.x = x; p.y = y;
        p.life = 0.3 + Math.random() * 0.2;
        p.maxLife = p.life;
        p.size = 4 + Math.random() * 6;
        p.alpha = 0.6;
        break;
      }
    }
  }, []);

  const resetToken = useCallback((w, h) => {
    const s = state.current;
    const t = s.currentToken;
    t.active = true;
    t.x = w * 0.3;
    t.y = h * 0.5 + (Math.random() - 0.5) * 80;
    t.grabbed = false;
    t.flying = false;
    t.flyProgress = 0;
    t.spawnTime = performance.now();
  }, []);

  const handleDrag = useCallback(({ x, y }) => {
    if (phase !== 'playing') return;
    const s = state.current;
    const t = s.currentToken;
    if (!t.active || t.flying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = x - rect.left;
    const ly = y - rect.top;

    if (!s.isDragging) {
      const dx = lx - t.x;
      const dy = ly - t.y;
      if (Math.sqrt(dx * dx + dy * dy) < 50) {
        s.isDragging = true;
        t.grabbed = true;
      }
    }

    if (s.isDragging) {
      s.dragX = lx;
      s.dragY = ly;
      t.x = lx;
      t.y = ly;
      spawnTrail(lx, ly);
    }
  }, [phase, spawnTrail]);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') setPhase('playing');
      return;
    }
    const s = state.current;
    const t = s.currentToken;
    if (!t.active || t.flying) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = x - rect.left;
    const ly = y - rect.top;

    const dx = lx - t.x;
    const dy = ly - t.y;
    if (Math.sqrt(dx * dx + dy * dy) < 50) {
      t.grabbed = true;
      t.flying = true;
      t.startX = t.x;
      t.startY = t.y;
      const w = window.innerWidth;
      const h = window.innerHeight;
      t.endX = w * 0.82;
      t.endY = h * 0.45;
      t.flyProgress = 0;
      sounds.whoosh();
    }
  }, [phase, sounds]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    if (direction !== 'right') return;
    const s = state.current;
    const t = s.currentToken;
    if (!t.active || t.flying) return;

    t.flying = true;
    t.startX = t.x;
    t.startY = t.y;
    const w = window.innerWidth;
    const h = window.innerHeight;
    t.endX = w * 0.82;
    t.endY = h * 0.45;
    t.flyProgress = 0;
    sounds.whoosh();
  }, [phase, sounds]);

  useTouch(canvasRef, { onTap: handleTap, onSwipe: handleSwipe, onDrag: handleDrag });

  const drawParrot = useCallback((ctx, x, y, facing, bob, color1, color2) => {
    ctx.save();
    ctx.translate(x, y + Math.sin(bob) * 4);
    const dir = facing === 'right' ? 1 : -1;
    ctx.scale(dir, 1);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 35, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createLinearGradient(-28, -35, 28, 35);
    bodyGrad.addColorStop(0, color1);
    bodyGrad.addColorStop(1, color2);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(10, -30, 18, 0, Math.PI * 2);
    ctx.fillStyle = color1;
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(18, -33, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(19, -33, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(25, -28);
    ctx.quadraticCurveTo(38, -25, 30, -18);
    ctx.quadraticCurveTo(25, -20, 25, -28);
    ctx.fillStyle = '#F5A623';
    ctx.fill();

    // Wing
    ctx.beginPath();
    ctx.ellipse(-8, 5, 18, 25, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = color2;
    ctx.globalAlpha = 0.7;
    ctx.fill();
    ctx.globalAlpha = 1;

    // Tail
    ctx.beginPath();
    ctx.moveTo(-15, 25);
    ctx.lineTo(-35, 50);
    ctx.lineTo(-20, 48);
    ctx.lineTo(-30, 60);
    ctx.lineTo(-10, 45);
    ctx.lineTo(-5, 30);
    ctx.closePath();
    ctx.fillStyle = color2;
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
      bgGrad.addColorStop(0, '#1a2a1a');
      bgGrad.addColorStop(1, '#0d1a0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      drawParrot(ctx, w * 0.2, cy, 'right', elapsed * 2, '#e74c3c', '#c0392b');
      drawParrot(ctx, w * 0.8, cy, 'left', elapsed * 2 + 1, '#3498db', '#2980b9');

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('10 sur 10', cx, cy - 80);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('Parrots give 10/10 tokens', cx, cy - 40);
      ctx.fillText('without hesitation!', cx, cy - 16);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Swipe tokens to your partner', cx, cy + 80);
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

    // Token animation
    s.tokenAngle += delta * 2;
    s.leftParrotBob = elapsed * 2.5;
    s.rightParrotBob = elapsed * 2.5 + 1;

    const t = s.currentToken;

    // Flying token animation
    if (t.flying) {
      t.flyProgress += delta * 3.5;
      const p = Math.min(1, t.flyProgress);
      const ease = 1 - Math.pow(1 - p, 3);
      t.x = t.startX + (t.endX - t.startX) * ease;
      const arcHeight = -80;
      t.y = t.startY + (t.endY - t.startY) * ease + arcHeight * Math.sin(p * Math.PI);

      spawnTrail(t.x, t.y);

      if (p >= 1) {
        // Token delivered
        t.active = false;
        t.flying = false;
        s.tokensGiven++;

        const now = performance.now();
        const hesitation = (now - t.spawnTime) / 1000;

        if (hesitation < 0.5) {
          s.consecutiveSpeed++;
        } else if (hesitation < 1.0) {
          s.consecutiveSpeed = Math.max(0, s.consecutiveSpeed - 1);
        } else {
          s.consecutiveSpeed = 0;
        }

        s.multiplier = 1.0 + s.consecutiveSpeed * 0.3;
        const tokenScore = Math.round(1 * s.multiplier * 10) / 10;
        s.score += tokenScore;

        if (hesitation < 0.5) {
          s.feedbackText = `FAST! x${s.multiplier.toFixed(1)}`;
        } else if (hesitation < 1.0) {
          s.feedbackText = `OK x${s.multiplier.toFixed(1)}`;
        } else {
          s.feedbackText = 'Too slow...';
        }
        s.feedbackTimer = 0.8;

        spawnParticles(t.endX, t.endY, 12, 245, 166, 35);
        sounds.chime();

        if (s.tokensGiven < TOTAL_TOKENS) {
          setTimeout(() => resetToken(w, h), 200);
        }

        setDisplayScore(Math.round(s.score));
      }
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
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      p.life -= delta;
      p.alpha = (p.life / p.maxLife) * 0.5;
      if (p.life <= 0) p.active = false;
    }

    if (s.feedbackTimer > 0) s.feedbackTimer -= delta;

    // Game over
    if ((s.timeLeft <= 0 || s.tokensGiven >= TOTAL_TOKENS) && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(Math.round(s.score));
      return;
    }

    // --- RENDER ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#1a2a1a');
    bgGrad.addColorStop(0.5, '#162016');
    bgGrad.addColorStop(1, '#0d1a0d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Branch/perch for left parrot
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(0, cy + 45);
    ctx.quadraticCurveTo(w * 0.15, cy + 40, w * 0.3, cy + 50);
    ctx.stroke();

    // Branch for right parrot
    ctx.beginPath();
    ctx.moveTo(w, cy + 45);
    ctx.quadraticCurveTo(w * 0.85, cy + 40, w * 0.7, cy + 50);
    ctx.stroke();

    // Left parrot (giver)
    drawParrot(ctx, w * 0.15, cy, 'right', s.leftParrotBob, '#e74c3c', '#c0392b');

    // Right parrot (receiver)
    drawParrot(ctx, w * 0.85, cy, 'left', s.rightParrotBob, '#3498db', '#2980b9');

    // Trail particles
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(245,166,35,${p.alpha})`;
      ctx.fill();
    }

    // Draw token
    if (t.active) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(s.tokenAngle);

      // Token glow
      const glowGrad = ctx.createRadialGradient(0, 0, 10, 0, 0, 30);
      glowGrad.addColorStop(0, 'rgba(245,166,35,0.3)');
      glowGrad.addColorStop(1, 'rgba(245,166,35,0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, 30, 0, Math.PI * 2);
      ctx.fill();

      // Token body
      ctx.beginPath();
      ctx.arc(0, 0, 18, 0, Math.PI * 2);
      const tokenGrad = ctx.createRadialGradient(-5, -5, 0, 0, 0, 18);
      tokenGrad.addColorStop(0, '#ffe066');
      tokenGrad.addColorStop(0.6, '#F5A623');
      tokenGrad.addColorStop(1, '#c47f17');
      ctx.fillStyle = tokenGrad;
      ctx.fill();
      ctx.strokeStyle = '#a06a10';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Token inner design
      ctx.beginPath();
      ctx.arc(0, 0, 12, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.stroke();

      // Number
      ctx.rotate(-s.tokenAngle);
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#7a4a00';
      ctx.fillText(`${s.tokensGiven + 1}`, 0, 1);

      ctx.restore();
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

    // Token counter
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    const tokenDisplay = `${s.tokensGiven}/${TOTAL_TOKENS}`;
    ctx.fillText(tokenDisplay, cx, h - 40);

    // Token dots
    for (let i = 0; i < TOTAL_TOKENS; i++) {
      const dotX = cx - (TOTAL_TOKENS * 12) / 2 + i * 12 + 6;
      ctx.beginPath();
      ctx.arc(dotX, h - 60, 4, 0, Math.PI * 2);
      ctx.fillStyle = i < s.tokensGiven ? COLORS.gold : 'rgba(255,255,255,0.2)';
      ctx.fill();
    }

    // Multiplier
    if (s.multiplier > 1) {
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText(`x${s.multiplier.toFixed(1)}`, cx, 80);
    }

    // Feedback text
    if (s.feedbackTimer > 0) {
      const alpha = Math.min(1, s.feedbackTimer * 2);
      ctx.globalAlpha = alpha;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = s.feedbackText.includes('slow') ? COLORS.red : COLORS.mint;
      ctx.fillText(s.feedbackText, cx, cy - 80);
      ctx.globalAlpha = 1;
    }

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.gold;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer + score
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${Math.round(s.score)}`, 20, 40);

    ctx.restore();
  }, [phase, sounds, spawnParticles, spawnTrail, resetToken, drawParrot]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.tokensGiven = 0;
      s.score = 0;
      s.multiplier = 1;
      s.consecutiveSpeed = 0;
      s.timeLeft = GAME_DURATION;
      const w = window.innerWidth;
      const h = window.innerHeight;
      resetToken(w, h);
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop, resetToken]);

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
          <div style={{ color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 12 }}>10 sur 10!</div>
          <div style={{ color: COLORS.gold, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>{displayScore}</div>
          <div style={{ color: COLORS.gray, fontSize: 16, marginBottom: 4 }}>
            {state.current.tokensGiven}/{TOTAL_TOKENS} tokens given
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
            Parrots share without hesitation!
          </div>
          <button onClick={() => onComplete(state.current.score)} style={{
            background: COLORS.gold, color: COLORS.primary, border: 'none',
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
