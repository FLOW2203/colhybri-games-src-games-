import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 30;
const POOL_SIZE = 100;
const MAX_TOKENS = 10;
const SELFISH_TIMEOUT = 3;

export default function GameDonBecABec({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const sounds = useSounds();

  const state = useRef({
    score: 0,
    donorScore: 0,
    receiverScore: 0,
    timeLeft: GAME_DURATION,
    donorTokens: 0,
    receiverTokens: 0,
    lastGiveTime: 0,
    selfishTimer: 0,
    receiverMood: 'happy',
    tokenSpawnTimer: 0,
    flyingTokens: [],
    returnTokenTimer: 0,
    donorX: 0,
    donorY: 0,
    receiverX: 0,
    receiverY: 0,
    donorBob: 0,
    receiverBob: 0,
    receiverSadScale: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'circle',
    })),
    pendingTokens: [],
    totalGiven: 0,
    totalReceived: 0,
  });

  const spawnParticles = useCallback((cx, cy, count, r, g, b, type = 'circle') => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx;
        p.y = cy;
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 120;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.4 + Math.random() * 0.6;
        p.maxLife = p.life;
        p.r = r;
        p.g = g;
        p.b = b;
        p.size = type === 'heart' ? 6 + Math.random() * 6 : 2 + Math.random() * 4;
        p.type = type;
        spawned++;
      }
    }
  }, []);

  const handleSwipe = useCallback((direction) => {
    if (phase === 'ready') {
      setPhase('playing');
      return;
    }
    if (phase !== 'playing') return;
    const s = state.current;
    if (direction === 'right' && s.donorTokens > 0) {
      s.donorTokens--;
      s.totalGiven++;
      s.lastGiveTime = performance.now();
      s.selfishTimer = 0;
      const flyToken = {
        x: s.donorX + 30,
        y: s.donorY - 20,
        targetX: s.receiverX - 30,
        targetY: s.receiverY - 20,
        progress: 0,
        startX: s.donorX + 30,
        startY: s.donorY - 20,
      };
      s.flyingTokens.push(flyToken);
      sounds.chime();
      spawnParticles(s.donorX + 30, s.donorY - 20, 5, 245, 166, 35);
    }
  }, [phase, sounds, spawnParticles]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') {
      setPhase('playing');
    }
  }, [phase]);

  useTouch(canvasRef, { onSwipe: handleSwipe, onTap: handleTap });

  function drawParrot(ctx, x, y, color, bobOffset, mood, isReceiver) {
    const by = y + Math.sin(bobOffset) * 4;
    ctx.save();
    ctx.translate(x, by);
    if (isReceiver) ctx.scale(-1, 1);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 35, 0, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -38, 18, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(6, -40, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    const pupilY = mood === 'sad' ? -39 : -41;
    ctx.arc(7, pupilY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(16, -38);
    ctx.lineTo(26, -35);
    ctx.lineTo(16, -32);
    ctx.closePath();
    ctx.fillStyle = '#F5A623';
    ctx.fill();

    // Wing
    ctx.beginPath();
    ctx.ellipse(-8, 5, 14, 22, -0.3, 0, Math.PI * 2);
    const wingColor = color === '#22C55E' ? '#1CA04A' : '#2A8FCE';
    ctx.fillStyle = wingColor;
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-10, 25);
    ctx.lineTo(-25, 45);
    ctx.lineTo(-5, 35);
    ctx.closePath();
    ctx.fillStyle = wingColor;
    ctx.fill();

    // Sad expression
    if (mood === 'sad') {
      ctx.beginPath();
      ctx.arc(0, -28, 8, 0.2, Math.PI - 0.2);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // Teardrop
      ctx.beginPath();
      ctx.arc(10, -34, 2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(100,180,255,0.7)';
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(0, -32, 6, 0.2, Math.PI - 0.2, true);
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawToken(ctx, x, y, size) {
    ctx.save();
    ctx.translate(x, y);
    ctx.beginPath();
    ctx.arc(0, 0, size, 0, Math.PI * 2);
    const grad = ctx.createRadialGradient(-2, -2, 1, 0, 0, size);
    grad.addColorStop(0, '#FFE066');
    grad.addColorStop(0.7, '#F5A623');
    grad.addColorStop(1, '#C17D10');
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = '#C17D10';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.beginPath();
    ctx.arc(-size * 0.25, -size * 0.25, size * 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHeart(ctx, x, y, size, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 10, size / 10);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.bezierCurveTo(-7, -3, -10, -8, -5, -9);
    ctx.bezierCurveTo(0, -10, 0, -5, 0, -5);
    ctx.bezierCurveTo(0, -5, 0, -10, 5, -9);
    ctx.bezierCurveTo(10, -8, 7, -3, 0, 3);
    ctx.fillStyle = '#E91E8C';
    ctx.fill();
    ctx.globalAlpha = 1;
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
    s.donorX = w * 0.28;
    s.donorY = h * 0.5;
    s.receiverX = w * 0.72;
    s.receiverY = h * 0.5;

    if (phase === 'ready') {
      ctx.fillStyle = COLORS.primary;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Don Bec-a-Bec', w / 2, h / 2 - 70);
      ctx.font = '17px sans-serif';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Parrots: first proven non-mammal', w / 2, h / 2 - 20);
      ctx.fillText('altruists - they give 10/10 tokens!', w / 2, h / 2 + 6);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE RIGHT to give tokens', w / 2, h / 2 + 50);
      ctx.fillText('Generosity = maximum score', w / 2, h / 2 + 72);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAP TO START', w / 2, h / 2 + 120);
      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    // Spawn tokens near donor
    s.tokenSpawnTimer += delta;
    if (s.tokenSpawnTimer > 1.5 && s.donorTokens < MAX_TOKENS) {
      s.tokenSpawnTimer = 0;
      s.donorTokens++;
      spawnParticles(s.donorX, s.donorY - 60, 3, 245, 166, 35);
      sounds.tick();
    }

    // Selfish penalty
    if (s.donorTokens > 0) {
      s.selfishTimer += delta;
      if (s.selfishTimer > SELFISH_TIMEOUT) {
        s.receiverMood = 'sad';
        s.receiverSadScale = Math.min(1, s.receiverSadScale + delta * 0.5);
        if (s.score > 0) {
          s.score = Math.max(0, s.score - delta * 3);
          setDisplayScore(Math.floor(s.score));
        }
      } else {
        s.receiverMood = 'happy';
        s.receiverSadScale = Math.max(0, s.receiverSadScale - delta * 2);
      }
    } else {
      s.selfishTimer = 0;
      s.receiverMood = 'happy';
      s.receiverSadScale = Math.max(0, s.receiverSadScale - delta * 2);
    }

    // Flying tokens update
    for (let i = s.flyingTokens.length - 1; i >= 0; i--) {
      const ft = s.flyingTokens[i];
      ft.progress += delta * 2.5;
      ft.x = ft.startX + (ft.targetX - ft.startX) * ft.progress;
      ft.y = ft.startY + (ft.targetY - ft.startY) * ft.progress - Math.sin(ft.progress * Math.PI) * 60;
      if (ft.progress >= 1) {
        s.flyingTokens.splice(i, 1);
        s.receiverTokens++;
        s.totalReceived++;
        const pts = 5;
        s.donorScore += pts;
        s.receiverScore += pts;
        s.score = s.donorScore + s.receiverScore;
        setDisplayScore(Math.floor(s.score));
        spawnParticles(s.receiverX - 30, s.receiverY - 20, 8, 233, 30, 140, 'heart');
        sounds.chime();
      }
    }

    // Receiver returns tokens sometimes
    s.returnTokenTimer += delta;
    if (s.returnTokenTimer > 4 && s.receiverTokens > 0 && s.receiverMood === 'happy') {
      s.returnTokenTimer = 0;
      s.receiverTokens--;
      const flyToken = {
        x: s.receiverX - 30,
        y: s.receiverY - 20,
        targetX: s.donorX + 30,
        targetY: s.donorY - 20,
        progress: 0,
        startX: s.receiverX - 30,
        startY: s.receiverY - 20,
      };
      s.flyingTokens.push(flyToken);
      s.donorTokens++;
    }

    // Animation
    s.donorBob += delta * 3;
    s.receiverBob += delta * 2.5;

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 30 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      return;
    }

    // --- RENDER ---
    // Background
    ctx.fillStyle = '#1A1A2E';
    ctx.fillRect(0, 0, w, h);

    // Branch / perch
    ctx.strokeStyle = '#8B6914';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.5 + 35);
    ctx.quadraticCurveTo(w * 0.5, h * 0.5 + 50, w * 0.9, h * 0.5 + 35);
    ctx.stroke();
    ctx.strokeStyle = '#6B4F10';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.1, h * 0.5 + 37);
    ctx.quadraticCurveTo(w * 0.5, h * 0.5 + 52, w * 0.9, h * 0.5 + 37);
    ctx.stroke();

    // Draw parrots
    drawParrot(ctx, s.donorX, s.donorY, '#22C55E', s.donorBob, 'happy', false);
    drawParrot(ctx, s.receiverX, s.receiverY, '#3B82F6', s.receiverBob, s.receiverMood, true);

    // Labels
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22C55E';
    ctx.fillText('DONOR', s.donorX, s.donorY + 60);
    ctx.fillStyle = '#3B82F6';
    ctx.fillText('RECEIVER', s.receiverX, s.receiverY + 60);

    // Donor tokens stack
    for (let i = 0; i < s.donorTokens; i++) {
      const tx = s.donorX - 50 + (i % 5) * 14;
      const ty = s.donorY - 80 - Math.floor(i / 5) * 14;
      drawToken(ctx, tx, ty, 6);
    }

    // Receiver tokens stack
    for (let i = 0; i < s.receiverTokens; i++) {
      const tx = s.receiverX + 20 + (i % 5) * 14;
      const ty = s.receiverY - 80 - Math.floor(i / 5) * 14;
      drawToken(ctx, tx, ty, 6);
    }

    // Flying tokens
    for (const ft of s.flyingTokens) {
      drawToken(ctx, ft.x, ft.y, 8);
      // Trail particles
      spawnParticles(ft.x, ft.y, 1, 245, 200, 50);
    }

    // Particles
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      if (p.type === 'heart') {
        drawHeart(ctx, p.x, p.y, p.size, alpha);
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
        ctx.fill();
      }
    }

    // Selfish warning
    if (s.selfishTimer > SELFISH_TIMEOUT * 0.7 && s.donorTokens > 0) {
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(239,68,68,${0.5 + 0.5 * Math.sin(elapsed * 6)})`;
      ctx.fillText('Share your tokens!', w / 2, h * 0.25);
    }

    // Scores
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#22C55E';
    ctx.fillText(`Donor: ${Math.floor(s.donorScore)}`, w * 0.3, h * 0.12);
    ctx.fillStyle = '#3B82F6';
    ctx.fillText(`Receiver: ${Math.floor(s.receiverScore)}`, w * 0.7, h * 0.12);

    // Total score
    ctx.font = 'bold 22px sans-serif';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`Total: ${Math.floor(s.score)}`, w / 2, h * 0.07);

    // Swipe hint
    if (s.donorTokens > 0 && elapsed < 5) {
      ctx.font = '14px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE RIGHT to give →', w / 2, h * 0.85);
    }

    // Timer
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    ctx.restore();
  }, [phase, sounds, spawnParticles]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0;
      s.donorScore = 0;
      s.receiverScore = 0;
      s.donorTokens = 0;
      s.receiverTokens = 0;
      s.selfishTimer = 0;
      s.tokenSpawnTimer = 0;
      s.flyingTokens = [];
      s.returnTokenTimer = 0;
      s.totalGiven = 0;
      s.totalReceived = 0;
      s.lastGiveTime = 0;
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
          <div style={{ color: COLORS.white, fontSize: 30, fontWeight: 'bold', marginBottom: 8 }}>Generosity Wins!</div>
          <div style={{ color: COLORS.gold, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>{Math.floor(state.current.score)}</div>
          <div style={{ color: COLORS.gray, fontSize: 15, marginBottom: 4 }}>Tokens given: {state.current.totalGiven}</div>
          <div style={{ color: COLORS.gray, fontSize: 13, marginBottom: 24 }}>
            First proven non-mammal altruist!
          </div>
          <button onClick={() => onComplete(Math.floor(state.current.score))} style={{
            background: COLORS.mint, color: COLORS.primary, border: 'none',
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
