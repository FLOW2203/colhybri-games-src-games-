import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';

const GAME_DURATION = 30;
const POOL_SIZE = 100;
const COLIBRI_WEIGHT = 2;
const LIVES_TOTAL = 3;
const INITIAL_SPEED = 120;
const SPEED_INCREASE = 8;
const SPAWN_INTERVAL_BASE = 1.4;
const SPAWN_INTERVAL_MIN = 0.5;
const COMBO_THRESHOLD = 5;
const PARCEL_WIDTH_RATIO = 0.16;
const PARCEL_HEIGHT_RATIO = 0.08;

const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";

const PARCEL_COLORS = [
  [180, 140, 100], [200, 160, 110], [160, 120, 90],
  [190, 150, 105], [170, 130, 95],
];

export default function GameTimbreExpress({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION,
    score: 0,
    lives: LIVES_TOTAL,
    streak: 0,
    maxStreak: 0,
    comboMultiplier: 1,
    parcels: Array(20).fill(null).map(() => ({
      active: false, x: 0, y: 0, weight: 0, speed: 0,
      golden: false, color: [180, 140, 100], swipeDir: 0,
      swiping: false, swipeVx: 0, fadeAlpha: 1,
    })),
    spawnTimer: 0,
    spawnInterval: SPAWN_INTERVAL_BASE,
    currentSpeed: INITIAL_SPEED,
    totalSorted: 0,
    scaleAngle: 0,
    scaleTilt: 0,
    birdBob: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    flashAlpha: 0,
    flashColor: [0, 0, 0],
    dragParcelIdx: -1,
    dragStartX: 0,
    dragStartY: 0,
    lastSwipeParcel: -1,
  });

  const spawnParticles = useCallback((cx, cy, count, colors) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 30;
        p.y = cy + (Math.random() - 0.5) * 20;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2;
        const speed = 50 + Math.random() * 130;
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

  const spawnParcel = useCallback((w) => {
    const s = state.current;
    for (let i = 0; i < s.parcels.length; i++) {
      const p = s.parcels[i];
      if (!p.active) {
        p.active = true;
        p.x = w * 0.2 + Math.random() * w * 0.6;
        p.y = -50;
        p.weight = Math.floor(Math.random() * 10) + 1;
        p.speed = s.currentSpeed + (Math.random() - 0.5) * 30;
        p.golden = Math.random() < 0.12;
        p.color = PARCEL_COLORS[Math.floor(Math.random() * PARCEL_COLORS.length)];
        p.swiping = false;
        p.swipeVx = 0;
        p.fadeAlpha = 1;
        return;
      }
    }
  }, []);

  const sortParcel = useCallback((parcelIdx, direction) => {
    const s = state.current;
    const p = s.parcels[parcelIdx];
    if (!p.active || p.swiping) return;

    const isLight = p.weight < COLIBRI_WEIGHT;
    const swipedLeft = direction === 'left';
    const correct = (isLight && swipedLeft) || (!isLight && !swipedLeft);

    p.swiping = true;
    p.swipeVx = swipedLeft ? -600 : 600;

    if (correct) {
      const basePoints = p.golden ? 30 : 10;
      s.score += basePoints * s.comboMultiplier;
      s.streak++;
      if (s.streak > s.maxStreak) s.maxStreak = s.streak;
      if (s.streak >= COMBO_THRESHOLD) {
        s.comboMultiplier = 1 + Math.floor(s.streak / COMBO_THRESHOLD);
      }
      s.totalSorted++;
      s.flashAlpha = 0.15;
      s.flashColor = [34, 197, 94];
      s.scaleTilt = swipedLeft ? -0.15 : 0.15;
      sounds.tick();
      sounds.whoosh();
      haptics.tapFeedback();
      juice.flash('#22C55E', 0.2);
      if (s.streak >= COMBO_THRESHOLD && s.streak % COMBO_THRESHOLD === 0) {
        sounds.combo(s.comboMultiplier);
        haptics.comboFeedback(s.comboMultiplier);
      }
      spawnParticles(p.x, p.y, 6, [
        [34, 197, 94], [46, 234, 163], [255, 255, 255],
      ]);
    } else {
      s.lives--;
      s.streak = 0;
      s.comboMultiplier = 1;
      s.flashAlpha = 0.25;
      s.flashColor = [239, 68, 68];
      sounds.firecrackle();
      sounds.fail();
      haptics.failFeedback();
      juice.shake(10, 0.35);
      juice.flash('#EF4444', 0.35);
      spawnParticles(p.x, p.y, 8, [
        [239, 68, 68], [255, 100, 100], [200, 50, 50],
      ]);
      if (s.lives <= 0) {
        sounds.impact();
        haptics.heavyFeedback();
        juice.shake(16, 0.5);
        setPhase('ended');
        setDisplayScore(s.score);
      }
    }
  }, [sounds, haptics, juice, spawnParticles]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    const s = state.current;

    // Find lowest active non-swiping parcel
    let lowestIdx = -1;
    let lowestY = -Infinity;
    for (let i = 0; i < s.parcels.length; i++) {
      const p = s.parcels[i];
      if (p.active && !p.swiping && p.y > lowestY) {
        lowestY = p.y;
        lowestIdx = i;
      }
    }
    if (lowestIdx >= 0 && (direction === 'left' || direction === 'right')) {
      sortParcel(lowestIdx, direction);
    }
  }, [phase, sortParcel]);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        sounds.countdown(true);
        haptics.tapFeedback();
      }
      return;
    }
    // Tap left/right half of screen as alternative to swipe
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    if (x < w / 2) {
      handleSwipe('left');
    } else {
      handleSwipe('right');
    }
  }, [phase, handleSwipe, sounds, haptics]);

  useTouch(canvasRef, { onTap: handleTap, onSwipe: handleSwipe });

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
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#2c1a4c');
      skyGrad.addColorStop(0.5, '#4a3a6c');
      skyGrad.addColorStop(1, '#1a1a3c');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['08']), cx, h * 0.3, COLORS.cyan, 28);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 8;
      ctx.fillText('Hummingbirds weigh just ~2g', cx, h * 0.38);
      ctx.fillText('as light as a postage stamp!', cx, h * 0.38 + 24);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Swipe LEFT for lighter than 2g', cx, h * 0.52);
      ctx.fillText('Swipe RIGHT for heavier', cx, h * 0.52 + 22);
      ctx.fillText('Or tap left/right half of screen', cx, h * 0.52 + 44);

      // Pulsing "TAP TO START" with neon
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, h * 0.72, COLORS.mint, 20);
      ctx.globalAlpha = 1;

      // Glow behind title
      juice.drawGlow(ctx, cx, h * 0.3, 120, COLORS.cyan, 0.15);

      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);

    // Warning haptic when low on time
    if (s.timeLeft <= 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      haptics.warningFeedback();
      sounds.countdown(false);
    }

    // Increase speed over time
    s.currentSpeed = INITIAL_SPEED + elapsed * SPEED_INCREASE;
    s.spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE - elapsed * 0.03);

    // Spawn parcels
    s.spawnTimer += delta;
    if (s.spawnTimer >= s.spawnInterval) {
      s.spawnTimer -= s.spawnInterval;
      spawnParcel(w);
    }

    // Update parcels
    const binY = h * 0.82;
    for (let i = 0; i < s.parcels.length; i++) {
      const p = s.parcels[i];
      if (!p.active) continue;
      if (p.swiping) {
        p.x += p.swipeVx * delta;
        p.fadeAlpha -= delta * 3;
        if (p.fadeAlpha <= 0 || p.x < -100 || p.x > w + 100) {
          p.active = false;
        }
      } else {
        p.y += p.speed * delta;
        // Missed parcel (fell past bins)
        if (p.y > binY + 60) {
          p.active = false;
          s.lives--;
          s.streak = 0;
          s.comboMultiplier = 1;
          s.flashAlpha = 0.2;
          s.flashColor = [239, 68, 68];
          sounds.firecrackle();
          sounds.impact();
          haptics.impactFeedback();
          juice.shake(8, 0.3);
          juice.flash('#EF4444', 0.25);
          if (s.lives <= 0) {
            haptics.heavyFeedback();
            juice.shake(16, 0.5);
            setPhase('ended');
            setDisplayScore(s.score);
            return;
          }
        }
      }
    }

    // Scale tilt decay
    s.scaleTilt *= Math.pow(0.02, delta);

    // Flash decay
    s.flashAlpha *= Math.pow(0.01, delta);

    // Bird bob
    s.birdBob = Math.sin(elapsed * 3) * 4;

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 60 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over by time
    if (s.timeLeft <= 0 && phase === 'playing') {
      sounds.success();
      haptics.successFeedback();
      setPhase('ended');
      setDisplayScore(s.score);
      return;
    }

    // --- RENDER ---
    // Apply screen shake
    juice.applyShake(ctx);

    // Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#2c1a4c');
    skyGrad.addColorStop(0.5, '#4a3a6c');
    skyGrad.addColorStop(1, '#1a1a3c');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Flash overlay (original)
    if (s.flashAlpha > 0.01) {
      const [fr, fg, fb] = s.flashColor;
      ctx.fillStyle = `rgba(${fr},${fg},${fb},${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay
    juice.drawFlash(ctx, w, h);

    // Bin area - left (light)
    const binWidth = w * 0.38;
    const binHeight = h * 0.12;
    const leftBinX = w * 0.05;
    const rightBinX = w * 0.57;

    // Left bin with glow
    juice.drawGlow(ctx, leftBinX + binWidth / 2, binY + binHeight / 2, binWidth * 0.6, '#64B4FF', 0.1);
    ctx.fillStyle = 'rgba(100,180,255,0.2)';
    ctx.strokeStyle = 'rgba(100,180,255,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(100,180,255,0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(leftBinX, binY, binWidth, binHeight, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(100,180,255,0.9)';
    ctx.fillText('LIGHTER', leftBinX + binWidth / 2, binY + binHeight / 2 - 6);
    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.fillText('< 2g', leftBinX + binWidth / 2, binY + binHeight / 2 + 10);
    // Arrow left
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillText('\u2190', leftBinX + binWidth / 2, binY - 10);

    // Right bin with glow
    juice.drawGlow(ctx, rightBinX + binWidth / 2, binY + binHeight / 2, binWidth * 0.6, '#FF9650', 0.1);
    ctx.fillStyle = 'rgba(255,150,80,0.2)';
    ctx.strokeStyle = 'rgba(255,150,80,0.5)';
    ctx.lineWidth = 2;
    ctx.shadowColor = 'rgba(255,150,80,0.4)';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.roundRect(rightBinX, binY, binWidth, binHeight, 8);
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = `bold 14px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,150,80,0.9)';
    ctx.fillText('HEAVIER', rightBinX + binWidth / 2, binY + binHeight / 2 - 6);
    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.fillText('> 2g', rightBinX + binWidth / 2, binY + binHeight / 2 + 10);
    // Arrow right
    ctx.font = `20px ${FONT_FAMILY}`;
    ctx.fillText('\u2192', rightBinX + binWidth / 2, binY - 10);

    // Center scale with colibri
    const scaleX = cx;
    const scaleY = binY + binHeight / 2;

    // Scale glow
    juice.drawGlow(ctx, scaleX, scaleY - 30, 40, COLORS.mint, 0.15);

    // Scale base
    ctx.fillStyle = 'rgba(200,200,200,0.4)';
    ctx.fillRect(scaleX - 2, scaleY - 30, 4, 35);
    ctx.beginPath();
    ctx.arc(scaleX, scaleY + 5, 12, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(200,200,200,0.3)';
    ctx.fill();

    // Scale beam (tilts on correct answer)
    ctx.save();
    ctx.translate(scaleX, scaleY - 30);
    ctx.rotate(s.scaleTilt);
    ctx.fillStyle = 'rgba(200,200,200,0.6)';
    ctx.fillRect(-30, -2, 60, 4);
    ctx.restore();

    // Small colibri on scale
    ctx.save();
    ctx.translate(scaleX, scaleY - 42 + s.birdBob);
    const bScale = 0.35;
    ctx.scale(bScale, bScale);
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.shadowColor = '#2EEAA3';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(18, -3, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(21, -5, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(23, -3);
    ctx.lineTo(32, -1);
    ctx.lineTo(23, 0);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();
    // Wings
    const miniWingY = Math.sin(elapsed * 18) * 12;
    ctx.globalAlpha = 0.5;
    ctx.beginPath();
    ctx.moveTo(-3, -3);
    ctx.quadraticCurveTo(-16, -22 + miniWingY, -28, -10 + miniWingY * 0.6);
    ctx.quadraticCurveTo(-18, -5, -3, -3);
    ctx.fillStyle = '#5ff5c0';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // "2g" neon label near colibri
    juice.drawNeonText(ctx, '2g', scaleX, scaleY - 56 + s.birdBob, COLORS.mint, 11);

    // Draw parcels
    const parcelW = w * PARCEL_WIDTH_RATIO;
    const parcelH = h * PARCEL_HEIGHT_RATIO;
    for (let i = 0; i < s.parcels.length; i++) {
      const p = s.parcels[i];
      if (!p.active) continue;
      ctx.save();
      ctx.globalAlpha = p.fadeAlpha;

      const px = p.x - parcelW / 2;
      const py = p.y - parcelH / 2;
      const [cr, cg, cb] = p.color;

      if (p.golden) {
        // Golden parcel glow (enhanced)
        ctx.shadowColor = 'rgba(245,166,35,0.8)';
        ctx.shadowBlur = 20;
        juice.drawGlow(ctx, p.x, p.y, parcelW * 1.2, '#F5A623', 0.25 * p.fadeAlpha);
      } else {
        // Subtle glow for regular parcels
        ctx.shadowColor = `rgba(${cr},${cg},${cb},0.3)`;
        ctx.shadowBlur = 6;
      }

      // Parcel body
      ctx.beginPath();
      ctx.roundRect(px, py, parcelW, parcelH, 4);
      if (p.golden) {
        const gGrad = ctx.createLinearGradient(px, py, px + parcelW, py + parcelH);
        gGrad.addColorStop(0, '#F5A623');
        gGrad.addColorStop(0.5, '#FFD700');
        gGrad.addColorStop(1, '#F5A623');
        ctx.fillStyle = gGrad;
      } else {
        ctx.fillStyle = `rgb(${cr},${cg},${cb})`;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // Parcel tape
      ctx.fillStyle = p.golden ? 'rgba(255,255,200,0.5)' : 'rgba(200,180,140,0.6)';
      ctx.fillRect(px + parcelW * 0.4, py, parcelW * 0.2, parcelH);
      ctx.fillRect(px, py + parcelH * 0.35, parcelW, parcelH * 0.3);

      // Weight label
      ctx.font = `bold ${Math.floor(parcelH * 0.45)}px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = p.golden ? '#4a3000' : '#3a2a1a';
      ctx.fillText(`${p.weight}g`, p.x, p.y);

      // Golden sparkle
      if (p.golden) {
        ctx.font = `10px ${FONT_FAMILY}`;
        ctx.fillStyle = '#FFD700';
        ctx.fillText('x3', p.x + parcelW * 0.3, p.y - parcelH * 0.3);
      }

      ctx.restore();
    }

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

    // --- HUD ---
    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = timerColor;
    ctx.shadowColor = timerColor;
    ctx.shadowBlur = 8;
    ctx.fillRect(0, 0, w * timerFrac, 4);
    ctx.shadowBlur = 0;

    // Timer text with neon
    const timerTextColor = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.save();
    ctx.textAlign = 'right';
    if (s.timeLeft < 5) {
      juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 20, 40, COLORS.red, 24);
    } else {
      ctx.font = `bold 24px ${FONT_FAMILY}`;
      ctx.fillStyle = timerTextColor;
      ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    }
    ctx.restore();

    // Score with neon glow
    juice.drawNeonText(ctx, t(UI_STRINGS.score) + ': ' + s.score, 80, 40, COLORS.white, 20);

    // Lives
    ctx.font = `18px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.red;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 8;
    let livesStr = '';
    for (let i = 0; i < LIVES_TOTAL; i++) {
      livesStr += i < s.lives ? '\u2665 ' : '\u2661 ';
    }
    ctx.fillText(livesStr, 20, 65);
    ctx.shadowBlur = 0;

    // Streak / Combo with neon
    if (s.streak >= COMBO_THRESHOLD) {
      const pulseScale = 1 + Math.sin(elapsed * 8) * 0.1;
      ctx.save();
      ctx.translate(cx, 55);
      ctx.scale(pulseScale, pulseScale);
      juice.drawNeonText(ctx, `COMBO x${s.comboMultiplier}`, 0, 0, COLORS.gold, 18);
      // Glow behind combo text
      ctx.restore();
      juice.drawGlow(ctx, cx, 55, 60, COLORS.gold, 0.2);
    }

    // Streak counter
    if (s.streak > 0) {
      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.mint;
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 6;
      ctx.fillText(t(UI_STRINGS.streak) + ': ' + s.streak, w - 20, 65);
      ctx.shadowBlur = 0;
    }

    // Sorted count
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText(`Sorted: ${s.totalSorted}`, cx, h - 15);

    // Bloom post-processing (subtle)
    juice.applyBloom(ctx, w, h, 0.06);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, spawnParcel, t]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION;
      s.score = 0;
      s.lives = LIVES_TOTAL;
      s.streak = 0;
      s.maxStreak = 0;
      s.comboMultiplier = 1;
      s.spawnTimer = 0;
      s.spawnInterval = SPAWN_INTERVAL_BASE;
      s.currentSpeed = INITIAL_SPEED;
      s.totalSorted = 0;
      s.scaleTilt = 0;
      s.flashAlpha = 0;
      s.dragParcelIdx = -1;
      for (const p of s.parcels) p.active = false;
      for (const p of s.particles) p.active = false;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') {
      gameLoop.stop();
      sounds.chime();
      haptics.successFeedback();
    }
  }, [phase, gameLoop, sounds, haptics]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', fontFamily: FONT_FAMILY }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white,
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 16,
            textShadow: `0 0 20px ${COLORS.cyan}, 0 0 40px ${COLORS.cyan}80`,
            fontFamily: FONT_FAMILY,
          }}>{t(UI_STRINGS.timesUp)}</div>
          <div style={{
            color: COLORS.mint,
            fontSize: 20,
            marginBottom: 8,
            textShadow: `0 0 12px ${COLORS.mint}`,
            fontFamily: FONT_FAMILY,
          }}>
            Parcels Sorted: {state.current.totalSorted}
          </div>
          <div style={{
            color: COLORS.gold,
            fontSize: 16,
            marginBottom: 4,
            textShadow: `0 0 10px ${COLORS.gold}`,
            fontFamily: FONT_FAMILY,
          }}>
            {t(UI_STRINGS.bestStreak)}: {state.current.maxStreak}
          </div>
          <div style={{
            color: COLORS.cyan,
            fontSize: 16,
            marginBottom: 4,
            textShadow: `0 0 10px ${COLORS.cyan}`,
            fontFamily: FONT_FAMILY,
          }}>
            Max Combo: x{Math.max(1, Math.floor(state.current.maxStreak / COMBO_THRESHOLD) + 1)}
          </div>
          <div style={{
            color: COLORS.white,
            fontSize: 44,
            fontWeight: 'bold',
            marginBottom: 4,
            textShadow: `0 0 30px ${COLORS.gold}, 0 0 60px ${COLORS.gold}80, 0 0 90px ${COLORS.gold}40`,
            fontFamily: FONT_FAMILY,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray,
            fontSize: 14,
            marginBottom: 24,
            fontFamily: FONT_FAMILY,
          }}>{t(UI_STRINGS.points)}</div>
          <button
            onClick={() => {
              sounds.pop();
              haptics.tapFeedback();
              onComplete(state.current.score);
            }}
            style={{
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
              boxShadow: `0 0 20px ${COLORS.cyan}60, 0 4px 15px rgba(0,0,0,0.3)`,
              textShadow: 'none',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
          >{t(UI_STRINGS.continueBtn)}</button>
          <button
            onClick={() => {
              sounds.tick();
              haptics.tapFeedback();
              onBack();
            }}
            style={{
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
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
          >{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button
          onClick={() => {
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
