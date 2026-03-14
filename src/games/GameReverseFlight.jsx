import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';

const GAME_DURATION = 30;
const POOL_SIZE = 100;
const MAX_LIVES = 3;
const ENERGY_MAX = 100;
const ENERGY_DRAIN_RATE = 40;
const ENERGY_RECHARGE_RATE = 15;
const FLOWER_ENERGY_BOOST = 25;
const OBSTACLE_SPAWN_INTERVAL = 1.2;
const FLOWER_SPAWN_INTERVAL = 3.5;
const SCROLL_SPEED = 120;
const REVERSE_SPEED = -80;

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function GameReverseFlight({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();

  const state = useRef({
    birdX: 0,
    birdY: 0,
    birdVy: 0,
    reversing: false,
    energy: ENERGY_MAX,
    lives: MAX_LIVES,
    distance: 0,
    timeLeft: GAME_DURATION,
    scrollX: 0,
    obstacles: Array(20).fill(null).map(() => ({
      active: false, x: 0, y: 0, w: 0, h: 0, fromRight: true, speed: 0, type: 'branch',
    })),
    flowers: Array(10).fill(null).map(() => ({
      active: false, x: 0, y: 0, size: 0, bobPhase: 0,
    })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    parallaxLayers: [
      { offset: 0, speed: 0.3, color: '#1a3a2c' },
      { offset: 0, speed: 0.6, color: '#2a5a3c' },
      { offset: 0, speed: 1.0, color: '#3a7a4c' },
    ],
    lastObstacleTime: 0,
    lastFlowerTime: 0,
    flashAlpha: 0,
    hitCooldown: 0,
    wingAngle: 0,
    // Trail points for hummingbird
    trailPoints: [],
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
        const speed = 50 + Math.random() * 120;
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

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    const s = state.current;
    if (direction === 'left' && s.energy > 5) {
      s.reversing = true;
      sounds.whoosh();
      haptics.impactFeedback();
    }
  }, [phase, sounds, haptics]);

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
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const cw = canvas.width / dpr;
    const ch = canvas.height / dpr;
    // Check if tapped on a flower
    for (const f of s.flowers) {
      if (!f.active) continue;
      const dx = x - f.x;
      const dy = y - f.y;
      if (dx * dx + dy * dy < (f.size + 20) * (f.size + 20)) {
        f.active = false;
        s.energy = Math.min(ENERGY_MAX, s.energy + FLOWER_ENERGY_BOOST);
        spawnParticles(f.x, f.y, 12, [[255, 200, 50], [255, 150, 200], [255, 255, 100]]);
        sounds.chime();
        sounds.powerup();
        haptics.comboFeedback(2);
        juice.flash('#FFD700', 0.3);
        juice.shake(3, 0.15);
        return;
      }
    }
    sounds.tick();
    haptics.tapFeedback();
  }, [phase, sounds, spawnParticles, haptics, juice]);

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
    const cx = w * 0.3;
    const cy = h / 2;

    // Update juice system
    juice.update(delta);

    if (phase === 'ready') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#0d2818');
      skyGrad.addColorStop(0.5, '#1a4a2c');
      skyGrad.addColorStop(1, '#2d7a3c');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, 'Reverse Flight', w / 2, cy - 60, COLORS.mint, 28);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 10;
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Hummingbirds can fly backwards!', w / 2, cy - 10);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE LEFT to reverse', w / 2, cy + 30);
      ctx.fillText('TAP flowers to collect nectar', w / 2, cy + 56);

      // Pulsing neon "TAP TO START"
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, 'TAP TO START', w / 2, cy + 110, COLORS.cyan, 20);
      ctx.globalAlpha = 1;

      // Glow behind title
      juice.drawGlow(ctx, w / 2, cy - 60, 120, COLORS.mint, 0.15);

      ctx.restore();
      return;
    }

    // --- UPDATE ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.hitCooldown = Math.max(0, s.hitCooldown - delta);
    s.wingAngle += delta * 25;

    // Low time warning haptic
    if (s.timeLeft <= 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      haptics.warningFeedback();
      sounds.countdown(false);
    }

    // Movement
    if (s.reversing) {
      s.energy -= ENERGY_DRAIN_RATE * delta;
      if (s.energy <= 0) {
        s.energy = 0;
        s.reversing = false;
      }
      s.scrollX += REVERSE_SPEED * delta;
      s.distance += Math.abs(REVERSE_SPEED) * delta * 0.3;
    } else {
      s.energy = Math.min(ENERGY_MAX, s.energy + ENERGY_RECHARGE_RATE * delta);
      s.scrollX += SCROLL_SPEED * delta;
      s.distance += SCROLL_SPEED * delta * 0.5;
    }

    // Release reverse on swipe end (auto-release after brief period)
    if (s.reversing && s.energy < 2) s.reversing = false;

    // Parallax
    const effectiveSpeed = s.reversing ? REVERSE_SPEED : SCROLL_SPEED;
    for (const layer of s.parallaxLayers) {
      layer.offset += effectiveSpeed * layer.speed * delta;
    }

    // Update trail points
    s.trailPoints.push({ x: cx, y: cy });
    if (s.trailPoints.length > 12) s.trailPoints.shift();

    // Spawn obstacles
    if (elapsed - s.lastObstacleTime > OBSTACLE_SPAWN_INTERVAL) {
      s.lastObstacleTime = elapsed;
      for (let i = 0; i < s.obstacles.length; i++) {
        const o = s.obstacles[i];
        if (!o.active) {
          o.active = true;
          o.fromRight = Math.random() > 0.3;
          o.x = o.fromRight ? w + 30 : -60;
          o.y = 80 + Math.random() * (h - 180);
          o.w = 30 + Math.random() * 40;
          o.h = 15 + Math.random() * 25;
          o.speed = 60 + Math.random() * 80;
          o.type = Math.random() > 0.5 ? 'branch' : 'predator';
          break;
        }
      }
    }

    // Spawn flowers
    if (elapsed - s.lastFlowerTime > FLOWER_SPAWN_INTERVAL) {
      s.lastFlowerTime = elapsed;
      for (let i = 0; i < s.flowers.length; i++) {
        const f = s.flowers[i];
        if (!f.active) {
          f.active = true;
          f.x = w + 20;
          f.y = 100 + Math.random() * (h - 220);
          f.size = 12 + Math.random() * 8;
          f.bobPhase = Math.random() * Math.PI * 2;
          break;
        }
      }
    }

    // Update obstacles
    const birdLeft = cx - 20;
    const birdRight = cx + 25;
    const birdTop = cy - 12;
    const birdBot = cy + 12;
    for (const o of s.obstacles) {
      if (!o.active) continue;
      const dir = o.fromRight ? -1 : 1;
      o.x += dir * o.speed * delta;
      if (o.x < -80 || o.x > w + 80) { o.active = false; continue; }
      // Collision
      if (s.hitCooldown <= 0) {
        const oLeft = o.x - o.w / 2;
        const oRight = o.x + o.w / 2;
        const oTop = o.y - o.h / 2;
        const oBot = o.y + o.h / 2;
        if (birdRight > oLeft && birdLeft < oRight && birdBot > oTop && birdTop < oBot) {
          s.lives--;
          s.hitCooldown = 1.0;
          s.flashAlpha = 0.5;
          o.active = false;
          spawnParticles(cx, cy, 15, [[239, 68, 68], [255, 150, 100], [255, 255, 255]]);
          sounds.impact();
          sounds.firecrackle();
          haptics.heavyFeedback();
          juice.shake(12, 0.4);
          juice.flash('#EF4444', 0.5);
        }
      }
    }

    // Update flowers
    for (const f of s.flowers) {
      if (!f.active) continue;
      f.x -= SCROLL_SPEED * 0.5 * delta;
      f.bobPhase += delta * 3;
      if (f.x < -30) f.active = false;
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 30 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Flash decay
    s.flashAlpha *= Math.pow(0.01, delta);

    // Game over check
    if ((s.lives <= 0 || s.timeLeft <= 0) && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(Math.floor(s.distance));
      if (s.lives <= 0) {
        sounds.fail();
        haptics.failFeedback();
      } else {
        sounds.success();
        haptics.successFeedback();
      }
      return;
    }

    // --- RENDER ---
    // Apply shake before drawing
    juice.applyShake(ctx);

    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0d2818');
    skyGrad.addColorStop(0.4, '#1a4a2c');
    skyGrad.addColorStop(1, '#87ceeb');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Parallax layers
    for (const layer of s.parallaxLayers) {
      ctx.fillStyle = layer.color;
      const layerW = 200;
      const offset = ((layer.offset % layerW) + layerW) % layerW;
      for (let lx = -offset; lx < w + layerW; lx += layerW) {
        // Mountains / foliage
        ctx.beginPath();
        ctx.moveTo(lx, h);
        ctx.lineTo(lx + 30, h * (0.55 + layer.speed * 0.15));
        ctx.lineTo(lx + 70, h * (0.45 + layer.speed * 0.2));
        ctx.lineTo(lx + 100, h * (0.5 + layer.speed * 0.15));
        ctx.lineTo(lx + 140, h * (0.6 + layer.speed * 0.1));
        ctx.lineTo(lx + 170, h * (0.5 + layer.speed * 0.15));
        ctx.lineTo(lx + layerW, h);
        ctx.closePath();
        ctx.globalAlpha = 0.4 + layer.speed * 0.3;
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // Flash effect (original)
    if (s.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(239,68,68,${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay
    juice.drawFlash(ctx, w, h);

    // Draw flowers with glow
    for (const f of s.flowers) {
      if (!f.active) continue;
      const fy = f.y + Math.sin(f.bobPhase) * 5;

      // Glow effect behind flower
      juice.drawGlow(ctx, f.x, fy, f.size * 3, '#ff69b4', 0.25 + Math.sin(f.bobPhase * 2) * 0.1);

      // Stem
      ctx.beginPath();
      ctx.moveTo(f.x, fy + f.size);
      ctx.lineTo(f.x, fy + f.size + 15);
      ctx.strokeStyle = '#2a8a3c';
      ctx.lineWidth = 2;
      ctx.stroke();
      // Petals
      for (let p = 0; p < 5; p++) {
        const angle = (p / 5) * Math.PI * 2 + f.bobPhase * 0.5;
        ctx.beginPath();
        ctx.ellipse(f.x + Math.cos(angle) * f.size * 0.5, fy + Math.sin(angle) * f.size * 0.5,
          f.size * 0.45, f.size * 0.25, angle, 0, Math.PI * 2);
        ctx.fillStyle = '#ff69b4';
        ctx.fill();
      }
      // Center
      ctx.beginPath();
      ctx.arc(f.x, fy, f.size * 0.25, 0, Math.PI * 2);
      ctx.fillStyle = '#ffdd44';
      ctx.fill();
    }

    // Draw obstacles with subtle glow for predators
    for (const o of s.obstacles) {
      if (!o.active) continue;
      if (o.type === 'branch') {
        ctx.fillStyle = '#5a3a1a';
        ctx.fillRect(o.x - o.w / 2, o.y - o.h / 2, o.w, o.h);
        // Leaves
        ctx.beginPath();
        ctx.ellipse(o.x + o.w * 0.3, o.y - o.h * 0.4, 8, 5, 0.3, 0, Math.PI * 2);
        ctx.fillStyle = '#3a7a3c';
        ctx.fill();
      } else {
        // Predator glow - menacing red
        juice.drawGlow(ctx, o.x, o.y, 30, '#EF4444', 0.15);

        // Predator (hawk silhouette)
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.moveTo(o.x, o.y);
        ctx.lineTo(o.x - o.w * 0.6, o.y - o.h * 0.3);
        ctx.lineTo(o.x - o.w * 0.3, o.y);
        ctx.lineTo(o.x - o.w * 0.6, o.y + o.h * 0.3);
        ctx.lineTo(o.x, o.y + o.h * 0.1);
        ctx.lineTo(o.x + o.w * 0.6, o.y + o.h * 0.3);
        ctx.lineTo(o.x + o.w * 0.3, o.y);
        ctx.lineTo(o.x + o.w * 0.6, o.y - o.h * 0.3);
        ctx.closePath();
        ctx.fill();
        // Eye
        ctx.beginPath();
        ctx.arc(o.x + 3, o.y - 2, 2, 0, Math.PI * 2);
        ctx.fillStyle = COLORS.red;
        ctx.fill();
      }
    }

    // Draw hummingbird trail (additive blending)
    if (s.trailPoints.length > 2) {
      juice.drawTrail(ctx, s.trailPoints, s.reversing ? COLORS.cyan : COLORS.mint, 3);
    }

    // Glow behind hummingbird
    juice.drawGlow(ctx, cx, cy, 50, s.reversing ? COLORS.cyan : COLORS.mint, s.reversing ? 0.35 : 0.2);

    // Draw hummingbird
    ctx.save();
    ctx.translate(cx, cy);
    if (s.reversing) ctx.scale(-1, 1);

    const blinkAlpha = s.hitCooldown > 0 ? (Math.sin(elapsed * 30) > 0 ? 1 : 0.3) : 1;
    ctx.globalAlpha = blinkAlpha;

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 12, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createLinearGradient(-22, -12, 22, 12);
    bodyGrad.addColorStop(0, '#2EEAA3');
    bodyGrad.addColorStop(0.5, '#1ab87a');
    bodyGrad.addColorStop(1, '#0d6b47');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(24, -4, 9, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(28, -6, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(28.5, -6.5, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(32, -4);
    ctx.lineTo(46, -2);
    ctx.lineTo(32, -1);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-38, -7);
    ctx.lineTo(-35, 0);
    ctx.lineTo(-38, 7);
    ctx.closePath();
    ctx.fillStyle = '#0d6b47';
    ctx.fill();

    // Wings (additive blending for glow effect)
    const wingY = Math.sin(s.wingAngle) * 20;
    ctx.globalAlpha = blinkAlpha * 0.7;
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(-25, -35 + wingY, -42, -18 + wingY * 0.7);
    ctx.quadraticCurveTo(-30, -8, -4, -4);
    ctx.fillStyle = '#5ff5c0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(-25, 35 - wingY, -42, 18 - wingY * 0.7);
    ctx.quadraticCurveTo(-30, 8, -4, 4);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // Reverse indicator with glow
    if (s.reversing) {
      ctx.globalAlpha = 0.6;
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.moveTo(50, 0);
      ctx.lineTo(38, -8);
      ctx.lineTo(38, 8);
      ctx.closePath();
      ctx.fillStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 15;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;
    }

    ctx.restore();

    // Particles (additive blending for bright particles)
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

    // Bloom post-processing (subtle)
    juice.applyBloom(ctx, w, h, 0.08);

    // --- HUD ---
    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);
    // Timer bar glow
    if (s.timeLeft < 5) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + Math.sin(elapsed * 8) * 0.2;
      ctx.fillStyle = COLORS.red;
      ctx.fillRect(0, 0, w * timerFrac, 6);
      ctx.restore();
    }

    // Timer text (neon)
    const timerTextColor = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.save();
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = timerColor;
    ctx.shadowBlur = s.timeLeft < 5 ? 15 : 6;
    ctx.fillStyle = timerTextColor;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Distance score (neon text)
    juice.drawNeonText(ctx, `${Math.floor(s.distance)}m`, w / 2, 42, COLORS.white, 36);

    // Lives (hearts) with glow on loss
    ctx.font = `22px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    for (let i = 0; i < MAX_LIVES; i++) {
      if (i < s.lives) {
        ctx.shadowColor = COLORS.red;
        ctx.shadowBlur = 8;
        ctx.fillStyle = COLORS.red;
      } else {
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.2)';
      }
      ctx.fillText('\u2665', 20 + i * 28, 40);
    }
    ctx.shadowBlur = 0;

    // Energy bar with glow
    const barX = 20;
    const barY = 56;
    const barW = 120;
    const barH = 10;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(barX, barY, barW, barH);
    const energyFrac = s.energy / ENERGY_MAX;
    const energyColor = energyFrac < 0.25 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = energyColor;
    ctx.fillRect(barX, barY, barW * energyFrac, barH);

    // Energy bar additive glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = energyColor;
    ctx.fillRect(barX, barY - 1, barW * energyFrac, barH + 2);
    ctx.restore();

    // Energy label (neon)
    ctx.save();
    ctx.font = `bold 10px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.shadowColor = energyColor;
    ctx.shadowBlur = 6;
    ctx.fillStyle = COLORS.white;
    ctx.fillText('ENERGY', barX, barY + barH + 12);
    ctx.shadowBlur = 0;
    ctx.restore();

    ctx.restore();
  }, [phase, sounds, spawnParticles, haptics, juice]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.distance = 0;
      s.lives = MAX_LIVES;
      s.energy = ENERGY_MAX;
      s.timeLeft = GAME_DURATION;
      s.reversing = false;
      s.lastObstacleTime = 0;
      s.lastFlowerTime = 0;
      s.hitCooldown = 0;
      s.flashAlpha = 0;
      s.scrollX = 0;
      s.trailPoints = [];
      for (const o of s.obstacles) o.active = false;
      for (const f of s.flowers) f.active = false;
      for (const p of s.particles) p.active = false;
      for (const l of s.parallaxLayers) l.offset = 0;
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
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16,
            textShadow: `0 0 20px ${COLORS.mint}, 0 0 40px ${COLORS.mint}80`,
          }}>Results</div>
          <div style={{
            color: COLORS.mint, fontSize: 20, marginBottom: 8,
            textShadow: `0 0 12px ${COLORS.mint}`,
          }}>
            Distance: {displayScore}m
          </div>
          <div style={{
            color: COLORS.cyan, fontSize: 16, marginBottom: 4,
            textShadow: `0 0 10px ${COLORS.cyan}`,
          }}>
            Lives: {state.current.lives}/{MAX_LIVES}
          </div>
          <div style={{
            color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4,
            textShadow: `0 0 30px ${COLORS.gold}, 0 0 60px ${COLORS.gold}60`,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 14, marginBottom: 24,
            textShadow: `0 0 8px ${COLORS.gray}80`,
          }}>score</div>
          <button onClick={() => {
            haptics.tapFeedback();
            sounds.pop();
            onComplete(displayScore);
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
            boxShadow: `0 0 20px ${COLORS.cyan}60, 0 0 40px ${COLORS.cyan}30`,
            textShadow: 'none',
          }}>Continue</button>
          <button onClick={() => {
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.08)',
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
          fontSize: 14, cursor: 'pointer', zIndex: 10,
          fontFamily: FONT_FAMILY,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>Back</button>
      )}
    </div>
  );
}
