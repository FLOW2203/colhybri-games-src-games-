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
const SCROLL_SPEED = 120;
const NUM_LANES = 3;
const LANE_Y_OFFSET = 0.35;
const LANE_SPACING = 0.18;
const MAX_SPOTS = 12;
const MAX_SEEDS = 20;
const MAX_TREES = 30;
const SEED_GRAVITY = 280;
const SPOT_SPAWN_INTERVAL = 0.8;
const WIND_CHANGE_INTERVAL = 3;

const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";

export default function GameSuperDisperseur({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION,
    seedsLeft: MAX_SEEDS,
    seedsDropped: 0,
    seedsHit: 0,
    lane: 1, // 0=top, 1=mid, 2=bottom
    targetLaneY: 0,
    toucanX: 0,
    toucanY: 0,
    toucanBobT: 0,
    windX: 0, // -1 to 1
    windTimer: 0,
    scrollX: 0,
    spotTimer: 0,
    spots: Array(MAX_SPOTS).fill(null).map(() => ({
      active: false, x: 0, y: 0, radius: 0, bonus: false, hit: false,
    })),
    seeds: Array(MAX_SEEDS).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, landed: false,
    })),
    trees: Array(MAX_TREES).fill(null).map(() => ({
      active: false, x: 0, y: 0, growth: 0, maxGrowth: 1, growing: false,
    })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    bgTrees: Array(10).fill(null).map((_, i) => ({
      x: i * 120 + Math.random() * 60,
      h: 60 + Math.random() * 80,
      w: 20 + Math.random() * 15,
    })),
    groundY: 0,
    flashAlpha: 0,
    lastWarningSecond: -1,
  });

  const spawnParticles = useCallback((cx, cy, count, colors) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 16;
        p.y = cy + (Math.random() - 0.5) * 16;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.2;
        const speed = 30 + Math.random() * 70;
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

  const getLaneY = useCallback((lane, h) => {
    return h * (LANE_Y_OFFSET + lane * LANE_SPACING);
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
    if (s.seedsLeft <= 0) return;

    // Drop a seed
    for (let i = 0; i < s.seeds.length; i++) {
      const seed = s.seeds[i];
      if (!seed.active) {
        seed.active = true;
        seed.x = s.toucanX + 20;
        seed.y = s.toucanY + 15;
        seed.vx = SCROLL_SPEED * 0.3 + s.windX * 60;
        seed.vy = 20;
        seed.landed = false;
        s.seedsLeft--;
        s.seedsDropped++;
        sounds.drop();
        haptics.tapFeedback();
        break;
      }
    }
  }, [phase, sounds, haptics]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    const s = state.current;
    if (direction === 'up' && s.lane > 0) {
      s.lane--;
      sounds.wingflap();
      haptics.tapFeedback();
    } else if (direction === 'down' && s.lane < NUM_LANES - 1) {
      s.lane++;
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

    const s = state.current;
    s.groundY = h * 0.78;

    // Update juice system
    juice.update(delta);

    if (phase === 'ready') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#2a7ab5');
      skyGrad.addColorStop(0.6, '#5cb8e0');
      skyGrad.addColorStop(1, '#3da06a');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      const cx = w / 2;
      const cy = h / 2;

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['22']), cx, cy - 60, COLORS.mint, 28);

      // Subtitle with glow
      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.gold;
      ctx.shadowBlur = 12;
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('Toucans disperse seeds across the forest!', cx, cy - 10);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('TAP to drop seeds on fertile spots', cx, cy + 30);
      ctx.fillText('SWIPE UP/DOWN to change altitude', cx, cy + 55);

      // Pulsing "TAP TO START" with neon effect
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, cy + 110, COLORS.cyan, 20);
      ctx.globalAlpha = 1;

      ctx.restore();
      return;
    }

    // --- UPDATE ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.scrollX += SCROLL_SPEED * delta;
    s.toucanBobT += delta * 4;

    // Low time warning haptics
    if (s.timeLeft <= 5 && s.timeLeft > 0) {
      const currentSecond = Math.ceil(s.timeLeft);
      if (currentSecond !== s.lastWarningSecond) {
        s.lastWarningSecond = currentSecond;
        haptics.warningFeedback();
        sounds.countdown(false);
      }
    }

    // Toucan position
    const targetY = getLaneY(s.lane, h);
    s.targetLaneY = targetY;
    s.toucanY += (targetY - s.toucanY) * delta * 8;
    s.toucanX = w * 0.2;

    // Wind changes
    s.windTimer += delta;
    if (s.windTimer >= WIND_CHANGE_INTERVAL) {
      s.windTimer = 0;
      s.windX = (Math.random() - 0.5) * 2;
    }

    // Spawn fertile spots
    s.spotTimer += delta;
    if (s.spotTimer >= SPOT_SPAWN_INTERVAL) {
      s.spotTimer = 0;
      for (let i = 0; i < s.spots.length; i++) {
        const spot = s.spots[i];
        if (!spot.active) {
          spot.active = true;
          spot.x = w + 30 + Math.random() * 60;
          spot.y = s.groundY + 5;
          spot.bonus = Math.random() < 0.25;
          spot.radius = spot.bonus ? 14 : 22 + Math.random() * 12;
          spot.hit = false;
          break;
        }
      }
    }

    // Update spots (scroll left)
    for (const spot of s.spots) {
      if (!spot.active) continue;
      spot.x -= SCROLL_SPEED * delta;
      if (spot.x < -40) spot.active = false;
    }

    // Update seeds
    for (const seed of s.seeds) {
      if (!seed.active || seed.landed) continue;
      seed.x += seed.vx * delta;
      seed.vy += SEED_GRAVITY * delta;
      seed.y += seed.vy * delta;
      seed.vx += s.windX * 30 * delta;

      // Check landing
      if (seed.y >= s.groundY) {
        seed.y = s.groundY;
        seed.landed = true;

        // Check fertile spots
        let hitSpot = false;
        for (const spot of s.spots) {
          if (!spot.active || spot.hit) continue;
          const dx = seed.x - spot.x;
          if (Math.abs(dx) < spot.radius) {
            spot.hit = true;
            hitSpot = true;
            s.seedsHit++;
            const pts = spot.bonus ? 3 : 1;

            // Spawn tree
            for (let t = 0; t < s.trees.length; t++) {
              const tree = s.trees[t];
              if (!tree.active) {
                tree.active = true;
                tree.x = seed.x;
                tree.y = s.groundY;
                tree.growth = 0;
                tree.maxGrowth = 1;
                tree.growing = true;
                break;
              }
            }
            spawnParticles(seed.x, s.groundY, 12, [
              [46, 234, 163], [34, 197, 94], [255, 220, 50],
            ]);
            sounds.chime();
            haptics.impactFeedback();
            juice.shake(spot.bonus ? 8 : 4, 0.2);
            juice.flash(spot.bonus ? COLORS.gold : '#2EEAA3', spot.bonus ? 0.4 : 0.2);
            s.flashAlpha = 0.15;
            break;
          }
        }
        if (!hitSpot) {
          spawnParticles(seed.x, s.groundY, 3, [[139, 90, 43], [101, 67, 33]]);
          sounds.impact();
          juice.shake(2, 0.1);
        }
      }
    }

    // Update trees
    for (const tree of s.trees) {
      if (!tree.active || !tree.growing) continue;
      tree.growth += delta * 1.5;
      if (tree.growth >= tree.maxGrowth) {
        tree.growth = tree.maxGrowth;
        tree.growing = false;
      }
      // Scroll trees
      tree.x -= SCROLL_SPEED * delta;
      if (tree.x < -30) tree.active = false;
    }

    // Background trees scroll
    for (const bt of s.bgTrees) {
      bt.x -= SCROLL_SPEED * 0.3 * delta;
      if (bt.x < -40) bt.x = w + 40 + Math.random() * 60;
    }

    // Flash decay
    s.flashAlpha *= Math.pow(0.01, delta);

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
      const accuracy = s.seedsDropped > 0 ? s.seedsHit / s.seedsDropped : 0;
      const bonus = 1 + accuracy;
      const score = Math.round(s.seedsHit * 10 * bonus);
      setPhase('ended');
      setDisplayScore(score);
      if (accuracy >= 0.5) {
        sounds.success();
        haptics.successFeedback();
        juice.flash(COLORS.mint, 0.5);
      } else {
        sounds.fail();
        haptics.failFeedback();
        juice.flash(COLORS.red, 0.4);
      }
      ctx.restore();
      return;
    }

    // --- RENDER ---
    // Apply screen shake
    juice.applyShake(ctx);

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#2a7ab5');
    skyGrad.addColorStop(0.5, '#5cb8e0');
    skyGrad.addColorStop(0.8, '#87ceeb');
    skyGrad.addColorStop(1, '#3da06a');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Background trees (distant)
    for (const bt of s.bgTrees) {
      ctx.beginPath();
      ctx.moveTo(bt.x, s.groundY);
      ctx.lineTo(bt.x - bt.w / 2, s.groundY);
      ctx.lineTo(bt.x, s.groundY - bt.h);
      ctx.lineTo(bt.x + bt.w / 2, s.groundY);
      ctx.closePath();
      ctx.fillStyle = 'rgba(30,100,50,0.3)';
      ctx.fill();
    }

    // Ground
    ctx.fillStyle = '#5a3a1a';
    ctx.fillRect(0, s.groundY, w, h - s.groundY);
    // Ground grass line
    ctx.strokeStyle = '#3da06a';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, s.groundY);
    for (let gx = 0; gx < w; gx += 8) {
      ctx.lineTo(gx, s.groundY - 2 + Math.sin((gx + s.scrollX) * 0.1) * 2);
    }
    ctx.stroke();

    // Lane indicators
    ctx.setLineDash([5, 10]);
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let l = 0; l < NUM_LANES; l++) {
      const ly = getLaneY(l, h);
      ctx.beginPath();
      ctx.moveTo(0, ly);
      ctx.lineTo(w, ly);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Fertile spots with glow
    for (const spot of s.spots) {
      if (!spot.active) continue;

      // Glow effect on active spots
      if (!spot.hit) {
        const glowColor = spot.bonus ? COLORS.gold : '#8B5A2B';
        juice.drawGlow(ctx, spot.x, spot.y, spot.radius * 2.5, glowColor, spot.bonus ? 0.5 : 0.2);
      }

      ctx.beginPath();
      ctx.ellipse(spot.x, spot.y, spot.radius, 6, 0, 0, Math.PI * 2);
      if (spot.hit) {
        ctx.fillStyle = 'rgba(46,234,163,0.5)';
      } else if (spot.bonus) {
        ctx.fillStyle = 'rgba(245,166,35,0.6)';
        ctx.strokeStyle = COLORS.gold;
        ctx.lineWidth = 2;
        ctx.stroke();
      } else {
        ctx.fillStyle = 'rgba(139,90,43,0.7)';
      }
      ctx.fill();
    }

    // Grown trees with glow
    for (const tree of s.trees) {
      if (!tree.active) continue;
      const g = tree.growth / tree.maxGrowth;
      const treeH = 10 + g * 40;
      const trunkW = 2 + g * 4;

      // Trunk
      ctx.fillStyle = '#5c3a1e';
      ctx.fillRect(tree.x - trunkW / 2, tree.y - treeH, trunkW, treeH);

      // Canopy (grows in) with glow
      if (g > 0.3) {
        const canopyR = (g - 0.3) / 0.7 * 18;

        // Additive glow while growing
        if (tree.growing) {
          juice.drawGlow(ctx, tree.x, tree.y - treeH, canopyR * 2, COLORS.mint, 0.3 * g);
        }

        ctx.beginPath();
        ctx.arc(tree.x, tree.y - treeH, canopyR, 0, Math.PI * 2);
        ctx.fillStyle = '#22a855';
        ctx.fill();
        ctx.beginPath();
        ctx.arc(tree.x - 6, tree.y - treeH + 5, canopyR * 0.7, 0, Math.PI * 2);
        ctx.arc(tree.x + 6, tree.y - treeH + 5, canopyR * 0.7, 0, Math.PI * 2);
        ctx.fillStyle = '#1e9648';
        ctx.fill();
      }
    }

    // Seeds in flight with glow trail
    for (const seed of s.seeds) {
      if (!seed.active) continue;

      if (!seed.landed) {
        // Glow around seed in flight
        juice.drawGlow(ctx, seed.x, seed.y, 12, COLORS.gold, 0.35);
      }

      ctx.beginPath();
      ctx.arc(seed.x, seed.y, seed.landed ? 3 : 4, 0, Math.PI * 2);
      ctx.fillStyle = seed.landed ? '#5c3a1e' : '#8B4513';
      ctx.fill();
      if (!seed.landed) {
        // Trail
        ctx.beginPath();
        ctx.moveTo(seed.x, seed.y);
        ctx.lineTo(seed.x - seed.vx * 0.02, seed.y - seed.vy * 0.02);
        ctx.strokeStyle = 'rgba(139,69,19,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    // Draw toucan with subtle glow
    const bx = s.toucanX;
    const by = s.toucanY + Math.sin(s.toucanBobT) * 5;

    // Toucan glow aura
    juice.drawGlow(ctx, bx + 10, by, 45, COLORS.cyan, 0.12);

    ctx.save();
    ctx.translate(bx, by);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 24, 16, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Chest
    ctx.beginPath();
    ctx.ellipse(5, 5, 12, 10, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#FFD700';
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(22, -5, 11, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a1a';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(26, -7, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(27, -7, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(30, -7);
    ctx.lineTo(55, -2);
    ctx.lineTo(30, 3);
    ctx.closePath();
    const beakGrad = ctx.createLinearGradient(30, -7, 55, 3);
    beakGrad.addColorStop(0, '#FF6600');
    beakGrad.addColorStop(0.5, '#FFD700');
    beakGrad.addColorStop(1, '#FF4400');
    ctx.fillStyle = beakGrad;
    ctx.fill();

    // Wing flap
    const wingY = Math.sin(s.toucanBobT * 2) * 12;
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.quadraticCurveTo(-20, -25 + wingY, -35, -10 + wingY * 0.5);
    ctx.quadraticCurveTo(-20, 0, -5, -5);
    ctx.fillStyle = '#333';
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-24, 0);
    ctx.lineTo(-40, -6);
    ctx.lineTo(-38, 0);
    ctx.lineTo(-40, 6);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();

    ctx.restore();

    // Seed count near toucan - neon text
    juice.drawNeonText(ctx, `Seeds: ${s.seedsLeft}`, bx, by - 35, s.seedsLeft <= 5 ? COLORS.red : COLORS.white, 14);

    // Wind indicator
    const windArrowX = w - 80;
    const windArrowY = 70;
    ctx.save();
    ctx.translate(windArrowX, windArrowY);
    // Label - neon
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.shadowColor = COLORS.cyan;
    ctx.shadowBlur = 8;
    ctx.fillStyle = COLORS.gray;
    ctx.fillText('Wind', 0, -18);
    ctx.shadowBlur = 0;
    // Arrow
    const windLen = Math.abs(s.windX) * 25;
    const windDir = s.windX > 0 ? 1 : -1;
    const windColor = Math.abs(s.windX) > 0.7 ? COLORS.gold : COLORS.cyan;
    ctx.strokeStyle = windColor;
    ctx.lineWidth = 3;
    ctx.shadowColor = windColor;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(-windLen * windDir, 0);
    ctx.lineTo(windLen * windDir, 0);
    ctx.stroke();
    // Arrowhead
    if (Math.abs(s.windX) > 0.1) {
      ctx.beginPath();
      ctx.moveTo(windLen * windDir, 0);
      ctx.lineTo((windLen - 6) * windDir, -5);
      ctx.lineTo((windLen - 6) * windDir, 5);
      ctx.closePath();
      ctx.fillStyle = windColor;
      ctx.fill();
    }
    ctx.shadowBlur = 0;
    ctx.restore();

    // Flash effect (original)
    if (s.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(46,234,163,${s.flashAlpha})`;
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

    // HUD - Timer bar with glow
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.shadowColor = timerColor;
    ctx.shadowBlur = 8;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);
    ctx.shadowBlur = 0;

    // Timer text - neon
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, s.timeLeft < 5 ? COLORS.red : COLORS.white, 24);

    // Score - neon
    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = `bold 16px ${FONT_FAMILY}`;
    ctx.shadowColor = COLORS.mint;
    ctx.shadowBlur = 10;
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Hits: ${s.seedsHit} / ${s.seedsDropped}`, 20, 40);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Subtle bloom on the whole scene
    juice.applyBloom(ctx, w, h, 0.06);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, getLaneY]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION;
      s.seedsLeft = MAX_SEEDS;
      s.seedsDropped = 0;
      s.seedsHit = 0;
      s.lane = 1;
      s.toucanY = 0;
      s.scrollX = 0;
      s.spotTimer = 0;
      s.windX = 0;
      s.windTimer = 0;
      s.flashAlpha = 0;
      s.lastWarningSecond = -1;
      for (const sp of s.spots) sp.active = false;
      for (const seed of s.seeds) { seed.active = false; seed.landed = false; }
      for (const tree of s.trees) tree.active = false;
      for (const p of s.particles) p.active = false;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const accuracy = phase === 'ended' && state.current.seedsDropped > 0
    ? Math.round((state.current.seedsHit / state.current.seedsDropped) * 100) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', fontFamily: FONT_FAMILY }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}>
          <div style={{
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16,
            fontFamily: FONT_FAMILY,
            textShadow: `0 0 20px ${COLORS.cyan}, 0 0 40px ${COLORS.cyan}80`,
          }}>
            {t(UI_STRINGS.timesUp)}
          </div>
          <div style={{
            color: COLORS.gold, fontSize: 20, marginBottom: 8,
            fontFamily: FONT_FAMILY,
            textShadow: `0 0 12px ${COLORS.gold}80`,
          }}>
            Seeds landed: {state.current.seedsHit} / {state.current.seedsDropped}
          </div>
          <div style={{
            color: COLORS.mint, fontSize: 18, marginBottom: 8,
            fontFamily: FONT_FAMILY,
            textShadow: `0 0 12px ${COLORS.mint}80`,
          }}>
            Accuracy: {accuracy}%
          </div>
          <div style={{
            color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4,
            fontFamily: FONT_FAMILY,
            textShadow: `0 0 24px ${COLORS.gold}, 0 0 48px ${COLORS.gold}60`,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 14, marginBottom: 24,
            fontFamily: FONT_FAMILY,
            textShadow: `0 0 8px ${COLORS.gray}40`,
          }}>points</div>
          <button onClick={() => {
            sounds.pop();
            haptics.tapFeedback();
            onComplete(displayScore);
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.mint})`,
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.cyan}60, 0 4px 15px rgba(0,0,0,0.3)`,
            textShadow: 'none',
          }}>Continue</button>
          <button onClick={() => {
            sounds.tick();
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.08)',
            color: COLORS.gray, border: `1px solid ${COLORS.gray}50`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
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
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>Back</button>
      )}
    </div>
  );
}
