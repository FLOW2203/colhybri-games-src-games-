import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';

const GAME_DURATION = 30;
const PELICAN_COUNT = 6;
const TAP_WINDOW = 200;
const POOL_SIZE = 100;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function GameSignalDomino({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();

  const state = useRef({
    timeLeft: GAME_DURATION,
    score: 0,
    wave: 0,
    waveSpeed: 1.0,
    pelicans: Array(PELICAN_COUNT).fill(null).map((_, i) => ({
      x: 0, y: 0,
      struck: false,
      flashAlpha: 0,
      strikeTime: 0,
      bobOffset: Math.random() * Math.PI * 2,
    })),
    currentPelican: 0,
    waveActive: false,
    waitingForTap: false,
    tapDeadline: 0,
    autoStrikeTime: 0,
    waveCooldown: 0,
    missFlash: 0,
    feedbackText: '',
    feedbackTimer: 0,
    completedWaves: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    splashParticles: Array(60).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      size: 0, alpha: 0,
    })),
    waterRipples: Array(20).fill(null).map(() => ({
      active: false, x: 0, y: 0, radius: 0, maxRadius: 0, life: 0, maxLife: 0,
    })),
    waterOffset: 0,
  });

  const spawnSplash = useCallback((cx, cy, count) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.splashParticles.length && spawned < count; i++) {
      const p = s.splashParticles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 30;
        p.y = cy;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = 80 + Math.random() * 200;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.4 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.size = 2 + Math.random() * 4;
        p.alpha = 0.8;
        spawned++;
      }
    }
  }, []);

  const spawnRipple = useCallback((cx, cy) => {
    const s = state.current;
    for (let i = 0; i < s.waterRipples.length; i++) {
      const r = s.waterRipples[i];
      if (!r.active) {
        r.active = true;
        r.x = cx;
        r.y = cy;
        r.radius = 5;
        r.maxRadius = 40 + Math.random() * 40;
        r.life = 0.8;
        r.maxLife = 0.8;
        break;
      }
    }
  }, []);

  const strikePelican = useCallback((index) => {
    const s = state.current;
    const pel = s.pelicans[index];
    pel.struck = true;
    pel.flashAlpha = 1.0;
    pel.strikeTime = performance.now();
    spawnSplash(pel.x, pel.y + 40, 8);
    spawnRipple(pel.x, pel.y + 45);
    sounds.splash();
    haptics.tapFeedback();
    juice.shake(4, 0.15);
    juice.flash('#00D4FF', 0.2);
  }, [sounds, haptics, juice, spawnSplash, spawnRipple]);

  const startWave = useCallback(() => {
    const s = state.current;
    // Reset pelicans
    for (const p of s.pelicans) {
      p.struck = false;
      p.flashAlpha = 0;
    }
    s.currentPelican = 0;
    s.waveActive = true;
    s.waitingForTap = false;
    s.wave++;

    // First pelican strikes automatically
    strikePelican(0);
    s.currentPelican = 1;

    // Set up next pelican timing
    const delay = Math.max(150, 500 / s.waveSpeed);
    s.autoStrikeTime = performance.now() + delay;
    s.waitingForTap = true;
    s.tapDeadline = performance.now() + delay + TAP_WINDOW;

    sounds.whoosh();
  }, [strikePelican, sounds]);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        sounds.countdown(true);
        haptics.tapFeedback();
      }
      return;
    }
    const s = state.current;

    if (!s.waveActive || !s.waitingForTap) return;

    const now = performance.now();
    const idx = s.currentPelican;

    if (idx >= PELICAN_COUNT) return;

    // Check if within window
    const timeSinceReady = now - (s.autoStrikeTime - Math.max(150, 500 / s.waveSpeed));
    const expectedTime = s.autoStrikeTime;
    const diff = Math.abs(now - expectedTime);

    if (diff <= TAP_WINDOW || now >= expectedTime - TAP_WINDOW * 0.5) {
      // Good tap
      strikePelican(idx);
      s.currentPelican++;

      if (s.currentPelican >= PELICAN_COUNT) {
        // Wave completed
        s.waveActive = false;
        s.waitingForTap = false;
        s.completedWaves++;
        s.score += Math.ceil(5 * s.waveSpeed);
        s.waveSpeed = Math.min(4.0, s.waveSpeed + 0.2);
        s.feedbackText = `Wave ${s.completedWaves}!`;
        s.feedbackTimer = 0.8;
        s.waveCooldown = 1.0;
        setDisplayScore(s.score);
        sounds.chime();
        sounds.success();
        haptics.successFeedback();
        juice.shake(6, 0.25);
        juice.flash('#2EEAA3', 0.4);
      } else {
        // Set up next pelican
        const delay = Math.max(150, 500 / s.waveSpeed);
        s.autoStrikeTime = now + delay;
        s.tapDeadline = now + delay + TAP_WINDOW;
        sounds.combo(s.currentPelican);
        haptics.comboFeedback(1);
      }
    }
  }, [phase, sounds, haptics, juice, strikePelican]);

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

    // Apply juice shake
    juice.applyShake(ctx);

    const s = state.current;
    const cx = w / 2;
    const cy = h / 2;

    // Position pelicans
    const pelicanSpacing = (w - 80) / (PELICAN_COUNT - 1);
    for (let i = 0; i < PELICAN_COUNT; i++) {
      s.pelicans[i].x = 40 + i * pelicanSpacing;
      s.pelicans[i].y = cy - 20;
    }

    if (phase === 'ready') {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#1a2a4a');
      bgGrad.addColorStop(0.5, '#2a4a6a');
      bgGrad.addColorStop(1, '#0a1a3a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Water
      ctx.fillStyle = 'rgba(0,100,200,0.3)';
      ctx.fillRect(0, cy + 40, w, h - cy - 40);

      // Pelican silhouettes
      for (let i = 0; i < PELICAN_COUNT; i++) {
        drawPelicanSilhouette(ctx, s.pelicans[i].x, s.pelicans[i].y, false, 0, elapsed + s.pelicans[i].bobOffset);
      }

      // Neon title
      juice.drawNeonText(ctx, 'Signal Domino', cx, cy - 100, COLORS.cyan, 28);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('When one pelican strikes,', cx, cy - 60);
      ctx.fillText('all strike in sequence!', cx, cy - 36);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Tap to trigger each pelican in time', cx, cy + 80);

      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, 'TAP TO START', cx, cy + 130, COLORS.mint, 20);
      ctx.globalAlpha = 1;

      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.waterOffset = elapsed * 0.5;

    // Warning haptic when low time
    if (s.timeLeft <= 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      haptics.warningFeedback();
      sounds.tick();
    }

    // Check for missed tap
    if (s.waveActive && s.waitingForTap) {
      const now = performance.now();
      if (now > s.tapDeadline) {
        // Missed
        s.waveActive = false;
        s.waitingForTap = false;
        s.score = Math.max(0, s.score - 2);
        s.feedbackText = 'Cascade broken!';
        s.feedbackTimer = 0.8;
        s.missFlash = 0.3;
        s.waveCooldown = 1.2;
        setDisplayScore(s.score);
        sounds.fail();
        haptics.failFeedback();
        juice.shake(10, 0.35);
        juice.flash('#EF4444', 0.5);
      }
    }

    // Wave cooldown and auto-start
    if (!s.waveActive && s.waveCooldown > 0) {
      s.waveCooldown -= delta;
      if (s.waveCooldown <= 0) {
        startWave();
      }
    }

    // Flash decay
    for (const p of s.pelicans) {
      if (p.flashAlpha > 0) {
        p.flashAlpha -= delta * 2.5;
        if (p.flashAlpha < 0) p.flashAlpha = 0;
      }
    }

    if (s.missFlash > 0) s.missFlash -= delta;
    if (s.feedbackTimer > 0) s.feedbackTimer -= delta;

    // Update splash particles
    for (const p of s.splashParticles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 300 * delta;
      p.life -= delta;
      p.alpha = (p.life / p.maxLife) * 0.7;
      if (p.life <= 0) p.active = false;
    }

    // Update ripples
    for (const r of s.waterRipples) {
      if (!r.active) continue;
      r.radius += (r.maxRadius - r.radius) * delta * 3;
      r.life -= delta;
      if (r.life <= 0) r.active = false;
    }

    // Update juice
    juice.update(delta);

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(s.score);
      sounds.success();
      haptics.heavyFeedback();
      return;
    }

    // --- RENDER ---
    // Sky
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0a1530');
    bgGrad.addColorStop(0.4, '#1a3050');
    bgGrad.addColorStop(0.6, '#2a5070');
    bgGrad.addColorStop(1, '#0a2040');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Water
    const waterY = cy + 40;
    const waterGrad = ctx.createLinearGradient(0, waterY, 0, h);
    waterGrad.addColorStop(0, 'rgba(0,100,180,0.5)');
    waterGrad.addColorStop(0.3, 'rgba(0,80,160,0.4)');
    waterGrad.addColorStop(1, 'rgba(0,40,100,0.6)');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterY, w, h - waterY);

    // Water waves
    ctx.beginPath();
    ctx.moveTo(0, waterY);
    for (let x = 0; x <= w; x += 5) {
      const waveY = waterY + Math.sin((x * 0.02) + s.waterOffset * 3) * 3 + Math.sin((x * 0.01) + s.waterOffset * 2) * 2;
      ctx.lineTo(x, waveY);
    }
    ctx.lineTo(w, waterY + 10);
    ctx.lineTo(0, waterY + 10);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100,180,255,0.15)';
    ctx.fill();

    // Miss flash (kept from original + juice flash overlay)
    if (s.missFlash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${s.missFlash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice screen flash overlay
    juice.drawFlash(ctx, w, h);

    // Water ripples
    for (const r of s.waterRipples) {
      if (!r.active) continue;
      const alpha = (r.life / r.maxLife) * 0.4;
      ctx.beginPath();
      ctx.ellipse(r.x, r.y, r.radius, r.radius * 0.3, 0, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(150,200,255,${alpha})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Pelicans
    for (let i = 0; i < PELICAN_COUNT; i++) {
      const pel = s.pelicans[i];
      drawPelicanSilhouette(ctx, pel.x, pel.y, pel.struck, pel.flashAlpha, elapsed + pel.bobOffset);

      // Glow effect on struck pelicans (additive blending)
      if (pel.struck) {
        juice.drawGlow(ctx, pel.x, pel.y, 50, COLORS.cyan, 0.25);
      }

      // Flash effect
      if (pel.flashAlpha > 0.1) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const flashGrad = ctx.createRadialGradient(pel.x, pel.y, 0, pel.x, pel.y, 60);
        flashGrad.addColorStop(0, `rgba(255,255,255,${pel.flashAlpha * 0.5})`);
        flashGrad.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = flashGrad;
        ctx.fillRect(pel.x - 60, pel.y - 60, 120, 120);
        ctx.restore();
      }

      // Index indicator with glow
      if (s.waveActive && s.waitingForTap && i === s.currentPelican) {
        const indAlpha = 0.5 + Math.sin(elapsed * 10) * 0.5;
        // Outer glow
        juice.drawGlow(ctx, pel.x, pel.y - 50, 20, COLORS.mint, indAlpha * 0.5);
        ctx.beginPath();
        ctx.arc(pel.x, pel.y - 50, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(46,234,163,${indAlpha})`;
        ctx.fill();
      }
    }

    // Splash particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.splashParticles) {
      if (!p.active) continue;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(150,200,255,${p.alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // Connection line during wave with additive blending
    if (s.waveActive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < s.currentPelican && i < PELICAN_COUNT - 1; i++) {
        const p1 = s.pelicans[i];
        const p2 = s.pelicans[i + 1];
        if (p2.struck) {
          ctx.beginPath();
          ctx.moveTo(p1.x, p1.y);
          ctx.lineTo(p2.x, p2.y);
          ctx.strokeStyle = 'rgba(0,212,255,0.4)';
          ctx.lineWidth = 2;
          ctx.shadowColor = COLORS.cyan;
          ctx.shadowBlur = 10;
          ctx.stroke();
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
    }

    // Feedback with neon text
    if (s.feedbackTimer > 0) {
      const alpha = Math.min(1, s.feedbackTimer * 2);
      ctx.globalAlpha = alpha;
      const fbColor = s.feedbackText.includes('broken') ? COLORS.red : COLORS.mint;
      juice.drawNeonText(ctx, s.feedbackText, cx, cy - 80, fbColor, 30);
      ctx.globalAlpha = 1;
    }

    // Wave counter with neon style
    juice.drawNeonText(ctx, `Wave ${s.completedWaves} | Speed x${s.waveSpeed.toFixed(1)}`, cx, h - 30, COLORS.gray, 16);

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);
    // Glow on the timer bar edge
    if (timerFrac > 0) {
      juice.drawGlow(ctx, w * timerFrac, 2, 15, timerColor, 0.6);
    }

    // Timer + score with neon text
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, s.timeLeft < 5 ? COLORS.red : COLORS.white, 24);

    ctx.save();
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${s.score}`, 20, 40);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Bloom post-processing pass
    juice.applyBloom(ctx, w, h, 0.08);

    ctx.restore();
  }, [phase, sounds, haptics, juice, startWave, spawnSplash, spawnRipple]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0;
      s.wave = 0;
      s.waveSpeed = 1.0;
      s.completedWaves = 0;
      s.timeLeft = GAME_DURATION;
      s.waveCooldown = 0.5;
      s.waveActive = false;
      for (const p of s.pelicans) {
        p.struck = false;
        p.flashAlpha = 0;
      }
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
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white,
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 12,
            textShadow: `0 0 20px ${COLORS.cyan}, 0 0 40px ${COLORS.cyan}80`,
          }}>Time's Up!</div>
          <div style={{
            color: COLORS.cyan,
            fontSize: 48,
            fontWeight: 'bold',
            marginBottom: 8,
            textShadow: `0 0 20px ${COLORS.cyan}, 0 0 40px ${COLORS.cyan}, 0 0 60px ${COLORS.cyan}80`,
          }}>{displayScore}</div>
          <div style={{
            color: COLORS.gray,
            fontSize: 16,
            marginBottom: 4,
            textShadow: `0 0 8px ${COLORS.gray}60`,
          }}>
            {state.current.completedWaves} waves completed
          </div>
          <div style={{
            color: COLORS.gray,
            fontSize: 14,
            marginBottom: 24,
            textShadow: `0 0 8px ${COLORS.gray}60`,
          }}>
            Pelicans synchronize perfectly!
          </div>
          <button onClick={() => {
            sounds.chime();
            haptics.tapFeedback();
            onComplete(state.current.score);
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.mint})`,
            color: COLORS.primary,
            border: 'none',
            padding: '14px 40px',
            borderRadius: 12,
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.cyan}80, 0 0 40px ${COLORS.cyan}40`,
            textShadow: 'none',
          }}>Continue</button>
          <button onClick={() => {
            sounds.tick();
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.05)',
            color: COLORS.gray,
            border: `1px solid ${COLORS.gray}60`,
            padding: '10px 30px',
            borderRadius: 12,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            textShadow: `0 0 8px ${COLORS.gray}40`,
          }}>Back</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => {
          haptics.tapFeedback();
          onBack();
        }} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
          color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 14, cursor: 'pointer', zIndex: 10, fontFamily: FONT_FAMILY,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>Back</button>
      )}
    </div>
  );
}

