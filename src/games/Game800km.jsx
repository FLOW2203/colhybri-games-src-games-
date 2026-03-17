import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';

const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";
const GAME_DURATION = 60;
const GOAL_KM = 800;
const FAT_MAX = 2.0;
const FAT_DRAIN_BASE = 0.04;
const FAT_PER_INSECT = 0.12;
const POOL_SIZE = 100;

export default function Game800km({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION,
    distance: 0,
    fat: FAT_MAX,
    speed: 1.0,
    birdY: 0,
    birdTargetY: 0,
    birdLane: 1,
    score: 0,
    won: false,
    insects: Array(8).fill(null).map(() => ({
      active: false, x: 0, y: 0, size: 0, speed: 0,
      wingAngle: 0, type: 0,
    })),
    windGusts: Array(4).fill(null).map(() => ({
      active: false, x: 0, y: 0, w: 0, h: 0, speed: 0,
      warningTime: 0, alpha: 0,
    })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    clouds: Array(6).fill(null).map(() => ({
      x: Math.random() * 1200,
      y: 30 + Math.random() * 120,
      w: 50 + Math.random() * 100,
      speed: 30 + Math.random() * 50,
      alpha: 0.15 + Math.random() * 0.2,
    })),
    waves: Array(5).fill(null).map((_, i) => ({
      offset: i * 80,
      amplitude: 3 + Math.random() * 4,
      speed: 0.5 + Math.random() * 1,
    })),
    insectSpawnTimer: 0,
    gustSpawnTimer: 0,
    scrollOffset: 0,
    flashAlpha: 0,
    feedbackText: '',
    feedbackTimer: 0,
    dodgeFlash: 0,
    lastGustHitTime: 0,
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
        const speed = 30 + Math.random() * 100;
        p.vx = Math.cos(angle) * speed - 30;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 1.5 + Math.random() * 3;
        spawned++;
      }
    }
  }, []);

  const spawnInsect = useCallback((w, h) => {
    const s = state.current;
    for (let i = 0; i < s.insects.length; i++) {
      const ins = s.insects[i];
      if (!ins.active) {
        ins.active = true;
        ins.x = w + 30;
        const skyHeight = h * 0.55;
        const skyTop = h * 0.08;
        const laneH = skyHeight / 3;
        const lane = Math.floor(Math.random() * 3);
        ins.y = skyTop + laneH * lane + laneH * 0.5 + (Math.random() - 0.5) * 30;
        ins.size = 5 + Math.random() * 4;
        ins.speed = 100 + Math.random() * 80 + s.speed * 30;
        ins.wingAngle = Math.random() * Math.PI;
        ins.type = Math.floor(Math.random() * 3);
        break;
      }
    }
  }, []);

  const spawnGust = useCallback((w, h) => {
    const s = state.current;
    for (let i = 0; i < s.windGusts.length; i++) {
      const g = s.windGusts[i];
      if (!g.active) {
        g.active = true;
        g.x = w + 10;
        const skyHeight = h * 0.55;
        const skyTop = h * 0.08;
        const laneH = skyHeight / 3;
        const lane = Math.floor(Math.random() * 3);
        g.y = skyTop + laneH * lane;
        g.w = 80 + Math.random() * 60;
        g.h = laneH * 0.8;
        g.speed = 120 + s.speed * 40;
        g.warningTime = 1.0;
        g.alpha = 0;
        break;
      }
    }
  }, []);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        haptics.tapFeedback();
        sounds.countdown(true);
      }
      return;
    }
    const s = state.current;

    // Check if tapped on or near an insect
    let nearest = null;
    let nearDist = 55;
    for (const ins of s.insects) {
      if (!ins.active) continue;
      const dx = x - ins.x;
      const dy = y - ins.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < nearDist) {
        nearDist = d;
        nearest = ins;
      }
    }
    if (nearest) {
      nearest.active = false;
      s.fat = Math.min(FAT_MAX, s.fat + FAT_PER_INSECT);
      spawnParticles(nearest.x, nearest.y, 12, 100, 255, 100);
      s.feedbackText = `+${FAT_PER_INSECT.toFixed(2)}g`;
      s.feedbackTimer = 0.5;
      sounds.pop();
      haptics.tapFeedback();
      juice.flash('#22C55E', 0.15);
    } else {
      haptics.tapFeedback();
    }
  }, [phase, sounds, haptics, juice, spawnParticles]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    const s = state.current;
    if (direction === 'up') {
      s.birdLane = Math.max(0, s.birdLane - 1);
      sounds.wingflap();
      haptics.tapFeedback();
    } else if (direction === 'down') {
      s.birdLane = Math.min(2, s.birdLane + 1);
      sounds.wingflap();
      haptics.tapFeedback();
    }
  }, [phase, sounds, haptics]);

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

    // Apply juice updates
    juice.update(delta);

    const s = state.current;
    const cx = w / 2;
    const cy = h / 2;

    if (phase === 'ready') {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#1a3050');
      bgGrad.addColorStop(0.4, '#4a90b8');
      bgGrad.addColorStop(0.55, '#2a6090');
      bgGrad.addColorStop(1, '#0a2040');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Horizon line
      ctx.strokeStyle = 'rgba(255,255,255,0.1)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, h * 0.55);
      ctx.lineTo(w, h * 0.55);
      ctx.stroke();

      // Title with neon glow
      juice.drawNeonText(ctx, t(GAME_NAMES['04']), cx, cy - 90, COLORS.cyan, 26);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('Cross the Gulf of Mexico', cx, cy - 50);
      ctx.fillText('with only 2g of fat!', cx, cy - 26);
      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Tap insects for fuel, swipe to dodge wind', cx, cy + 30);

      // Pulsing TAP TO START with neon
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, cy + 90, COLORS.mint, 20);
      ctx.globalAlpha = 1;

      // Glow on title
      juice.drawGlow(ctx, cx, cy - 90, 80, COLORS.cyan, 0.15);

      ctx.restore();
      return;
    }

    // Apply shake before drawing
    juice.applyShake(ctx);

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);

    // Speed ramp
    s.speed = 1.0 + elapsed / GAME_DURATION * 2;

    // Distance
    s.distance += s.speed * 13.3 * delta;

    // Fat drain
    s.fat -= FAT_DRAIN_BASE * s.speed * delta;

    // Bird lane position
    const skyHeight = h * 0.55;
    const skyTop = h * 0.08;
    const laneH = skyHeight / 3;
    s.birdTargetY = skyTop + laneH * s.birdLane + laneH * 0.5;
    s.birdY += (s.birdTargetY - s.birdY) * delta * 8;

    // Scroll
    s.scrollOffset += s.speed * 100 * delta;

    // Spawn insects
    s.insectSpawnTimer -= delta;
    if (s.insectSpawnTimer <= 0) {
      spawnInsect(w, h);
      s.insectSpawnTimer = 0.8 + Math.random() * 1.2 / s.speed;
    }

    // Spawn gusts
    s.gustSpawnTimer -= delta;
    if (s.gustSpawnTimer <= 0 && elapsed > 5) {
      spawnGust(w, h);
      s.gustSpawnTimer = 2.5 + Math.random() * 2 / s.speed;
    }

    // Update insects
    for (const ins of s.insects) {
      if (!ins.active) continue;
      ins.x -= ins.speed * delta;
      ins.wingAngle += delta * 20;
      if (ins.x < -30) ins.active = false;
    }

    // Update wind gusts
    for (const g of s.windGusts) {
      if (!g.active) continue;
      if (g.warningTime > 0) {
        g.warningTime -= delta;
        g.alpha = Math.min(0.3, (1 - g.warningTime) * 0.3);
        if (g.warningTime <= 0) {
          g.alpha = 0.5;
        }
      } else {
        g.x -= g.speed * delta;
        if (g.x + g.w < -10) g.active = false;

        // Collision with bird
        const birdX = 70;
        const birdSize = 20;
        if (g.x < birdX + birdSize && g.x + g.w > birdX - birdSize) {
          if (s.birdY > g.y && s.birdY < g.y + g.h) {
            s.fat -= 0.15 * delta;
            s.dodgeFlash = Math.max(s.dodgeFlash, 0.1);
            // Haptic + shake on gust hit (throttled)
            if (elapsed - s.lastGustHitTime > 0.5) {
              s.lastGustHitTime = elapsed;
              haptics.impactFeedback();
              juice.shake(4, 0.2);
              juice.flash('#EF4444', 0.2);
              sounds.impact();
            }
          }
        }
      }
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Clouds
    for (const cloud of s.clouds) {
      cloud.x -= cloud.speed * s.speed * delta;
      if (cloud.x + cloud.w < -20) {
        cloud.x = w + 50;
        cloud.y = 30 + Math.random() * 120;
      }
    }

    if (s.feedbackTimer > 0) s.feedbackTimer -= delta;
    if (s.dodgeFlash > 0) s.dodgeFlash -= delta;
    if (s.flashAlpha > 0) s.flashAlpha -= delta;

    // Low fat warning haptic
    if (s.fat > 0 && s.fat < 0.4 && Math.floor(elapsed * 2) % 2 === 0 && Math.floor((elapsed - delta) * 2) % 2 !== 0) {
      haptics.warningFeedback();
    }

    // Game over conditions
    if (s.fat <= 0 && phase === 'playing') {
      s.fat = 0;
      s.won = false;
      s.score = Math.round(s.distance);
      setPhase('ended');
      setDisplayScore(Math.round(s.distance));
      sounds.fail();
      haptics.failFeedback();
      juice.shake(12, 0.5);
      juice.flash('#EF4444', 0.5);
      return;
    }
    if (s.distance >= GOAL_KM && phase === 'playing') {
      s.won = true;
      s.score = Math.round(s.distance);
      setPhase('ended');
      setDisplayScore(Math.round(s.distance));
      sounds.success();
      haptics.successFeedback();
      juice.flash('#22C55E', 0.4);
      return;
    }
    if (s.timeLeft <= 0 && phase === 'playing') {
      s.won = s.distance >= GOAL_KM;
      s.score = Math.round(s.distance);
      setPhase('ended');
      setDisplayScore(Math.round(s.distance));
      if (s.won) {
        sounds.success();
        haptics.successFeedback();
        juice.flash('#22C55E', 0.4);
      } else {
        sounds.fail();
        haptics.failFeedback();
        juice.shake(10, 0.4);
        juice.flash('#EF4444', 0.4);
      }
      return;
    }

    // --- RENDER ---
    // Sky gradient - changes with time
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
    const timeOfDay = Math.min(1, elapsed / GAME_DURATION);
    const skyR = Math.floor(26 + timeOfDay * 20);
    const skyG = Math.floor(48 + timeOfDay * 30);
    const skyB = Math.floor(80 + timeOfDay * 40);
    skyGrad.addColorStop(0, `rgb(${skyR},${skyG},${skyB})`);
    skyGrad.addColorStop(1, `rgb(${skyR + 40},${skyG + 60},${skyB + 50})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h * 0.65);

    // Ocean
    const oceanY = h * 0.65;
    const oceanGrad = ctx.createLinearGradient(0, oceanY, 0, h);
    oceanGrad.addColorStop(0, '#1a5080');
    oceanGrad.addColorStop(0.3, '#0d3860');
    oceanGrad.addColorStop(1, '#051a30');
    ctx.fillStyle = oceanGrad;
    ctx.fillRect(0, oceanY, w, h - oceanY);

    // Ocean surface shimmer
    ctx.beginPath();
    ctx.moveTo(0, oceanY);
    for (let x = 0; x <= w; x += 3) {
      const y = oceanY + Math.sin((x + s.scrollOffset) * 0.02) * 3
        + Math.sin((x + s.scrollOffset * 0.7) * 0.01) * 2;
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, oceanY + 8);
    ctx.lineTo(0, oceanY + 8);
    ctx.closePath();
    ctx.fillStyle = 'rgba(100,180,255,0.12)';
    ctx.fill();

    // Ocean wave lines
    for (const wave of s.waves) {
      ctx.beginPath();
      const wy = oceanY + 10 + wave.offset * (h - oceanY - 10) / 400;
      for (let x = 0; x <= w; x += 4) {
        const y = wy + Math.sin((x + s.scrollOffset * wave.speed) * 0.015) * wave.amplitude;
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = 'rgba(100,180,255,0.06)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Clouds
    for (const cloud of s.clouds) {
      ctx.beginPath();
      ctx.ellipse(cloud.x, cloud.y, cloud.w, cloud.w * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${cloud.alpha})`;
      ctx.fill();
    }

    // Wind gusts
    for (const g of s.windGusts) {
      if (!g.active) continue;

      // Red warning zone
      ctx.fillStyle = `rgba(239,68,68,${g.alpha * 0.3})`;
      ctx.fillRect(g.x, g.y, g.w, g.h);

      // Border
      ctx.strokeStyle = `rgba(239,68,68,${g.alpha * 0.6})`;
      ctx.lineWidth = 2;
      ctx.strokeRect(g.x, g.y, g.w, g.h);

      // Glow on active gusts
      if (g.warningTime <= 0) {
        juice.drawGlow(ctx, g.x + g.w / 2, g.y + g.h / 2, g.w * 0.6, '#EF4444', g.alpha * 0.2);
      }

      // Wind streaks
      if (g.warningTime <= 0) {
        ctx.strokeStyle = `rgba(255,150,150,${g.alpha * 0.4})`;
        ctx.lineWidth = 1;
        for (let i = 0; i < 5; i++) {
          const ly = g.y + (g.h / 6) * (i + 1);
          ctx.beginPath();
          const sx = g.x + Math.random() * g.w * 0.3;
          ctx.moveTo(sx, ly);
          ctx.lineTo(sx + 20 + Math.random() * 20, ly + (Math.random() - 0.5) * 6);
          ctx.stroke();
        }
      } else {
        // Warning exclamation
        const warnAlpha = 0.5 + Math.sin(elapsed * 10) * 0.5;
        ctx.font = `bold 18px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = `rgba(255,100,100,${warnAlpha})`;
        ctx.fillText('!', g.x + g.w / 2, g.y + g.h / 2 + 6);
      }
    }

    // Insects with glow
    for (const ins of s.insects) {
      if (!ins.active) continue;
      ctx.save();
      ctx.translate(ins.x, ins.y);

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, ins.size, ins.size * 0.5, 0, 0, Math.PI * 2);
      const insColors = ['#4a3a2a', '#2a4a2a', '#3a2a4a'];
      ctx.fillStyle = insColors[ins.type];
      ctx.fill();

      // Wings
      const wAngle = Math.sin(ins.wingAngle) * 0.8;
      ctx.save();
      ctx.rotate(wAngle);
      ctx.beginPath();
      ctx.ellipse(-2, -ins.size, ins.size * 0.6, ins.size * 1.2, -0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,220,255,0.4)';
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.rotate(-wAngle);
      ctx.beginPath();
      ctx.ellipse(2, -ins.size, ins.size * 0.6, ins.size * 1.2, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,220,255,0.4)';
      ctx.fill();
      ctx.restore();

      // Green glow (enhanced with juice.drawGlow)
      const insGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, ins.size * 3);
      insGlow.addColorStop(0, 'rgba(100,255,100,0.15)');
      insGlow.addColorStop(1, 'rgba(100,255,100,0)');
      ctx.fillStyle = insGlow;
      ctx.beginPath();
      ctx.arc(0, 0, ins.size * 3, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // Additive glow via juice
      juice.drawGlow(ctx, ins.x, ins.y, ins.size * 4, '#22C55E', 0.2);
    }

    // Hummingbird
    const birdX = 70;
    ctx.save();
    ctx.translate(birdX, s.birdY);

    // Motion trail
    for (let i = 1; i <= 3; i++) {
      ctx.globalAlpha = 0.08 / i;
      ctx.beginPath();
      ctx.ellipse(-i * 10, 0, 18, 10, 0, 0, Math.PI * 2);
      ctx.fillStyle = COLORS.mint;
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2);
    const birdGrad = ctx.createLinearGradient(-18, -10, 18, 10);
    birdGrad.addColorStop(0, '#2EEAA3');
    birdGrad.addColorStop(1, '#1ab87a');
    ctx.fillStyle = birdGrad;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(20, -3, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(23, -5, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(23.5, -5.5, 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(26, -3);
    ctx.lineTo(38, -1);
    ctx.lineTo(26, 0);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();

    // Wings (fast beating)
    const wingY = Math.sin(elapsed * 40) * 15;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.quadraticCurveTo(-20, -25 + wingY, -30, -10 + wingY * 0.5);
    ctx.quadraticCurveTo(-18, -5, -5, -3);
    ctx.fillStyle = '#5ff5c0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-5, 3);
    ctx.quadraticCurveTo(-20, 25 - wingY, -30, 10 - wingY * 0.5);
    ctx.quadraticCurveTo(-18, 5, -5, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Tail
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-30, -4);
    ctx.lineTo(-28, 0);
    ctx.lineTo(-30, 4);
    ctx.closePath();
    ctx.fillStyle = '#0d6b47';
    ctx.fill();

    ctx.restore();

    // Bird glow
    juice.drawGlow(ctx, birdX, s.birdY, 30, COLORS.mint, 0.2 + Math.sin(elapsed * 3) * 0.05);

    // Particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // Dodge flash
    if (s.dodgeFlash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${s.dodgeFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw juice flash overlay
    juice.drawFlash(ctx, w, h);

    // --- HUD ---
    // Fat gauge
    const gaugeW = 120;
    const gaugeH = 14;
    const gaugeX = 20;
    const gaugeY = 60;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(gaugeX, gaugeY, gaugeW, gaugeH, 7);
    ctx.fill();
    const fatFrac = Math.max(0, s.fat / FAT_MAX);
    const fatColor = s.fat < 0.4 ? COLORS.red : s.fat < 0.8 ? COLORS.gold : COLORS.green;
    ctx.fillStyle = fatColor;
    ctx.beginPath();
    ctx.roundRect(gaugeX, gaugeY, gaugeW * fatFrac, gaugeH, 7);
    ctx.fill();

    // Fat gauge glow when low
    if (s.fat < 0.4) {
      juice.drawGlow(ctx, gaugeX + gaugeW * fatFrac / 2, gaugeY + gaugeH / 2, 30, COLORS.red, 0.2 + Math.sin(elapsed * 6) * 0.1);
    }

    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Fat: ${Math.max(0, s.fat).toFixed(2)}g / ${FAT_MAX}g`, gaugeX, gaugeY - 4);

    // Distance progress bar
    const distFrac = Math.min(1, s.distance / GOAL_KM);
    const distBarW = w - 40;
    const distBarY = h - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.roundRect(20, distBarY, distBarW, 10, 5);
    ctx.fill();
    ctx.fillStyle = COLORS.cyan;
    ctx.beginPath();
    ctx.roundRect(20, distBarY, distBarW * distFrac, 10, 5);
    ctx.fill();

    // Distance bar glow at tip
    const tipX = 20 + distBarW * distFrac;
    juice.drawGlow(ctx, tipX, distBarY + 5, 15, COLORS.cyan, 0.3);

    // Distance labels
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText('0km', 20, distBarY - 4);
    ctx.textAlign = 'right';
    ctx.fillText(`${GOAL_KM}km`, w - 20, distBarY - 4);

    // Distance neon text
    ctx.textAlign = 'center';
    juice.drawNeonText(ctx, `${Math.round(s.distance)}km`, cx, distBarY - 6, COLORS.cyan, 14);

    // Bird marker on distance bar
    const markerX = 20 + distBarW * distFrac;
    ctx.beginPath();
    ctx.arc(markerX, distBarY + 5, 6, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.mint;
    ctx.fill();

    // Feedback text with neon
    if (s.feedbackTimer > 0) {
      const alpha = Math.min(1, s.feedbackTimer * 3);
      ctx.globalAlpha = alpha;
      juice.drawNeonText(ctx, s.feedbackText, cx, cy - 40, COLORS.green, 24);
      ctx.globalAlpha = 1;
    }

    // Timer bar at top
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 10 ? COLORS.red : COLORS.cyan;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer with neon when low
    if (s.timeLeft < 10) {
      juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, COLORS.red, 24);
    } else {
      ctx.font = `bold 24px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.white;
      ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    }

    // Lane indicators on left edge
    for (let lane = 0; lane < 3; lane++) {
      const ly = skyTop + laneH * lane + laneH * 0.5;
      ctx.beginPath();
      ctx.arc(15, ly, lane === s.birdLane ? 5 : 3, 0, Math.PI * 2);
      ctx.fillStyle = lane === s.birdLane ? COLORS.mint : 'rgba(255,255,255,0.2)';
      ctx.fill();
      if (lane === s.birdLane) {
        juice.drawGlow(ctx, 15, ly, 12, COLORS.mint, 0.3);
      }
    }

    // Speed indicator
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText(`Speed x${s.speed.toFixed(1)}`, 20, 84);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, spawnInsect, spawnGust]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.distance = 0;
      s.fat = FAT_MAX;
      s.speed = 1.0;
      s.score = 0;
      s.won = false;
      s.timeLeft = GAME_DURATION;
      s.birdLane = 1;
      s.birdY = window.innerHeight * 0.35;
      s.insectSpawnTimer = 0.5;
      s.gustSpawnTimer = 3;
      s.scrollOffset = 0;
      s.lastGustHitTime = 0;
      for (const ins of s.insects) ins.active = false;
      for (const g of s.windGusts) g.active = false;
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
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 12,
            textShadow: state.current.won
              ? `0 0 20px ${COLORS.mint}, 0 0 40px ${COLORS.mint}80`
              : `0 0 20px ${COLORS.red}, 0 0 40px ${COLORS.red}80`,
          }}>
            {state.current.won ? 'Crossing Complete!' : (state.current.fat <= 0 ? 'Out of Fuel!' : "Time's Up!")}
          </div>
          <div style={{
            color: state.current.won ? COLORS.mint : COLORS.cyan,
            fontSize: 48, fontWeight: 'bold', marginBottom: 8,
            textShadow: state.current.won
              ? `0 0 30px ${COLORS.mint}, 0 0 60px ${COLORS.mint}80`
              : `0 0 30px ${COLORS.cyan}, 0 0 60px ${COLORS.cyan}80`,
          }}>
            {displayScore}km
          </div>
          <div style={{ color: COLORS.gray, fontSize: 16, marginBottom: 4 }}>
            {state.current.won ? 'You made it across!' : `Goal: ${GOAL_KM}km`}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
            Hummingbirds cross 800km on 2g of fat!
          </div>
          <button
            onClick={() => {
              haptics.tapFeedback();
              sounds.chime();
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
              textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            }}
          >Continue</button>
          <button
            onClick={() => {
              haptics.tapFeedback();
              onBack();
            }}
            style={{
              background: 'rgba(255,255,255,0.05)',
              color: COLORS.gray,
              border: `1px solid ${COLORS.gray}50`,
              padding: '10px 30px',
              borderRadius: 12,
              fontSize: 14,
              cursor: 'pointer',
              fontFamily: FONT_FAMILY,
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            }}
          >Back</button>
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
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}
        >Back</button>
      )}
    </div>
  );
}
