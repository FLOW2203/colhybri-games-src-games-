import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';

const GAME_DURATION = 45;
const POOL_SIZE = 100;
const NUM_CHICKS = 3;
const HUNGER_DECAY = 12; // per second
const FEED_AMOUNT = 30;
const MAX_INSECTS = 8;
const INSECT_SPAWN_INTERVAL = 1.2;
const AI_CATCH_INTERVAL = 2.5;

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function GameHelpersNest({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();

  const state = useRef({
    timeLeft: GAME_DURATION,
    totalFed: 0,
    chicks: Array(NUM_CHICKS).fill(null).map((_, i) => ({
      hunger: 80 + Math.random() * 20,
      bounceT: 0,
      mouthOpen: 0,
      x: 0, y: 0,
    })),
    insects: Array(MAX_INSECTS).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, size: 4, wiggle: 0,
    })),
    caughtInsect: null, // { x, y } if player is holding one
    swipeTarget: null,
    spawnTimer: 0,
    aiTimerL: 0,
    aiTimerR: 0,
    adultL: { x: 0, y: 0, targetX: 0, targetY: 0, carrying: false, feedTarget: -1, bobT: 0 },
    adultR: { x: 0, y: 0, targetX: 0, targetY: 0, carrying: false, feedTarget: -1, bobT: 0 },
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    nestX: 0, nestY: 0,
    gameOver: false,
    flashAlpha: 0,
    warningPulse: 0,
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
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 80;
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

  const feedChick = useCallback((chickIdx) => {
    const s = state.current;
    const chick = s.chicks[chickIdx];
    if (!chick) return;
    chick.hunger = Math.min(100, chick.hunger + FEED_AMOUNT);
    chick.bounceT = 0.5;
    s.totalFed++;
    spawnParticles(chick.x, chick.y, 8, [[255, 220, 50], [255, 180, 0], [255, 255, 200]]);
    sounds.chime();
    sounds.pop();
    haptics.impactFeedback();
    juice.flash('#FFD700', 0.3);
    juice.shake(4, 0.15);
  }, [spawnParticles, sounds, haptics, juice]);

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

    // If already carrying, tap on a chick to feed
    if (s.caughtInsect) {
      for (let i = 0; i < s.chicks.length; i++) {
        const ch = s.chicks[i];
        const dx = x - ch.x;
        const dy = y - ch.y;
        if (dx * dx + dy * dy < 45 * 45) {
          feedChick(i);
          s.caughtInsect = null;
          return;
        }
      }
      // Tap elsewhere drops insect
      s.caughtInsect = null;
      sounds.drop();
      haptics.tapFeedback();
      return;
    }

    // Try to catch an insect in center zone
    const w = window.innerWidth;
    const zoneLeft = w * 0.3;
    const zoneRight = w * 0.7;
    for (let i = 0; i < s.insects.length; i++) {
      const ins = s.insects[i];
      if (!ins.active) continue;
      if (ins.x < zoneLeft || ins.x > zoneRight) continue;
      const dx = x - ins.x;
      const dy = y - ins.y;
      if (dx * dx + dy * dy < 40 * 40) {
        ins.active = false;
        s.caughtInsect = { x: ins.x, y: ins.y };
        sounds.tick();
        sounds.pop();
        haptics.tapFeedback();
        juice.shake(2, 0.1);
        spawnParticles(ins.x, ins.y, 5, [[100, 200, 100], [50, 150, 50]]);
        return;
      }
    }
  }, [phase, feedChick, sounds, spawnParticles, haptics, juice]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    const s = state.current;
    if (!s.caughtInsect) return;

    // Swipe toward a chick: left=chick0, up=chick1, right=chick2
    let idx = -1;
    if (direction === 'left') idx = 0;
    else if (direction === 'up') idx = 1;
    else if (direction === 'right') idx = 2;

    if (idx >= 0) {
      feedChick(idx);
      s.caughtInsect = null;
      sounds.whoosh();
    }
  }, [phase, feedChick, sounds]);

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
    const cy = h / 2;
    s.nestX = cx;
    s.nestY = cy + 40;

    // Chick positions around nest
    const chickSpacing = 50;
    s.chicks[0].x = cx - chickSpacing;
    s.chicks[0].y = s.nestY - 10;
    s.chicks[1].x = cx;
    s.chicks[1].y = s.nestY - 30;
    s.chicks[2].x = cx + chickSpacing;
    s.chicks[2].y = s.nestY - 10;

    if (phase === 'ready') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1a5c3a');
      skyGrad.addColorStop(0.6, '#2d8a5e');
      skyGrad.addColorStop(1, '#4aba7a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, 'Helpers at the Nest', cx, cy - 60, '#2EEAA3', 28);

      // Glow behind title
      juice.drawGlow(ctx, cx, cy - 60, 120, '#2EEAA3', 0.15);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 8;
      ctx.fillText('Toucans cooperate to raise chicks!', cx, cy - 10);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('TAP insects to catch, SWIPE to feed chicks', cx, cy + 30);
      ctx.fillText('Keep all 3 chicks fed for 45 seconds', cx, cy + 55);

      // Pulsing "TAP TO START" with neon
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, 'TAP TO START', cx, cy + 110, '#00D4FF', 20);
      ctx.globalAlpha = 1;

      // Glow pulse on start prompt
      juice.drawGlow(ctx, cx, cy + 110, 60 + Math.sin(elapsed * 4) * 20, '#00D4FF', 0.1 * tapAlpha);

      ctx.restore();
      return;
    }

    // --- UPDATE ---
    juice.update(delta);
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);

    // Warning pulse for low time
    if (s.timeLeft < 10 && s.timeLeft > 0) {
      s.warningPulse += delta * 6;
    }

    // Low time warning haptic
    if (s.timeLeft < 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      haptics.warningFeedback();
      sounds.countdown(false);
    }

    // Hunger decay
    let anyDead = false;
    for (const ch of s.chicks) {
      ch.hunger -= HUNGER_DECAY * delta;
      if (ch.hunger <= 0) { ch.hunger = 0; anyDead = true; }
      ch.mouthOpen = Math.max(0, 1 - ch.hunger / 100);
      if (ch.bounceT > 0) ch.bounceT -= delta * 2;
    }

    // Game over check
    if ((anyDead || s.timeLeft <= 0) && phase === 'playing') {
      s.gameOver = anyDead;
      const surviving = s.chicks.filter(c => c.hunger > 0).length;
      const score = s.totalFed * surviving;
      setPhase('ended');
      setDisplayScore(score);

      if (anyDead) {
        sounds.fail();
        haptics.failFeedback();
        juice.shake(12, 0.5);
        juice.flash('#EF4444', 0.5);
      } else {
        sounds.success();
        haptics.successFeedback();
        juice.flash('#22C55E', 0.4);
      }

      ctx.restore();
      return;
    }

    // Spawn insects
    s.spawnTimer += delta;
    if (s.spawnTimer >= INSECT_SPAWN_INTERVAL) {
      s.spawnTimer = 0;
      for (let i = 0; i < s.insects.length; i++) {
        const ins = s.insects[i];
        if (!ins.active) {
          ins.active = true;
          ins.x = 30 + Math.random() * (w - 60);
          ins.y = 60 + Math.random() * (h * 0.4);
          ins.vx = (Math.random() - 0.5) * 60;
          ins.vy = (Math.random() - 0.5) * 40;
          ins.wiggle = Math.random() * Math.PI * 2;
          break;
        }
      }
    }

    // Update insects
    for (const ins of s.insects) {
      if (!ins.active) continue;
      ins.wiggle += delta * 8;
      ins.x += ins.vx * delta + Math.sin(ins.wiggle) * 0.8;
      ins.y += ins.vy * delta + Math.cos(ins.wiggle * 0.7) * 0.5;
      if (ins.x < 10 || ins.x > w - 10) ins.vx *= -1;
      if (ins.y < 40 || ins.y > h * 0.5) ins.vy *= -1;
      ins.x = Math.max(10, Math.min(w - 10, ins.x));
      ins.y = Math.max(40, Math.min(h * 0.5, ins.y));
    }

    // AI adult toucans
    const updateAdult = (adult, zoneLeft, zoneRight, timerKey) => {
      adult.bobT += delta * 3;
      s[timerKey] += delta;
      if (!adult.carrying) {
        // Look for insect in zone
        if (s[timerKey] >= AI_CATCH_INTERVAL) {
          for (let i = 0; i < s.insects.length; i++) {
            const ins = s.insects[i];
            if (!ins.active) continue;
            if (ins.x >= zoneLeft && ins.x <= zoneRight) {
              ins.active = false;
              adult.carrying = true;
              adult.feedTarget = s.chicks.reduce((best, ch, idx) =>
                ch.hunger < s.chicks[best].hunger ? idx : best, 0);
              s[timerKey] = 0;
              spawnParticles(ins.x, ins.y, 3, [[100, 200, 100]]);
              sounds.wingflap();
              break;
            }
          }
        }
        adult.targetX = (zoneLeft + zoneRight) / 2;
        adult.targetY = h * 0.3;
      } else {
        // Move toward target chick
        const target = s.chicks[adult.feedTarget];
        adult.targetX = target.x;
        adult.targetY = target.y - 20;
        const dx = adult.targetX - adult.x;
        const dy = adult.targetY - adult.y;
        if (dx * dx + dy * dy < 25 * 25) {
          feedChick(adult.feedTarget);
          adult.carrying = false;
        }
      }
      adult.x += (adult.targetX - adult.x) * delta * 3;
      adult.y += (adult.targetY - adult.y) * delta * 3;
    };

    s.adultL.x = s.adultL.x || w * 0.15;
    s.adultL.y = s.adultL.y || h * 0.3;
    s.adultR.x = s.adultR.x || w * 0.85;
    s.adultR.y = s.adultR.y || h * 0.3;
    updateAdult(s.adultL, 0, w * 0.3, 'aiTimerL');
    updateAdult(s.adultR, w * 0.7, w, 'aiTimerR');

    // Flash decay
    s.flashAlpha *= Math.pow(0.01, delta);

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 30 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // --- RENDER ---
    // Apply shake before drawing
    juice.applyShake(ctx);

    // Forest background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#1a5c3a');
    skyGrad.addColorStop(0.4, '#2d8a5e');
    skyGrad.addColorStop(0.7, '#3da06a');
    skyGrad.addColorStop(1, '#2a6b44');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Background leaves
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 12; i++) {
      const lx = (i * 73 + 20) % w;
      const ly = (i * 47 + 10) % (h * 0.5);
      ctx.beginPath();
      ctx.ellipse(lx, ly, 30 + i * 3, 12, (i * 0.5), 0, Math.PI * 2);
      ctx.fillStyle = '#1a4a2a';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Zone indicators
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, 0, w * 0.3, h);
    ctx.fillRect(w * 0.7, 0, w * 0.3, h);

    // Nest glow
    juice.drawGlow(ctx, s.nestX, s.nestY, 100, '#7a4e2a', 0.15);

    // Nest (brown oval with twigs)
    ctx.beginPath();
    ctx.ellipse(s.nestX, s.nestY + 15, 90, 35, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#5c3a1e';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(s.nestX, s.nestY, 85, 30, 0, 0, Math.PI);
    ctx.fillStyle = '#7a4e2a';
    ctx.fill();
    // Twig details
    ctx.strokeStyle = '#4a2e14';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      ctx.beginPath();
      const tx = s.nestX - 70 + i * 28;
      ctx.moveTo(tx, s.nestY + 10);
      ctx.lineTo(tx + 15 + Math.random() * 10, s.nestY + 20);
      ctx.stroke();
    }

    // Draw chicks
    for (let i = 0; i < s.chicks.length; i++) {
      const ch = s.chicks[i];
      const bounce = ch.bounceT > 0 ? Math.sin(ch.bounceT * Math.PI * 6) * 8 : 0;
      const chickY = ch.y - bounce;

      // Glow around hungry chicks (warning)
      if (ch.hunger < 30 && ch.hunger > 0) {
        const pulseAlpha = 0.15 + Math.sin(elapsed * 8) * 0.1;
        juice.drawGlow(ctx, ch.x, chickY, 35, '#EF4444', pulseAlpha);
      }

      // Glow when recently fed (bounce active)
      if (ch.bounceT > 0) {
        juice.drawGlow(ctx, ch.x, chickY, 30, '#FFD700', 0.3 * ch.bounceT);
      }

      // Body (yellow circle)
      ctx.beginPath();
      ctx.arc(ch.x, chickY, 16, 0, Math.PI * 2);
      ctx.fillStyle = ch.hunger > 0 ? '#FFD700' : '#888';
      ctx.fill();
      ctx.strokeStyle = '#DAA520';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Eyes
      ctx.beginPath();
      ctx.arc(ch.x - 5, chickY - 4, 3, 0, Math.PI * 2);
      ctx.arc(ch.x + 5, chickY - 4, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      // Beak (opens wider when hungrier)
      const mouthSize = 4 + ch.mouthOpen * 8;
      ctx.beginPath();
      ctx.moveTo(ch.x - 5, chickY + 3);
      ctx.lineTo(ch.x, chickY + 3 + mouthSize);
      ctx.lineTo(ch.x + 5, chickY + 3);
      ctx.closePath();
      ctx.fillStyle = '#FF6600';
      ctx.fill();
      // Upper beak
      ctx.beginPath();
      ctx.moveTo(ch.x - 5, chickY + 3);
      ctx.lineTo(ch.x, chickY + 3 - 3);
      ctx.lineTo(ch.x + 5, chickY + 3);
      ctx.closePath();
      ctx.fillStyle = '#FF8800';
      ctx.fill();

      // Hunger bar below chick
      const barW = 36;
      const barH = 5;
      const barX = ch.x - barW / 2;
      const barY = chickY + 25;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, barY, barW, barH);
      const frac = ch.hunger / 100;
      const barColor = frac > 0.4 ? COLORS.green : frac > 0.2 ? COLORS.gold : COLORS.red;
      ctx.fillStyle = barColor;
      ctx.fillRect(barX, barY, barW * frac, barH);

      // Hunger bar glow for low hunger
      if (frac <= 0.2 && ch.hunger > 0) {
        ctx.save();
        ctx.shadowColor = COLORS.red;
        ctx.shadowBlur = 6;
        ctx.fillStyle = COLORS.red;
        ctx.fillRect(barX, barY, barW * frac, barH);
        ctx.restore();
      }
    }

    // Draw insects with glow
    for (const ins of s.insects) {
      if (!ins.active) continue;

      // Subtle glow around insects
      juice.drawGlow(ctx, ins.x, ins.y, 15, '#88FF88', 0.2);

      ctx.beginPath();
      ctx.arc(ins.x, ins.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
      // Wings
      ctx.beginPath();
      ctx.ellipse(ins.x - 4, ins.y - 3, 4, 2, -0.3, 0, Math.PI * 2);
      ctx.ellipse(ins.x + 4, ins.y - 3, 4, 2, 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(200,200,255,0.5)';
      ctx.fill();
    }

    // Draw adult toucans
    const drawToucan = (adult, flipX) => {
      ctx.save();
      ctx.translate(adult.x, adult.y + Math.sin(adult.bobT) * 4);
      if (flipX) ctx.scale(-1, 1);

      // Body
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 14, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();

      // Chest
      ctx.beginPath();
      ctx.ellipse(4, 4, 10, 9, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#FFD700';
      ctx.fill();

      // Head
      ctx.beginPath();
      ctx.arc(20, -4, 10, 0, Math.PI * 2);
      ctx.fillStyle = '#1a1a1a';
      ctx.fill();

      // Eye
      ctx.beginPath();
      ctx.arc(23, -6, 3, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(24, -6, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();

      // Beak (colorful toucan beak)
      ctx.beginPath();
      ctx.moveTo(28, -6);
      ctx.lineTo(50, -2);
      ctx.lineTo(28, 2);
      ctx.closePath();
      const beakGrad = ctx.createLinearGradient(28, -6, 50, 2);
      beakGrad.addColorStop(0, '#FF6600');
      beakGrad.addColorStop(0.5, '#FFD700');
      beakGrad.addColorStop(1, '#FF4400');
      ctx.fillStyle = beakGrad;
      ctx.fill();

      // Carrying indicator with glow
      if (adult.carrying) {
        ctx.beginPath();
        ctx.arc(45, -1, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a2a';
        ctx.fill();
        // Glow around carried insect
        ctx.save();
        ctx.globalAlpha = 0.4;
        ctx.globalCompositeOperation = 'lighter';
        const cGrad = ctx.createRadialGradient(45, -1, 0, 45, -1, 12);
        cGrad.addColorStop(0, '#88FF88');
        cGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = cGrad;
        ctx.beginPath();
        ctx.arc(45, -1, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    };

    drawToucan(s.adultL, false);
    drawToucan(s.adultR, true);

    // Caught insect indicator (follows near center) with glow
    if (s.caughtInsect) {
      // Glow ring around caught insect
      juice.drawGlow(ctx, cx, s.nestY - 80, 25, COLORS.gold, 0.3 + Math.sin(elapsed * 6) * 0.1);

      ctx.beginPath();
      ctx.arc(cx, s.nestY - 80, 8, 0, Math.PI * 2);
      ctx.fillStyle = '#2a2a2a';
      ctx.fill();
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Neon swipe instruction
      juice.drawNeonText(ctx, 'Swipe to feed!', cx, s.nestY - 100, COLORS.gold, 13);
    }

    // Flash effect (original)
    if (s.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(255,220,50,${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay
    juice.drawFlash(ctx, w, h);

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

    // HUD - Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.mint;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer bar glow when low
    if (s.timeLeft < 10) {
      ctx.save();
      ctx.shadowColor = COLORS.red;
      ctx.shadowBlur = 8 + Math.sin(s.warningPulse) * 4;
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(0, 0, w * timerFrac, 4);
      ctx.restore();
    }

    // Timer text with neon
    if (s.timeLeft < 5) {
      juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, COLORS.red, 24);
    } else {
      ctx.save();
      ctx.font = `bold 24px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.white;
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 6;
      ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
      ctx.restore();
    }

    // Score with neon text
    juice.drawNeonText(ctx, `Fed: ${s.totalFed}`, 55, 40, COLORS.gold, 16);

    // Zone labels
    ctx.font = `11px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('Adult L', w * 0.15, h - 20);
    ctx.fillText('You', cx, h - 20);
    ctx.fillText('Adult R', w * 0.85, h - 20);

    ctx.restore();
  }, [phase, sounds, spawnParticles, feedChick, juice, haptics]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.totalFed = 0;
      s.timeLeft = GAME_DURATION;
      s.spawnTimer = 0;
      s.aiTimerL = 0;
      s.aiTimerR = 0;
      s.caughtInsect = null;
      s.gameOver = false;
      s.flashAlpha = 0;
      s.warningPulse = 0;
      for (const ch of s.chicks) {
        ch.hunger = 80 + Math.random() * 20;
        ch.bounceT = 0;
      }
      for (const ins of s.insects) ins.active = false;
      for (const p of s.particles) p.active = false;
      s.adultL.carrying = false;
      s.adultR.carrying = false;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const surviving = phase === 'ended' ? state.current.chicks.filter(c => c.hunger > 0).length : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: state.current.gameOver ? COLORS.red : COLORS.mint,
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 16,
            textShadow: state.current.gameOver
              ? `0 0 20px ${COLORS.red}, 0 0 40px ${COLORS.red}80`
              : `0 0 20px ${COLORS.mint}, 0 0 40px ${COLORS.mint}80`,
            fontFamily: FONT_FAMILY,
          }}>
            {state.current.gameOver ? 'A chick starved!' : 'Time\'s Up!'}
          </div>
          <div style={{
            color: COLORS.gold,
            fontSize: 20,
            marginBottom: 8,
            textShadow: `0 0 10px ${COLORS.gold}80`,
            fontFamily: FONT_FAMILY,
          }}>
            Food delivered: {state.current.totalFed}
          </div>
          <div style={{
            color: COLORS.mint,
            fontSize: 18,
            marginBottom: 8,
            textShadow: `0 0 10px ${COLORS.mint}80`,
            fontFamily: FONT_FAMILY,
          }}>
            Chicks surviving: {surviving} / {NUM_CHICKS}
          </div>
          <div style={{
            color: COLORS.white,
            fontSize: 52,
            fontWeight: 'bold',
            marginBottom: 4,
            textShadow: `0 0 30px ${COLORS.cyan}, 0 0 60px ${COLORS.cyan}60`,
            fontFamily: FONT_FAMILY,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray,
            fontSize: 14,
            marginBottom: 28,
            textTransform: 'uppercase',
            letterSpacing: 3,
            fontFamily: FONT_FAMILY,
          }}>
            points
          </div>
          <button onClick={() => {
            sounds.success();
            haptics.tapFeedback();
            onComplete(displayScore);
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.mint})`,
            color: COLORS.primary,
            border: 'none',
            padding: '14px 44px',
            borderRadius: 14,
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.cyan}60, 0 4px 15px rgba(0,0,0,0.3)`,
            textShadow: 'none',
            letterSpacing: 0.5,
          }}>Continue</button>
          <button onClick={() => {
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.06)',
            color: COLORS.gray,
            border: `1px solid ${COLORS.gray}50`,
            padding: '10px 32px',
            borderRadius: 14,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            letterSpacing: 0.5,
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
          fontSize: 14, cursor: 'pointer', zIndex: 10,
          fontFamily: FONT_FAMILY,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
        }}>Back</button>
      )}
    </div>
  );
}