function drawPelicanSilhouette(ctx, x, y, struck, flashAlpha, bobTime) {
  ctx.save();
  const bob = Math.sin(bobTime * 1.5) * 3;
  ctx.translate(x, y + bob);

  const headDip = struck ? 20 : 0;

  // Body
  ctx.beginPath();
  ctx.ellipse(0, 10, 20, 28, 0, 0, Math.PI * 2);
  ctx.fillStyle = struck ? '#e8e8f0' : '#c0c0d0';
  ctx.fill();

  // Neck
  ctx.beginPath();
  ctx.moveTo(-5, -10);
  ctx.quadraticCurveTo(-8, -25 + headDip * 0.3, -3, -35 + headDip);
  ctx.quadraticCurveTo(3, -35 + headDip, 5, -25 + headDip * 0.3);
  ctx.lineTo(5, -10);
  ctx.fillStyle = struck ? '#e8e8f0' : '#c0c0d0';
  ctx.fill();

  // Head
  ctx.beginPath();
  ctx.arc(0, -38 + headDip, 10, 0, Math.PI * 2);
  ctx.fill();

  // Beak + pouch
  ctx.beginPath();
  ctx.moveTo(8, -38 + headDip);
  ctx.lineTo(30, -35 + headDip);
  ctx.lineTo(28, -30 + headDip);
  ctx.quadraticCurveTo(15, -20 + headDip, 5, -30 + headDip);
  ctx.closePath();
  ctx.fillStyle = '#F5A623';
  ctx.fill();

  // Pouch
  if (struck) {
    ctx.beginPath();
    ctx.moveTo(8, -32 + headDip);
    ctx.quadraticCurveTo(18, -18 + headDip, 5, -28 + headDip);
    ctx.fillStyle = '#e8a020';
    ctx.fill();
  }

  // Eye
  ctx.beginPath();
  ctx.arc(3, -40 + headDip, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();

  // Wing
  ctx.beginPath();
  ctx.ellipse(-8, 5, 16, 22, -0.2, 0, Math.PI * 2);
  ctx.fillStyle = struck ? '#d0d0e0' : '#b0b0c0';
  ctx.fill();

  ctx.restore();
}
