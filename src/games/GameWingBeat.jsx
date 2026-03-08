import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 15;
const HUMMINGBIRD_BPS = 80;
const POOL_SIZE = 100;

export default function GameWingBeat({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();

  const state = useRef({
    totalTaps: 0,
    tapsPerSecond: 0,
    tapTimestamps: [],
    recentTaps: [],
    timeLeft: GAME_DURATION,
    wingAngle: 0,
    wingBlur: 0,
    birdY: 0,
    birdVy: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    bgOffset: 0,
    lastTapTime: 0,
    peakTps: 0,
    flashAlpha: 0,
    clouds: Array(8).fill(null).map(() => ({
      x: Math.random() * 1000,
      y: 50 + Math.random() * 200,
      w: 60 + Math.random() * 100,
      speed: 10 + Math.random() * 30,
      alpha: 0.1 + Math.random() * 0.15,
    })),
  });

  const spawnParticles = useCallback((cx, cy, count) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 30;
        p.y = cy + (Math.random() - 0.5) * 20;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
        const speed = 60 + Math.random() * 150;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.4 + Math.random() * 0.6;
        p.maxLife = p.life;
        const colors = [
          [46, 234, 163],
          [0, 212, 255],
          [255, 255, 255],
        ];
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.r = c[0]; p.g = c[1]; p.b = c[2];
        p.size = 1.5 + Math.random() * 3;
        p.type = Math.random() > 0.5 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') setPhase('playing');
      return;
    }
    const s = state.current;
    const now = performance.now();
    s.totalTaps++;
    s.tapTimestamps.push(now);
    s.recentTaps.push(now);
    s.lastTapTime = now;
    s.birdVy = -3;
    s.flashAlpha = 0.3;

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const cx = canvas ? canvas.width / (2 * dpr) : 200;
    const cy = canvas ? canvas.height / (2 * dpr) : 300;
    spawnParticles(cx - 20, cy + s.birdY, 3 + Math.min(8, Math.floor(s.tapsPerSecond / 5)));

    sounds.tick();
  }, [phase, sounds, spawnParticles]);

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
    const cx = w / 2;
    const cy = h / 2;

    if (phase === 'ready') {
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1a3a5c');
      skyGrad.addColorStop(0.5, '#4a90b8');
      skyGrad.addColorStop(1, '#87ceeb');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Wing Beat Challenge', cx, cy - 60);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('Hummingbird wings beat', cx, cy - 10);
      ctx.fillText('80 times per second!', cx, cy + 16);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Tap as fast as you can!', cx, cy + 60);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      ctx.fillText('TAP TO START', cx, cy + 110);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);

    // Calculate taps per second (rolling 1-second window)
    const now = performance.now();
    s.recentTaps = s.recentTaps.filter(t => now - t < 1000);
    s.tapsPerSecond = s.recentTaps.length;
    if (s.tapsPerSecond > s.peakTps) s.peakTps = s.tapsPerSecond;

    // Bird physics
    s.birdVy += delta * 8;
    s.birdY += s.birdVy;
    s.birdY = Math.max(-30, Math.min(30, s.birdY));

    // Wing animation - speed proportional to taps
    const wingSpeed = 5 + s.tapsPerSecond * 3;
    s.wingAngle += delta * wingSpeed * Math.PI * 2;
    s.wingBlur = Math.min(1, s.tapsPerSecond / 20);

    // Flash decay
    s.flashAlpha *= Math.pow(0.01, delta);

    // Cloud movement
    s.bgOffset += delta * (20 + s.tapsPerSecond * 2);
    for (const cloud of s.clouds) {
      cloud.x -= cloud.speed * delta;
      if (cloud.x + cloud.w < 0) {
        cloud.x = w + 20;
        cloud.y = 50 + Math.random() * (h * 0.4);
      }
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 40 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(s.totalTaps);
      return;
    }

    // --- RENDER ---
    // Sky gradient with motion blur
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    const motionBlurIntensity = Math.min(0.3, s.tapsPerSecond / 50);
    skyGrad.addColorStop(0, '#1a3a5c');
    skyGrad.addColorStop(0.5, '#4a90b8');
    skyGrad.addColorStop(1, '#87ceeb');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Motion blur overlay
    if (motionBlurIntensity > 0.02) {
      ctx.fillStyle = `rgba(135,206,235,${motionBlurIntensity})`;
      for (let i = 0; i < 5; i++) {
        const ox = (Math.random() - 0.5) * motionBlurIntensity * 40;
        ctx.fillRect(ox, 0, w, h);
      }
    }

    // Clouds
    for (const cloud of s.clouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.w, cloud.w * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${cloud.alpha})`;
      ctx.fill();
    }

    // Flash effect
    if (s.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(46,234,163,${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw hummingbird body
    const bx = cx;
    const by = cy + s.birdY;

    // Body
    ctx.save();
    ctx.translate(bx, by);

    // Body shape
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 15, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createLinearGradient(-25, -15, 25, 15);
    bodyGrad.addColorStop(0, '#2EEAA3');
    bodyGrad.addColorStop(0.5, '#1ab87a');
    bodyGrad.addColorStop(1, '#0d6b47');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(28, -5, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(32, -7, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(32.5, -7.5, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(37, -5);
    ctx.lineTo(52, -3);
    ctx.lineTo(37, -2);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-25, 0);
    ctx.lineTo(-45, -8);
    ctx.lineTo(-42, 0);
    ctx.lineTo(-45, 8);
    ctx.closePath();
    ctx.fillStyle = '#0d6b47';
    ctx.fill();

    // Wings (with blur based on tapping speed)
    const wingY = Math.sin(s.wingAngle) * 25;
    const numWingGhosts = Math.floor(s.wingBlur * 8) + 1;

    for (let g = 0; g < numWingGhosts; g++) {
      const ghostAngle = s.wingAngle - g * 0.3;
      const ghostWingY = Math.sin(ghostAngle) * 25;
      const ghostAlpha = (1 - g / numWingGhosts) * (0.4 / numWingGhosts);

      ctx.save();
      ctx.globalAlpha = ghostAlpha;
      // Left wing
      ctx.beginPath();
      ctx.moveTo(-5, -5);
      ctx.quadraticCurveTo(-30, -40 + ghostWingY, -50, -20 + ghostWingY * 0.7);
      ctx.quadraticCurveTo(-35, -10, -5, -5);
      ctx.fillStyle = 'rgba(46,234,163,0.6)';
      ctx.fill();
      // Right wing mirror
      ctx.beginPath();
      ctx.moveTo(-5, 5);
      ctx.quadraticCurveTo(-30, 40 - ghostWingY, -50, 20 - ghostWingY * 0.7);
      ctx.quadraticCurveTo(-35, 10, -5, 5);
      ctx.fill();
      ctx.restore();
    }

    // Primary wings
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.quadraticCurveTo(-30, -40 + wingY, -50, -20 + wingY * 0.7);
    ctx.quadraticCurveTo(-35, -10, -5, -5);
    ctx.fillStyle = '#5ff5c0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.quadraticCurveTo(-30, 40 - wingY, -50, 20 - wingY * 0.7);
    ctx.quadraticCurveTo(-35, 10, -5, 5);
    ctx.fill();
    ctx.globalAlpha = 1;

    ctx.restore();

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

    // Giant taps/second counter
    ctx.font = 'bold 72px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(`${s.tapsPerSecond}`, cx, h * 0.2);
    ctx.shadowBlur = 0;
    ctx.font = '20px sans-serif';
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText('taps/second', cx, h * 0.2 + 30);

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.cyan;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer text
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    // Total taps
    ctx.font = '16px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Total: ${s.totalTaps}`, 20, 40);

    // Comparison bar at bottom
    const barY = h - 80;
    const barW = w - 80;
    const barH = 20;
    const barX = 40;
    // Background bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    // Player progress
    const playerFrac = Math.min(1, s.tapsPerSecond / HUMMINGBIRD_BPS);
    ctx.fillStyle = COLORS.mint;
    ctx.fillRect(barX, barY, barW * playerFrac, barH);
    // Hummingbird marker
    ctx.fillStyle = COLORS.gold;
    ctx.fillRect(barX + barW - 3, barY - 4, 3, barH + 8);
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`${HUMMINGBIRD_BPS}/s`, barX + barW, barY - 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.mint;
    ctx.fillText(`You: ${s.tapsPerSecond}/s`, barX, barY - 8);

    ctx.restore();
  }, [phase, sounds, spawnParticles]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.totalTaps = 0;
      s.tapsPerSecond = 0;
      s.tapTimestamps = [];
      s.recentTaps = [];
      s.timeLeft = GAME_DURATION;
      s.peakTps = 0;
      s.birdY = 0;
      s.birdVy = 0;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const avgTps = phase === 'ended' ? (state.current.totalTaps / GAME_DURATION).toFixed(1) : 0;

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
          <div style={{ color: COLORS.mint, fontSize: 20, marginBottom: 8 }}>
            You: {avgTps} taps/s
          </div>
          <div style={{ color: COLORS.gold, fontSize: 20, marginBottom: 8 }}>
            Hummingbird: {HUMMINGBIRD_BPS} taps/s
          </div>
          <div style={{ color: COLORS.cyan, fontSize: 16, marginBottom: 4 }}>
            Peak: {state.current.peakTps} taps/s
          </div>
          <div style={{ color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4 }}>
            {displayScore}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>total taps</div>
          <button onClick={() => onComplete(state.current.totalTaps)} style={{
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
