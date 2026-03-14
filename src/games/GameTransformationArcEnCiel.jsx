import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';

const GAME_DURATION = 45;
const POOL_SIZE = 150;
const MAX_LIVES = 3;
const MAX_DEPTH = 100;
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function GameTransformationArcEnCiel({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();

  const state = useRef({
    score: 0,
    timeLeft: GAME_DURATION,
    lives: MAX_LIVES,
    depth: 0,
    depthVelocity: 0,
    parrotX: 0,
    parrotTargetX: 0,
    multiplier: 1,
    dropletsCollected: 0,
    obstacles: [],
    droplets: [],
    obstacleSpawnTimer: 0,
    dropletSpawnTimer: 0,
    invincibleTimer: 0,
    damageFlash: 0,
    scrollOffset: 0,
    lastWarningTime: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    embers: Array(40).fill(null).map(() => ({
      x: 0, y: 0, vx: 0, vy: 0, size: 0, life: 0, active: false,
    })),
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
        const speed = 50 + Math.random() * 100;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 2 + Math.random() * 4;
        spawned++;
      }
    }
  }, []);

  const handleSwipe = useCallback((direction) => {
    if (phase === 'ready') { setPhase('playing'); sounds.countdown(true); haptics.tapFeedback(); return; }
    if (phase !== 'playing') return;
    const s = state.current;
    const w = window.innerWidth;
    if (direction === 'down') {
      s.depthVelocity = Math.min(s.depthVelocity + 25, 60);
      sounds.whoosh();
      haptics.tapFeedback();
    } else if (direction === 'up' || direction === 'left' || direction === 'right') {
      if (direction === 'up') {
        s.depthVelocity = Math.max(s.depthVelocity - 30, -20);
        sounds.wingflap();
        haptics.tapFeedback();
      }
      if (direction === 'left') { s.parrotTargetX = Math.max(40, s.parrotX - 60); sounds.wingflap(); haptics.tapFeedback(); }
      if (direction === 'right') { s.parrotTargetX = Math.min(w - 40, s.parrotX + 60); sounds.wingflap(); haptics.tapFeedback(); }
    }
  }, [phase, sounds, haptics]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') { setPhase('playing'); sounds.countdown(true); haptics.tapFeedback(); return; }
    if (phase !== 'playing') return;
    state.current.depthVelocity = Math.max(state.current.depthVelocity - 15, -10);
    sounds.wingflap();
    haptics.tapFeedback();
  }, [phase, sounds, haptics]);

  useTouch(canvasRef, { onSwipe: handleSwipe, onTap: handleTap });

  function getParrotColor(depth) {
    const pct = depth / MAX_DEPTH;
    if (pct < 0.2) return { r: 150, g: 150, b: 150 };
    if (pct < 0.4) return { r: 220, g: 140, b: 50 };
    if (pct < 0.7) return { r: 255, g: 200, b: 50 };
    return null; // rainbow
  }

  function drawParrot(ctx, x, y, depth, time) {
    ctx.save();
    ctx.translate(x, y);

    const color = getParrotColor(depth);
    const pct = depth / MAX_DEPTH;

    if (color) {
      ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
    } else {
      // Rainbow
      const hue = (time * 100) % 360;
      ctx.fillStyle = `hsl(${hue},80%,55%)`;
    }

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 18, 24, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -26, 12, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#F5A623';
    ctx.beginPath();
    ctx.moveTo(10, -26);
    ctx.lineTo(20, -22);
    ctx.lineTo(10, -20);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(4, -28, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(5, -29, 2, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    const wingAngle = Math.sin(time * 8) * 0.3;
    ctx.save();
    ctx.rotate(wingAngle);
    if (color) {
      const darkerR = Math.max(0, color.r - 40);
      const darkerG = Math.max(0, color.g - 40);
      const darkerB = Math.max(0, color.b - 40);
      ctx.fillStyle = `rgb(${darkerR},${darkerG},${darkerB})`;
    } else {
      const hue2 = ((time * 100) + 120) % 360;
      ctx.fillStyle = `hsl(${hue2},80%,45%)`;
    }
    ctx.beginPath();
    ctx.ellipse(-16, 0, 10, 18, -0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(16, 0, 10, 18, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-6, 20);
    ctx.lineTo(-12, 38);
    ctx.lineTo(0, 32);
    ctx.lineTo(12, 38);
    ctx.lineTo(6, 20);
    ctx.closePath();
    if (!color) {
      const hue3 = ((time * 100) + 240) % 360;
      ctx.fillStyle = `hsl(${hue3},80%,50%)`;
    }
    ctx.fill();

    // Rainbow glow at deep depth
    if (pct > 0.7) {
      const glowAlpha = (pct - 0.7) / 0.3 * 0.4;
      for (let i = 0; i < 6; i++) {
        const hue = (i / 6) * 360;
        const gr = 30 + i * 8;
        ctx.beginPath();
        ctx.arc(0, 0, gr, 0, Math.PI * 2);
        ctx.strokeStyle = `hsla(${hue},80%,60%,${glowAlpha * (1 - i / 6)})`;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

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

    if (phase === 'ready') {
      ctx.fillStyle = '#1A0A00';
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, 'Transformation Arc-en-ciel', w / 2, h / 2 - 70, COLORS.gold, 22);

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 8;
      ctx.fillText('Feathers scorched by fire', w / 2, h / 2 - 20);
      ctx.fillText('become rainbow (Jataka)', w / 2, h / 2 + 4);
      ctx.shadowBlur = 0;

      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE DOWN: dive deeper (higher score)', w / 2, h / 2 + 44);
      ctx.fillText('SWIPE L/R: dodge | TAP: rise up', w / 2, h / 2 + 66);

      // Pulsing start text
      const pulse = 0.7 + Math.sin(elapsed * 3) * 0.3;
      juice.drawNeonText(ctx, 'TAP TO START', w / 2, h / 2 + 120, COLORS.white, 20);
      ctx.globalAlpha = pulse;
      juice.drawGlow(ctx, w / 2, h / 2 + 120, 80, COLORS.mint, 0.2);
      ctx.globalAlpha = 1;

      ctx.restore();
      juice.update(delta);
      return;
    }

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    if (s.parrotX === 0) s.parrotX = w / 2;
    if (s.parrotTargetX === 0) s.parrotTargetX = w / 2;

    // Depth physics
    s.depthVelocity += delta * 5; // Gravity-like pull down
    s.depthVelocity *= 0.98;
    s.depth = Math.max(0, Math.min(MAX_DEPTH, s.depth + s.depthVelocity * delta));

    // Multiplier based on depth
    s.multiplier = 1 + (s.depth / MAX_DEPTH) * 4;

    // Parrot horizontal movement
    s.parrotX += (s.parrotTargetX - s.parrotX) * Math.min(1, delta * 8);

    // Scroll
    s.scrollOffset += (s.depthVelocity * 2 + 30) * delta;

    // Spawn obstacles
    s.obstacleSpawnTimer += delta;
    const spawnRate = 0.6 - (s.depth / MAX_DEPTH) * 0.3;
    if (s.obstacleSpawnTimer > spawnRate) {
      s.obstacleSpawnTimer = 0;
      const type = Math.random() > 0.4 ? 'ember' : 'branch';
      s.obstacles.push({
        type,
        x: 30 + Math.random() * (w - 60),
        y: -30,
        width: type === 'branch' ? 40 + Math.random() * 40 : 12 + Math.random() * 8,
        height: type === 'branch' ? 8 : 12 + Math.random() * 8,
        speed: 100 + s.depth * 2 + Math.random() * 50,
      });
    }

    // Spawn droplets
    s.dropletSpawnTimer += delta;
    if (s.dropletSpawnTimer > 1.2) {
      s.dropletSpawnTimer = 0;
      s.droplets.push({
        x: 30 + Math.random() * (w - 60),
        y: -20,
        speed: 80 + Math.random() * 40,
        size: 6 + Math.random() * 4,
      });
    }

    // Update obstacles
    const parrotHitbox = { x: s.parrotX - 14, y: h * 0.4 - 20, w: 28, h: 40 };
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      const o = s.obstacles[i];
      o.y += o.speed * delta;
      if (o.y > h + 30) { s.obstacles.splice(i, 1); continue; }

      // Collision
      if (s.invincibleTimer <= 0) {
        const ox = o.x - o.width / 2;
        const oy = o.y - o.height / 2;
        if (parrotHitbox.x < ox + o.width && parrotHitbox.x + parrotHitbox.w > ox &&
            parrotHitbox.y < oy + o.height && parrotHitbox.y + parrotHitbox.h > oy) {
          s.lives--;
          s.invincibleTimer = 1.5;
          s.damageFlash = 1;
          sounds.impact();
          sounds.firecrackle();
          haptics.impactFeedback();
          juice.shake(12, 0.4);
          juice.flash('#FF0000', 0.5);
          spawnParticles(s.parrotX, h * 0.4, 12, 255, 100, 0);
          s.obstacles.splice(i, 1);
          if (s.lives <= 0) {
            sounds.fail();
            haptics.failFeedback();
            juice.shake(18, 0.6);
            juice.flash('#FF0000', 0.7);
            setPhase('ended');
            return;
          }
        }
      }
    }

    // Update droplets
    for (let i = s.droplets.length - 1; i >= 0; i--) {
      const d = s.droplets[i];
      d.y += d.speed * delta;
      if (d.y > h + 20) { s.droplets.splice(i, 1); continue; }

      const dx = d.x - s.parrotX;
      const dy = d.y - h * 0.4;
      if (Math.hypot(dx, dy) < 25) {
        s.droplets.splice(i, 1);
        s.dropletsCollected++;
        const pts = Math.floor(3 * s.multiplier);
        s.score += pts;
        setDisplayScore(s.score);
        spawnParticles(d.x, d.y, 6, 0, 191, 255);
        sounds.drop();
        sounds.tick();
        haptics.tapFeedback();
        juice.flash('#00BFFF', 0.15);

        // Combo feedback every 5 droplets
        if (s.dropletsCollected % 5 === 0) {
          sounds.combo(Math.floor(s.dropletsCollected / 5));
          haptics.comboFeedback(Math.min(s.dropletsCollected / 5, 5));
          juice.flash(COLORS.gold, 0.25);
        }
      }
    }

    // Invincibility
    if (s.invincibleTimer > 0) s.invincibleTimer -= delta;
    s.damageFlash *= Math.pow(0.05, delta);

    // Low time warning haptic
    if (s.timeLeft <= 5 && s.timeLeft > 0) {
      const currentSecond = Math.ceil(s.timeLeft);
      if (currentSecond !== s.lastWarningTime) {
        s.lastWarningTime = currentSecond;
        haptics.warningFeedback();
        sounds.countdown(false);
      }
    }

    // Ambient embers floating up
    for (const e of s.embers) {
      if (!e.active) {
        if (Math.random() < delta * 2) {
          e.active = true;
          e.x = Math.random() * w;
          e.y = h + 10;
          e.vx = (Math.random() - 0.5) * 30;
          e.vy = -(30 + Math.random() * 60);
          e.size = 1 + Math.random() * 3;
          e.life = 2 + Math.random() * 3;
        }
      } else {
        e.x += e.vx * delta;
        e.y += e.vy * delta;
        e.life -= delta;
        if (e.life <= 0 || e.y < -10) e.active = false;
      }
    }

    // Particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over by time
    if (s.timeLeft <= 0 && phase === 'playing') {
      sounds.success();
      haptics.successFeedback();
      juice.flash('#FFFFFF', 0.6);
      setPhase('ended');
      return;
    }

    // --- RENDER ---
    // Apply shake before all rendering
    juice.applyShake(ctx);

    const depthPct = s.depth / MAX_DEPTH;

    // Background - fire gradient intensifying with depth
    const bgR = Math.floor(30 + 180 * depthPct);
    const bgG = Math.floor(10 + 60 * depthPct);
    const bgB = Math.floor(0 + 10 * depthPct);
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, `rgb(${Math.floor(bgR * 0.6)},${Math.floor(bgG * 0.4)},${bgB})`);
    bgGrad.addColorStop(0.5, `rgb(${bgR},${bgG},${bgB})`);
    bgGrad.addColorStop(1, `rgb(${Math.min(255, bgR + 40)},${Math.floor(bgG * 0.7)},0)`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Damage flash
    if (s.damageFlash > 0.01) {
      ctx.fillStyle = `rgba(255,0,0,${s.damageFlash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Ambient embers with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of s.embers) {
      if (!e.active) continue;
      const alpha = Math.min(1, e.life);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${Math.floor(100 + Math.random() * 100)},0,${alpha * 0.7})`;
      ctx.fill();
    }
    ctx.restore();

    // Obstacles with glow
    for (const o of s.obstacles) {
      if (o.type === 'branch') {
        ctx.fillStyle = '#5C3D1E';
        ctx.save();
        ctx.translate(o.x, o.y);
        ctx.fillRect(-o.width / 2, -o.height / 2, o.width, o.height);
        // Fire on branch
        ctx.fillStyle = 'rgba(255,120,0,0.7)';
        for (let f = 0; f < 3; f++) {
          const fx = -o.width / 4 + f * (o.width / 3);
          const fh = 6 + Math.sin(elapsed * 8 + f) * 3;
          ctx.beginPath();
          ctx.moveTo(fx - 4, -o.height / 2);
          ctx.lineTo(fx, -o.height / 2 - fh);
          ctx.lineTo(fx + 4, -o.height / 2);
          ctx.fill();
        }
        ctx.restore();
        // Glow around fire obstacle
        juice.drawGlow(ctx, o.x, o.y, 30, '#FF6600', 0.2);
      } else {
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.width / 2, 0, Math.PI * 2);
        const grad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.width / 2);
        grad.addColorStop(0, '#FFE066');
        grad.addColorStop(0.5, '#FF6600');
        grad.addColorStop(1, 'rgba(255,50,0,0)');
        ctx.fillStyle = grad;
        ctx.fill();
        // Additive glow for embers
        juice.drawGlow(ctx, o.x, o.y, o.width, '#FF4400', 0.3);
      }
    }

    // Droplets with glow
    for (const d of s.droplets) {
      // Glow behind droplet
      juice.drawGlow(ctx, d.x, d.y, d.size * 3, '#00BFFF', 0.3);

      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      const dropGrad = ctx.createRadialGradient(d.x - 1, d.y - 1, 0, d.x, d.y, d.size);
      dropGrad.addColorStop(0, 'rgba(150,220,255,0.9)');
      dropGrad.addColorStop(1, 'rgba(0,130,255,0.6)');
      ctx.fillStyle = dropGrad;
      ctx.fill();
    }

    // Parrot with glow
    const parrotY = h * 0.4;
    if (s.invincibleTimer > 0 && Math.floor(s.invincibleTimer * 10) % 2 === 0) {
      // Blink
    } else {
      // Glow around parrot
      const parrotColor = getParrotColor(s.depth);
      if (parrotColor) {
        juice.drawGlow(ctx, s.parrotX, parrotY, 50, `rgb(${parrotColor.r},${parrotColor.g},${parrotColor.b})`, 0.25);
      } else {
        // Rainbow glow
        const hueGlow = (elapsed * 100) % 360;
        juice.drawGlow(ctx, s.parrotX, parrotY, 60, `hsl(${hueGlow},80%,55%)`, 0.35);
      }
      drawParrot(ctx, s.parrotX, parrotY, s.depth, elapsed);
    }

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

    // Depth meter (right side) with glow
    const meterX = w - 25;
    const meterTop = 60;
    const meterH = h * 0.6;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(meterX - 6, meterTop, 12, meterH);
    // Depth fill
    const depthFill = depthPct * meterH;
    const meterGrad = ctx.createLinearGradient(0, meterTop, 0, meterTop + meterH);
    meterGrad.addColorStop(0, '#888');
    meterGrad.addColorStop(0.3, '#FF8800');
    meterGrad.addColorStop(0.6, '#FFD700');
    meterGrad.addColorStop(1, '#FF00FF');
    ctx.fillStyle = meterGrad;
    ctx.fillRect(meterX - 5, meterTop, 10, depthFill);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(meterX - 6, meterTop, 12, meterH);

    // Glow at depth indicator tip
    if (depthFill > 5) {
      juice.drawGlow(ctx, meterX, meterTop + depthFill, 15, depthPct > 0.7 ? '#FF00FF' : '#FFD700', 0.4);
    }

    // Depth label - neon
    juice.drawNeonText(ctx, `${Math.floor(depthPct * 100)}%`, meterX, meterTop - 10, depthPct > 0.7 ? '#FF00FF' : '#FFD700', 11);

    // Multiplier - neon
    const multColor = depthPct > 0.7 ? '#FF00FF' : COLORS.gold;
    juice.drawNeonText(ctx, `x${s.multiplier.toFixed(1)}`, w / 2, 70, multColor, 18);

    // Lives
    for (let i = 0; i < MAX_LIVES; i++) {
      ctx.save();
      ctx.translate(20 + i * 28, 65);
      ctx.scale(0.7, 0.7);
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(-7, -3, -10, -8, -5, -9);
      ctx.bezierCurveTo(0, -10, 0, -5, 0, -5);
      ctx.bezierCurveTo(0, -5, 0, -10, 5, -9);
      ctx.bezierCurveTo(10, -8, 7, -3, 0, 3);
      ctx.fillStyle = i < s.lives ? '#EF4444' : '#333';
      ctx.fill();
      // Glow on active hearts
      if (i < s.lives) {
        ctx.shadowColor = '#EF4444';
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.restore();
    }

    // Score - neon text
    juice.drawNeonText(ctx, `Score: ${s.score}`, 90, 40, COLORS.white, 22);

    // Timer - neon text
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.save();
    ctx.textAlign = 'right';
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, timerColor, 24);
    ctx.restore();

    // Screen flash overlay (from juice)
    juice.drawFlash(ctx, w, h);

    // Bloom effect at deeper depths
    if (depthPct > 0.5) {
      juice.applyBloom(ctx, w, h, (depthPct - 0.5) * 0.3);
    }

    // Update juice system
    juice.update(delta);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles]));

  useEffect(() => { if (phase === 'ready') gameLoop.start(); }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0; s.lives = MAX_LIVES; s.depth = 0; s.depthVelocity = 0;
      s.multiplier = 1; s.dropletsCollected = 0; s.obstacles = []; s.droplets = [];
      s.obstacleSpawnTimer = 0; s.dropletSpawnTimer = 0; s.invincibleTimer = 0;
      s.lastWarningTime = 0;
      s.parrotX = window.innerWidth / 2; s.parrotTargetX = window.innerWidth / 2;
      gameLoop.reset(); gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => { if (phase === 'ended') gameLoop.stop(); }, [phase, gameLoop]);
  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000', fontFamily: FONT_FAMILY }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          background: 'rgba(0,0,0,0.75)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 20px ${COLORS.gold}, 0 0 40px ${COLORS.gold}80`,
            fontFamily: FONT_FAMILY,
          }}>Transformation Complete!</div>
          <div style={{
            color: COLORS.gold, fontSize: 48, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 30px ${COLORS.gold}, 0 0 60px ${COLORS.gold}80, 0 0 90px ${COLORS.gold}40`,
            fontFamily: FONT_FAMILY,
          }}>{state.current.score}</div>
          <div style={{
            color: COLORS.gray, fontSize: 15, marginBottom: 4,
            textShadow: '0 0 8px rgba(255,255,255,0.3)',
            fontFamily: FONT_FAMILY,
          }}>
            Droplets collected: {state.current.dropletsCollected}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 13, marginBottom: 24,
            textShadow: '0 0 8px rgba(255,255,255,0.3)',
            fontFamily: FONT_FAMILY,
          }}>
            Scorched feathers become rainbow!
          </div>
          <button onClick={() => { haptics.successFeedback(); sounds.chime(); onComplete(state.current.score); }} style={{
            background: `linear-gradient(135deg, ${COLORS.mint}, ${COLORS.cyan})`,
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginBottom: 12,
            boxShadow: `0 0 20px ${COLORS.mint}60, 0 0 40px ${COLORS.mint}30`,
            textShadow: 'none',
            fontFamily: FONT_FAMILY,
          }}>Continue</button>
          <button onClick={() => { haptics.tapFeedback(); onBack(); }} style={{
            background: 'rgba(255,255,255,0.08)',
            color: COLORS.gray, border: `1px solid ${COLORS.gray}60`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
            textShadow: '0 0 6px rgba(255,255,255,0.2)',
            fontFamily: FONT_FAMILY,
          }}>Back</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => { haptics.tapFeedback(); onBack(); }} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
          color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 14, cursor: 'pointer', zIndex: 10,
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          fontFamily: FONT_FAMILY,
        }}>Back</button>
      )}
    </div>
  );
}
