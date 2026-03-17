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
const POOL_SIZE = 100;
const BODY_WEIGHT = 3;
const GOAL_WEIGHT = BODY_WEIGHT * 300;
const MISS_PENALTY = 10;
const BASE_FALL_SPEED = 150;
const SPEED_INCREASE_INTERVAL = 5;
const SPAWN_INTERVAL_BASE = 0.6;
const MILESTONES = [BODY_WEIGHT * 100, BODY_WEIGHT * 200, BODY_WEIGHT * 300];

const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";

const FOOD_TYPES = [
  { type: 'insect', weight: 1, color: '#8B6914', size: 12, emoji: null },
  { type: 'nectar', weight: 2, color: '#FFD700', size: 14, emoji: null },
  { type: 'flower', weight: 5, color: '#FF69B4', size: 18, emoji: null },
];

export default function Game300Cheeseburgers({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    weight: 0,
    timeLeft: GAME_DURATION,
    items: Array(30).fill(null).map(() => ({
      active: false, x: 0, y: 0, vy: 0, type: 0, size: 0, weight: 0,
      r: 0, g: 0, b: 0, rotation: 0, rotSpeed: 0,
    })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    lastSpawnTime: 0,
    spawnInterval: SPAWN_INTERVAL_BASE,
    speedMultiplier: 1,
    milestoneHit: [false, false, false],
    flashAlpha: 0,
    flashColor: [46, 234, 163],
    comboCount: 0,
    lastCatchTime: 0,
    birdBobPhase: 0,
    birdMouthOpen: 0,
    bgStars: Array(40).fill(null).map(() => ({
      x: Math.random() * 1000,
      y: Math.random() * 1000,
      size: 1 + Math.random() * 2,
      twinkle: Math.random() * Math.PI * 2,
    })),
  });

  const spawnParticles = useCallback((cx, cy, count, colors) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 20;
        p.y = cy + (Math.random() - 0.5) * 20;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2;
        const speed = 80 + Math.random() * 180;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.4 + Math.random() * 0.6;
        p.maxLife = p.life;
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.r = c[0]; p.g = c[1]; p.b = c[2];
        p.size = 2 + Math.random() * 4;
        p.type = Math.random() > 0.4 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        sounds.countdown(true);
        haptics.tapFeedback();
      }
      return;
    }
    const s = state.current;
    // Check if tapped on a food item (closest first)
    let bestDist = Infinity;
    let bestIdx = -1;
    for (let i = 0; i < s.items.length; i++) {
      const item = s.items[i];
      if (!item.active) continue;
      const dx = x - item.x;
      const dy = y - item.y;
      const dist = dx * dx + dy * dy;
      const hitRadius = item.size + 25;
      if (dist < hitRadius * hitRadius && dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0) {
      const item = s.items[bestIdx];
      item.active = false;
      s.weight += item.weight;
      s.birdMouthOpen = 0.4;
      const now = performance.now();
      if (now - s.lastCatchTime < 800) {
        s.comboCount++;
      } else {
        s.comboCount = 1;
      }
      s.lastCatchTime = now;

      const particleColors = [[item.r, item.g, item.b], [255, 255, 255], [46, 234, 163]];
      spawnParticles(item.x, item.y, 5 + s.comboCount, particleColors);

      // Haptic + sound for catch
      haptics.tapFeedback();
      sounds.pop();

      // Combo sound and haptic
      if (s.comboCount > 2) {
        sounds.combo(s.comboCount);
        haptics.comboFeedback(Math.min(s.comboCount, 5));
      }

      // Check milestones
      for (let m = 0; m < MILESTONES.length; m++) {
        if (!s.milestoneHit[m] && s.weight >= MILESTONES[m]) {
          s.milestoneHit[m] = true;
          s.flashAlpha = 0.4;
          s.flashColor = [245, 166, 35];
          const canvas = canvasRef.current;
          const dpr = window.devicePixelRatio || 1;
          const cw = canvas ? canvas.width / dpr : 400;
          const ch = canvas ? canvas.height / dpr : 700;
          spawnParticles(cw / 2, ch / 2, 25, [[245, 166, 35], [255, 215, 0], [255, 255, 255]]);
          sounds.chime();
          sounds.powerup();
          haptics.successFeedback();
          juice.shake(10, 0.35);
          juice.flash('#F5A623', 0.5);
        }
      }
      if (s.comboCount <= 2) {
        sounds.tick();
      }
    } else {
      // Tapped but missed all items
      haptics.tapFeedback();
    }
  }, [phase, sounds, spawnParticles, haptics, juice]);

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

    // Update juice system
    juice.update(delta);

    if (phase === 'ready') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1a0a2e');
      skyGrad.addColorStop(0.5, '#2d1b4e');
      skyGrad.addColorStop(1, '#4a2a6e');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['06']), cx, h / 2 - 60, '#2EEAA3', 28);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 8;
      ctx.fillText('Hummingbirds eat 300x', cx, h / 2 - 10);
      ctx.fillText('their body weight daily!', cx, h / 2 + 16);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('TAP falling food to eat it', cx, h / 2 + 56);
      ctx.fillText(`Goal: ${GOAL_WEIGHT}g`, cx, h / 2 + 78);

      // Pulsing glow behind TAP TO START
      const pulseAlpha = 0.2 + Math.sin(elapsed * 4) * 0.15;
      juice.drawGlow(ctx, cx, h / 2 + 130, 80, '#2EEAA3', pulseAlpha);

      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, h / 2 + 130, '#FFFFFF', 20);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // --- UPDATE ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.birdBobPhase += delta * 4;
    s.birdMouthOpen = Math.max(0, s.birdMouthOpen - delta * 2);

    // Speed scaling
    const speedTier = Math.floor(elapsed / SPEED_INCREASE_INTERVAL);
    s.speedMultiplier = 1 + speedTier * 0.4;
    s.spawnInterval = Math.max(0.25, SPAWN_INTERVAL_BASE - speedTier * 0.1);

    // Warning haptic when time is low
    if (s.timeLeft <= 3 && s.timeLeft > 0 && Math.floor(s.timeLeft + delta) !== Math.floor(s.timeLeft)) {
      haptics.warningFeedback();
      sounds.countdown(false);
    }

    // Spawn food items
    if (elapsed - s.lastSpawnTime > s.spawnInterval) {
      s.lastSpawnTime = elapsed;
      for (let i = 0; i < s.items.length; i++) {
        const item = s.items[i];
        if (!item.active) {
          const foodDef = FOOD_TYPES[Math.floor(Math.random() * FOOD_TYPES.length)];
          item.active = true;
          item.x = 40 + Math.random() * (w - 80);
          item.y = -20;
          item.vy = BASE_FALL_SPEED * s.speedMultiplier * (0.8 + Math.random() * 0.4);
          item.type = FOOD_TYPES.indexOf(foodDef);
          item.size = foodDef.size;
          item.weight = foodDef.weight;
          const hex = foodDef.color;
          item.r = parseInt(hex.slice(1, 3), 16);
          item.g = parseInt(hex.slice(3, 5), 16);
          item.b = parseInt(hex.slice(5, 7), 16);
          item.rotation = 0;
          item.rotSpeed = (Math.random() - 0.5) * 4;
          break;
        }
      }
    }

    // Update items
    for (const item of s.items) {
      if (!item.active) continue;
      item.y += item.vy * delta;
      item.rotation += item.rotSpeed * delta;
      if (item.y > h + 30) {
        item.active = false;
        s.weight = Math.max(0, s.weight - MISS_PENALTY);
        s.flashAlpha = 0.15;
        s.flashColor = [239, 68, 68];
        // Miss feedback
        juice.shake(4, 0.15);
        juice.flash('#EF4444', 0.2);
        haptics.impactFeedback();
        sounds.impact();
      }
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 60 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Flash decay
    s.flashAlpha *= Math.pow(0.005, delta);

    // Game over check
    if (s.timeLeft <= 0 && phase === 'playing') {
      const finalWeight = Math.floor(s.weight);
      setPhase('ended');
      setDisplayScore(finalWeight);
      if (finalWeight >= GOAL_WEIGHT) {
        sounds.success();
        haptics.successFeedback();
        juice.flash('#2EEAA3', 0.4);
      } else {
        sounds.fail();
        haptics.failFeedback();
        juice.flash('#EF4444', 0.3);
      }
      return;
    }

    // --- RENDER ---
    // Apply screen shake
    juice.applyShake(ctx);

    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#1a0a2e');
    skyGrad.addColorStop(0.5, '#2d1b4e');
    skyGrad.addColorStop(1, '#4a2a6e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Background stars
    for (const star of s.bgStars) {
      const sx = (star.x / 1000) * w;
      const sy = (star.y / 1000) * h;
      star.twinkle += delta * 3;
      const alpha = 0.3 + Math.sin(star.twinkle) * 0.3;
      ctx.beginPath();
      ctx.arc(sx, sy, star.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      ctx.fill();
    }

    // Flash effect (original)
    if (s.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(${s.flashColor[0]},${s.flashColor[1]},${s.flashColor[2]},${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay
    juice.drawFlash(ctx, w, h);

    // Draw food items with glow
    for (const item of s.items) {
      if (!item.active) continue;

      // Glow behind food items
      const glowColor = `rgb(${item.r},${item.g},${item.b})`;
      juice.drawGlow(ctx, item.x, item.y, item.size * 2.5, glowColor, 0.25);

      ctx.save();
      ctx.translate(item.x, item.y);
      ctx.rotate(item.rotation);

      if (item.type === 0) {
        // Insect - small bug shape
        ctx.beginPath();
        ctx.ellipse(0, 0, item.size * 0.6, item.size * 0.35, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${item.r},${item.g},${item.b})`;
        ctx.fill();
        // Wings
        ctx.beginPath();
        ctx.ellipse(-3, -item.size * 0.3, 5, 3, -0.3, 0, Math.PI * 2);
        ctx.ellipse(3, -item.size * 0.3, 5, 3, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,200,255,0.5)';
        ctx.fill();
        // Label
        ctx.fillStyle = COLORS.white;
        ctx.font = `9px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText('1g', 0, item.size + 10);
      } else if (item.type === 1) {
        // Nectar drop
        ctx.beginPath();
        ctx.moveTo(0, -item.size * 0.6);
        ctx.quadraticCurveTo(item.size * 0.5, 0, 0, item.size * 0.5);
        ctx.quadraticCurveTo(-item.size * 0.5, 0, 0, -item.size * 0.6);
        ctx.fillStyle = `rgb(${item.r},${item.g},${item.b})`;
        ctx.fill();
        // Shine
        ctx.beginPath();
        ctx.arc(-2, -3, 3, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.fill();
        ctx.fillStyle = COLORS.white;
        ctx.font = `9px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText('2g', 0, item.size + 10);
      } else {
        // Flower
        for (let p = 0; p < 5; p++) {
          const angle = (p / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.ellipse(
            Math.cos(angle) * item.size * 0.35,
            Math.sin(angle) * item.size * 0.35,
            item.size * 0.3, item.size * 0.18, angle, 0, Math.PI * 2
          );
          ctx.fillStyle = `rgb(${item.r},${item.g},${item.b})`;
          ctx.fill();
        }
        ctx.beginPath();
        ctx.arc(0, 0, item.size * 0.2, 0, Math.PI * 2);
        ctx.fillStyle = '#FFD700';
        ctx.fill();
        ctx.fillStyle = COLORS.white;
        ctx.font = `9px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillText('5g', 0, item.size + 10);
      }
      ctx.restore();
    }

    // Draw hummingbird at bottom center
    const birdX = cx;
    const birdY = h - 80 + Math.sin(s.birdBobPhase) * 5;

    // Glow around the bird
    juice.drawGlow(ctx, birdX, birdY, 50, '#2EEAA3', 0.2);

    ctx.save();
    ctx.translate(birdX, birdY);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 20, 12, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createLinearGradient(-20, -12, 20, 12);
    bodyGrad.addColorStop(0, '#2EEAA3');
    bodyGrad.addColorStop(1, '#0d6b47');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(22, -4, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(26, -6, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(26.5, -6.5, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Beak (opens when catching)
    const mouthOpen = s.birdMouthOpen * 4;
    ctx.beginPath();
    ctx.moveTo(30, -4 - mouthOpen);
    ctx.lineTo(44, -2);
    ctx.lineTo(30, -1);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();
    if (mouthOpen > 0.5) {
      ctx.beginPath();
      ctx.moveTo(30, 0 + mouthOpen);
      ctx.lineTo(42, 0);
      ctx.lineTo(30, -1);
      ctx.closePath();
      ctx.fillStyle = '#444';
      ctx.fill();
    }

    // Wings
    const wingAngle = Math.sin(elapsed * 25) * 18;
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(-22, -32 + wingAngle, -38, -16 + wingAngle * 0.7);
    ctx.quadraticCurveTo(-26, -6, -4, -4);
    ctx.fillStyle = '#5ff5c0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(-22, 32 - wingAngle, -38, 16 - wingAngle * 0.7);
    ctx.quadraticCurveTo(-26, 6, -4, 4);
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

    // --- HUD ---
    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 3 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Glow on timer bar edge
    if (timerFrac > 0.01) {
      juice.drawGlow(ctx, w * timerFrac, 2, 12, timerColor, 0.5);
    }

    // Timer text - neon
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, s.timeLeft < 3 ? '#EF4444' : '#FFFFFF', 24);

    // Weight counter - neon
    juice.drawNeonText(ctx, `${Math.floor(s.weight)}g`, cx, 50, '#FFFFFF', 40);

    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.gold;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 6;
    const multiplier = Math.floor(s.weight / BODY_WEIGHT);
    ctx.fillText(`${multiplier}x body weight`, cx, 70);
    ctx.shadowBlur = 0;

    // Progress bar (0 -> 900g)
    const barX = 30;
    const barY = h - 30;
    const barW = w - 60;
    const barH = 14;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(barX, barY, barW, barH);
    const progressFrac = Math.min(1, s.weight / GOAL_WEIGHT);
    const progGrad = ctx.createLinearGradient(barX, 0, barX + barW, 0);
    progGrad.addColorStop(0, COLORS.mint);
    progGrad.addColorStop(0.5, COLORS.gold);
    progGrad.addColorStop(1, COLORS.magenta);
    ctx.fillStyle = progGrad;
    ctx.fillRect(barX, barY, barW * progressFrac, barH);

    // Glow at progress bar leading edge
    if (progressFrac > 0.01) {
      juice.drawGlow(ctx, barX + barW * progressFrac, barY + barH / 2, 16, COLORS.gold, 0.4);
    }

    // Milestone markers
    ctx.font = `bold 10px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    for (let m = 0; m < MILESTONES.length; m++) {
      const mx = barX + (MILESTONES[m] / GOAL_WEIGHT) * barW;
      ctx.fillStyle = s.milestoneHit[m] ? COLORS.gold : 'rgba(255,255,255,0.4)';
      ctx.fillRect(mx - 1, barY - 4, 2, barH + 8);
      if (s.milestoneHit[m]) {
        ctx.shadowColor = COLORS.gold;
        ctx.shadowBlur = 8;
      }
      ctx.fillText(`${(m + 1) * 100}x`, mx, barY - 8);
      ctx.shadowBlur = 0;
    }

    // Goal label
    ctx.font = `10px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText('0g', barX, barY - 4);
    ctx.textAlign = 'right';
    ctx.fillText(`${GOAL_WEIGHT}g`, barX + barW, barY - 4);

    // Speed indicator - neon
    if (s.speedMultiplier > 1) {
      juice.drawNeonText(ctx, `SPEED x${s.speedMultiplier.toFixed(1)}`, 80, 40, '#FF6B35', 14);
    }

    // Combo indicator - neon with glow
    if (s.comboCount > 2) {
      const comboAlpha = 0.5 + Math.sin(elapsed * 8) * 0.5;
      juice.drawGlow(ctx, cx, 95, 40, COLORS.gold, comboAlpha * 0.3);
      ctx.globalAlpha = comboAlpha;
      juice.drawNeonText(ctx, `COMBO x${s.comboCount}`, cx, 95, COLORS.gold, 18);
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }, [phase, sounds, spawnParticles, haptics, juice]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.weight = 0;
      s.timeLeft = GAME_DURATION;
      s.lastSpawnTime = 0;
      s.spawnInterval = SPAWN_INTERVAL_BASE;
      s.speedMultiplier = 1;
      s.milestoneHit = [false, false, false];
      s.flashAlpha = 0;
      s.comboCount = 0;
      s.lastCatchTime = 0;
      s.birdMouthOpen = 0;
      for (const item of s.items) item.active = false;
      for (const p of s.particles) p.active = false;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const reachedGoal = displayScore >= GOAL_WEIGHT;

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
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16,
            textShadow: '0 0 20px rgba(255,255,255,0.5), 0 0 40px rgba(255,255,255,0.2)',
          }}>{t(UI_STRINGS.timesUp)}</div>
          <div style={{
            color: reachedGoal ? COLORS.gold : COLORS.mint, fontSize: 20, marginBottom: 8,
            textShadow: reachedGoal
              ? '0 0 15px rgba(245,166,35,0.7), 0 0 30px rgba(245,166,35,0.3)'
              : '0 0 15px rgba(46,234,163,0.7), 0 0 30px rgba(46,234,163,0.3)',
          }}>
            {reachedGoal ? 'Goal reached!' : `${Math.floor(displayScore / BODY_WEIGHT)}x body weight`}
          </div>
          <div style={{
            color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4,
            textShadow: '0 0 20px rgba(255,255,255,0.6), 0 0 40px rgba(46,234,163,0.4)',
          }}>
            {displayScore}g
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 4, fontFamily: FONT_FAMILY }}>
            / {GOAL_WEIGHT}g
          </div>
          <div style={{
            color: COLORS.cyan, fontSize: 16, marginBottom: 24,
            textShadow: '0 0 10px rgba(0,188,212,0.5)',
            fontFamily: FONT_FAMILY,
          }}>
            {Math.floor(displayScore / BODY_WEIGHT)}x / 300x
          </div>
          <button onClick={() => { sounds.pop(); haptics.tapFeedback(); onComplete(displayScore); }} style={{
            background: 'linear-gradient(135deg, #2EEAA3 0%, #00BCD4 100%)',
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: '0 0 20px rgba(46,234,163,0.4), 0 0 40px rgba(46,234,163,0.15)',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            transition: 'transform 0.15s ease, box-shadow 0.15s ease',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={() => { sounds.tick(); haptics.tapFeedback(); onBack(); }} style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.04) 100%)',
            color: COLORS.gray, border: `1px solid rgba(255,255,255,0.15)`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            textShadow: '0 0 8px rgba(255,255,255,0.2)',
            transition: 'transform 0.15s ease, border-color 0.15s ease',
          }}>{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => { haptics.tapFeedback(); onBack(); }} style={{
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
