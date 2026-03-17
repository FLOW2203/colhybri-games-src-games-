import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';

const GAME_DURATION = 15;
const HUMMINGBIRD_BPS = 80;
const POOL_SIZE = 100;
const FLOAT_TEXT_POOL = 20;
const SHOCKWAVE_POOL = 5;
const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";

export default function GameWingBeat({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

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
    // Floating "+1" texts
    floatTexts: Array(FLOAT_TEXT_POOL).fill(null).map(() => ({
      active: false, x: 0, y: 0, vy: 0, life: 0, maxLife: 0, text: '', alpha: 1,
    })),
    // Shockwave rings for milestones
    shockwaves: Array(SHOCKWAVE_POOL).fill(null).map(() => ({
      active: false, x: 0, y: 0, radius: 0, maxRadius: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0,
    })),
    lastMilestone: 0,
  });

  const spawnFloatText = useCallback((x, y, text) => {
    const s = state.current;
    for (let i = 0; i < s.floatTexts.length; i++) {
      const ft = s.floatTexts[i];
      if (!ft.active) {
        ft.active = true;
        ft.x = x + (Math.random() - 0.5) * 30;
        ft.y = y;
        ft.vy = -60 - Math.random() * 40;
        ft.life = 0.8 + Math.random() * 0.4;
        ft.maxLife = ft.life;
        ft.text = text;
        ft.alpha = 1;
        return;
      }
    }
  }, []);

  const spawnShockwave = useCallback((x, y, color) => {
    const s = state.current;
    for (let i = 0; i < s.shockwaves.length; i++) {
      const sw = s.shockwaves[i];
      if (!sw.active) {
        sw.active = true;
        sw.x = x;
        sw.y = y;
        sw.radius = 5;
        sw.maxRadius = 120;
        sw.life = 0.6;
        sw.maxLife = 0.6;
        const c = color || [46, 234, 163];
        sw.r = c[0]; sw.g = c[1]; sw.b = c[2];
        return;
      }
    }
  }, []);

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

    // Floating "+1" text
    spawnFloatText(cx + 30 + Math.random() * 20, cy + s.birdY - 20, '+1');

    // Haptic tap feedback
    haptics.tapFeedback();

    // Screen shake on each tap
    juice.shake(3, 0.08);

    // Flash green on fast taps
    if (s.tapsPerSecond >= 6) {
      juice.flash('#2EEAA3', 0.15);
    }

    // Sound: wingflap instead of tick
    sounds.wingflap();

    // Milestone shockwave every 10 taps
    const currentMilestone = Math.floor(s.totalTaps / 10);
    if (currentMilestone > s.lastMilestone && s.totalTaps > 0) {
      s.lastMilestone = currentMilestone;
      spawnShockwave(cx, cy + s.birdY, [0, 212, 255]);
      haptics.comboFeedback(currentMilestone);
      sounds.combo(currentMilestone);
    }
  }, [phase, sounds, haptics, juice, spawnParticles, spawnFloatText, spawnShockwave]);

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

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['05']), cx, cy - 60, COLORS.mint, 28);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('Hummingbird wings beat', cx, cy - 10);
      ctx.fillText('80 times per second!', cx, cy + 16);
      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Tap as fast as you can!', cx, cy + 60);

      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, cy + 110, COLORS.cyan, 20);
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

    // Update floating texts
    for (const ft of s.floatTexts) {
      if (!ft.active) continue;
      ft.y += ft.vy * delta;
      ft.life -= delta;
      ft.alpha = Math.max(0, ft.life / ft.maxLife);
      if (ft.life <= 0) ft.active = false;
    }

    // Update shockwaves
    for (const sw of s.shockwaves) {
      if (!sw.active) continue;
      sw.life -= delta;
      const progress = 1 - sw.life / sw.maxLife;
      sw.radius = 5 + (sw.maxRadius - 5) * progress;
      if (sw.life <= 0) sw.active = false;
    }

    // Update juice (shake, flash decay)
    juice.update(delta);

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(s.totalTaps);
      sounds.success();
      haptics.successFeedback();
      return;
    }

    // --- RENDER ---
    // Apply shake transform
    juice.applyShake(ctx);

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

    // Flash effect (original)
    if (s.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(46,234,163,${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay
    juice.drawFlash(ctx, w, h);

    // Draw hummingbird body
    const bx = cx;
    const by = cy + s.birdY;

    // Body glow (juice)
    juice.drawGlow(ctx, bx, by, 60 + s.tapsPerSecond * 2, '#2EEAA3', 0.25 + s.tapsPerSecond * 0.01);

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

    // Specular highlight on body
    ctx.beginPath();
    ctx.ellipse(-5, -8, 14, 6, -0.3, 0, Math.PI * 2);
    const specGrad = ctx.createRadialGradient(-5, -8, 0, -5, -8, 14);
    specGrad.addColorStop(0, 'rgba(255,255,255,0.45)');
    specGrad.addColorStop(0.5, 'rgba(255,255,255,0.12)');
    specGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = specGrad;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(28, -5, 10, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.fill();

    // Specular highlight on head
    ctx.beginPath();
    ctx.arc(26, -8, 5, 0, Math.PI * 2);
    const headSpecGrad = ctx.createRadialGradient(26, -8, 0, 26, -8, 5);
    headSpecGrad.addColorStop(0, 'rgba(255,255,255,0.5)');
    headSpecGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = headSpecGrad;
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

    // Particles with additive blending
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

    // Shockwave rings
    for (const sw of s.shockwaves) {
      if (!sw.active) continue;
      const alpha = sw.life / sw.maxLife;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${sw.r},${sw.g},${sw.b},${alpha * 0.7})`;
      ctx.lineWidth = 3 * alpha;
      ctx.stroke();
      // Inner ring
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius * 0.7, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255,255,255,${alpha * 0.3})`;
      ctx.lineWidth = 1.5 * alpha;
      ctx.stroke();
      ctx.restore();
    }

    // Floating "+1" texts
    for (const ft of s.floatTexts) {
      if (!ft.active) continue;
      ctx.save();
      ctx.globalAlpha = ft.alpha;
      ctx.font = `bold 18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.shadowColor = '#2EEAA3';
      ctx.shadowBlur = 8;
      ctx.fillText(ft.text, ft.x, ft.y);
      ctx.shadowBlur = 0;
      ctx.restore();
    }

    // Giant taps/second counter with neon text
    juice.drawNeonText(ctx, `${s.tapsPerSecond}`, cx, h * 0.2, COLORS.cyan, 72);
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText('taps/second', cx, h * 0.2 + 40);

    // Milestone text (neon) when hitting multiples of 10
    if (s.totalTaps > 0 && s.totalTaps % 10 === 0) {
      const mAlpha = Math.max(0, 1 - ((now - s.lastTapTime) / 1000));
      if (mAlpha > 0.05) {
        ctx.save();
        ctx.globalAlpha = mAlpha;
        juice.drawNeonText(ctx, `${s.totalTaps} taps!`, cx, h * 0.32, COLORS.gold, 24);
        ctx.restore();
      }
    }

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.cyan;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer text
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    // Total taps
    ctx.font = `16px ${FONT_FAMILY}`;
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
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.gold;
    ctx.fillText(`${HUMMINGBIRD_BPS}/s`, barX + barW, barY - 8);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.mint;
    ctx.fillText(`You: ${s.tapsPerSecond}/s`, barX, barY - 8);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles]));

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
      s.lastMilestone = 0;
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
          background: 'rgba(10,15,28,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16,
            textShadow: `0 0 20px ${COLORS.cyan}, 0 0 40px ${COLORS.cyan}40`,
            fontFamily: FONT_FAMILY,
          }}>{t(UI_STRINGS.timesUp)}</div>
          <div style={{
            color: COLORS.mint, fontSize: 20, marginBottom: 8,
            textShadow: `0 0 12px ${COLORS.mint}80`,
            fontFamily: FONT_FAMILY,
          }}>
            You: {avgTps} taps/s
          </div>
          <div style={{
            color: COLORS.gold, fontSize: 20, marginBottom: 8,
            textShadow: `0 0 12px ${COLORS.gold}80`,
            fontFamily: FONT_FAMILY,
          }}>
            Hummingbird: {HUMMINGBIRD_BPS} taps/s
          </div>
          <div style={{
            color: COLORS.cyan, fontSize: 16, marginBottom: 4,
            textShadow: `0 0 10px ${COLORS.cyan}60`,
            fontFamily: FONT_FAMILY,
          }}>
            Peak: {state.current.peakTps} taps/s
          </div>
          <div style={{
            color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4,
            textShadow: `0 0 30px ${COLORS.mint}, 0 0 60px ${COLORS.mint}40`,
            fontFamily: FONT_FAMILY,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 14, marginBottom: 24,
            fontFamily: FONT_FAMILY,
          }}>total taps</div>
          <button onClick={() => onComplete(state.current.totalTaps)} style={{
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
            boxShadow: `0 4px 20px ${COLORS.cyan}40`,
            textShadow: 'none',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={onBack} style={{
            background: 'rgba(255,255,255,0.08)',
            color: COLORS.gray,
            border: `1px solid rgba(255,255,255,0.15)`,
            padding: '10px 30px',
            borderRadius: 12,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
          }}>{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={onBack} style={{
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
