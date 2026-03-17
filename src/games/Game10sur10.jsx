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
const TOTAL_TOKENS = 10;
const POOL_SIZE = 120;

export default function Game10sur10({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION,
    tokensGiven: 0,
    currentToken: {
      active: true, x: 0, y: 0,
      grabbed: false, flying: false, flyProgress: 0,
      startX: 0, startY: 0, endX: 0, endY: 0, spawnTime: 0,
    },
    multiplier: 1.0,
    lastGiveTime: 0,
    consecutiveSpeed: 0,
    score: 0,
    feedbackText: '',
    feedbackTimer: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    trailParticles: Array(60).fill(null).map(() => ({
      active: false, x: 0, y: 0, life: 0, maxLife: 0, size: 0, alpha: 0, hue: 0,
    })),
    shockwaves: [],
    floatingTexts: [],
    dragX: 0, dragY: 0, isDragging: false,
    tokenAngle: 0,
    leftParrotBob: 0, rightParrotBob: 0,
    tokenScale: 1,
    // Background leaves
    leaves: Array(15).fill(null).map(() => ({
      x: Math.random(), y: Math.random(), size: 3 + Math.random() * 8,
      speed: 0.01 + Math.random() * 0.03, phase: Math.random() * Math.PI * 2,
      rotation: Math.random() * Math.PI * 2,
    })),
  });

  const spawnParticles = useCallback((cx, cy, count, r, g, b, opts = {}) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * (opts.spread || 0);
        p.y = cy + (Math.random() - 0.5) * (opts.spread || 0);
        const angle = Math.random() * Math.PI * 2;
        const speed = (opts.minSpeed || 50) + Math.random() * (opts.maxSpeed || 200);
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed - (opts.upBias || 0);
        p.life = (opts.minLife || 0.3) + Math.random() * (opts.maxLife || 0.6);
        p.maxLife = p.life;
        p.r = r + Math.floor((Math.random() - 0.5) * 20);
        p.g = g + Math.floor((Math.random() - 0.5) * 20);
        p.b = b + Math.floor((Math.random() - 0.5) * 20);
        p.size = (opts.minSize || 2) + Math.random() * (opts.maxSize || 5);
        p.type = opts.type || (Math.random() > 0.5 ? 'line' : 'dot');
        spawned++;
      }
    }
  }, []);

  const spawnTrail = useCallback((x, y) => {
    const s = state.current;
    for (let i = 0; i < s.trailParticles.length; i++) {
      const p = s.trailParticles[i];
      if (!p.active) {
        p.active = true;
        p.x = x + (Math.random() - 0.5) * 6;
        p.y = y + (Math.random() - 0.5) * 6;
        p.life = 0.25 + Math.random() * 0.2;
        p.maxLife = p.life;
        p.size = 3 + Math.random() * 8;
        p.alpha = 0.7;
        p.hue = 30 + Math.random() * 20; // gold-orange range
        break;
      }
    }
  }, []);

  const resetToken = useCallback((w, h) => {
    const s = state.current;
    const t = s.currentToken;
    t.active = true;
    t.x = w * 0.3;
    t.y = h * 0.5 + (Math.random() - 0.5) * 60;
    t.grabbed = false;
    t.flying = false;
    t.flyProgress = 0;
    t.spawnTime = performance.now();
  }, []);

  const handleDrag = useCallback(({ x, y }) => {
    if (phase !== 'playing') return;
    const s = state.current;
    const t = s.currentToken;
    if (!t.active || t.flying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = x - rect.left;
    const ly = y - rect.top;

    if (!s.isDragging) {
      const dx = lx - t.x, dy = ly - t.y;
      if (Math.sqrt(dx * dx + dy * dy) < 55) {
        s.isDragging = true;
        t.grabbed = true;
        haptics.tapFeedback();
      }
    }
    if (s.isDragging) {
      s.dragX = lx; s.dragY = ly;
      t.x = lx; t.y = ly;
      spawnTrail(lx, ly);
    }
  }, [phase, haptics, spawnTrail]);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') { setPhase('playing'); haptics.tapFeedback(); }
      return;
    }
    const s = state.current;
    const t = s.currentToken;
    if (!t.active || t.flying) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const lx = x - rect.left, ly = y - rect.top;
    const dx = lx - t.x, dy = ly - t.y;
    if (Math.sqrt(dx * dx + dy * dy) < 55) {
      t.grabbed = true; t.flying = true;
      t.startX = t.x; t.startY = t.y;
      const w = window.innerWidth, h = window.innerHeight;
      t.endX = w * 0.82; t.endY = h * 0.45;
      t.flyProgress = 0;
      sounds.whoosh();
      haptics.tapFeedback();
    }
  }, [phase, sounds, haptics]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing' || direction !== 'right') return;
    const s = state.current;
    const t = s.currentToken;
    if (!t.active || t.flying) return;
    t.flying = true;
    t.startX = t.x; t.startY = t.y;
    const w = window.innerWidth, h = window.innerHeight;
    t.endX = w * 0.82; t.endY = h * 0.45;
    t.flyProgress = 0;
    sounds.whoosh();
    haptics.tapFeedback();
  }, [phase, sounds, haptics]);

  useTouch(canvasRef, { onTap: handleTap, onSwipe: handleSwipe, onDrag: handleDrag });

  const drawParrot = useCallback((ctx, x, y, facing, bob, color1, color2, wingFlap) => {
    ctx.save();
    ctx.translate(x, y + Math.sin(bob) * 5);
    const dir = facing === 'right' ? 1 : -1;
    ctx.scale(dir, 1);

    // Shadow under parrot
    ctx.beginPath();
    ctx.ellipse(0, 50, 25, 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.fill();

    // Tail feathers
    ctx.save();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-12 - i * 4, 25);
      ctx.quadraticCurveTo(-30 - i * 8, 50 + i * 5, -15 - i * 6, 60 + i * 5);
      ctx.lineWidth = 4 - i;
      ctx.strokeStyle = color2;
      ctx.stroke();
    }
    ctx.restore();

    // Body with gradient
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 36, 0, 0, Math.PI * 2);
    const bodyGrad = ctx.createRadialGradient(-8, -10, 0, 0, 0, 36);
    bodyGrad.addColorStop(0, color1);
    bodyGrad.addColorStop(0.7, color2);
    bodyGrad.addColorStop(1, `${color2}CC`);
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Chest highlight
    ctx.beginPath();
    ctx.ellipse(5, 5, 14, 20, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fill();

    // Wing with flap
    const wingAngle = -0.3 + Math.sin(wingFlap || 0) * 0.15;
    ctx.save();
    ctx.rotate(wingAngle);
    ctx.beginPath();
    ctx.ellipse(-10, 5, 20, 28, -0.2, 0, Math.PI * 2);
    const wingGrad = ctx.createLinearGradient(-30, -20, 10, 30);
    wingGrad.addColorStop(0, color2);
    wingGrad.addColorStop(1, color1);
    ctx.fillStyle = wingGrad;
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Head
    ctx.beginPath();
    ctx.arc(10, -32, 20, 0, Math.PI * 2);
    const headGrad = ctx.createRadialGradient(6, -36, 0, 10, -32, 20);
    headGrad.addColorStop(0, color1);
    headGrad.addColorStop(1, color2);
    ctx.fillStyle = headGrad;
    ctx.fill();

    // Eye ring
    ctx.beginPath();
    ctx.arc(19, -35, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#FFFFFF';
    ctx.fill();
    // Pupil
    ctx.beginPath();
    ctx.arc(20, -35, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    // Eye highlight
    ctx.beginPath();
    ctx.arc(21.5, -36.5, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(27, -30);
    ctx.quadraticCurveTo(42, -27, 33, -20);
    ctx.quadraticCurveTo(27, -22, 27, -30);
    const beakGrad = ctx.createLinearGradient(27, -30, 38, -20);
    beakGrad.addColorStop(0, '#FFD700');
    beakGrad.addColorStop(1, '#E8A317');
    ctx.fillStyle = beakGrad;
    ctx.fill();

    ctx.restore();
  }, []);

  const gameLoop = useGameLoop(useCallback(({ elapsed, delta }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
    const ctx = canvas.getContext('2d');
    ctx.save();
    ctx.scale(dpr, dpr);

    const s = state.current;
    const cx = w / 2, cy = h / 2;

    // --- READY SCREEN ---
    if (phase === 'ready') {
      // Forest gradient bg
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#0d2818');
      bgGrad.addColorStop(0.5, '#122a15');
      bgGrad.addColorStop(1, '#0a1f0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Floating leaves
      for (const leaf of s.leaves) {
        const lx = leaf.x * w + Math.sin(elapsed * leaf.speed * 10 + leaf.phase) * 20;
        const ly = leaf.y * h;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(leaf.rotation + elapsed * 0.5);
        ctx.fillStyle = `rgba(46,234,163,${0.08 + Math.sin(elapsed + leaf.phase) * 0.04})`;
        ctx.beginPath();
        ctx.ellipse(0, 0, leaf.size, leaf.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      drawParrot(ctx, w * 0.2, cy, 'right', elapsed * 2, '#e74c3c', '#c0392b', elapsed * 3);
      drawParrot(ctx, w * 0.8, cy, 'left', elapsed * 2 + 1, '#3498db', '#2980b9', elapsed * 3 + 1);

      // Arrow between parrots
      const arrowAlpha = 0.3 + Math.sin(elapsed * 3) * 0.2;
      ctx.globalAlpha = arrowAlpha;
      ctx.strokeStyle = '#F5A623';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.moveTo(w * 0.32, cy);
      ctx.lineTo(w * 0.68, cy);
      ctx.stroke();
      ctx.setLineDash([]);
      // Arrowhead
      ctx.beginPath();
      ctx.moveTo(w * 0.68, cy);
      ctx.lineTo(w * 0.65, cy - 8);
      ctx.lineTo(w * 0.65, cy + 8);
      ctx.closePath();
      ctx.fillStyle = '#F5A623';
      ctx.fill();
      ctx.globalAlpha = 1;

      juice.drawNeonText(ctx, t(GAME_NAMES['13']), cx, cy - 90, '#F5A623', 32);

      ctx.font = "15px 'Outfit', 'DM Sans', sans-serif";
      ctx.textAlign = 'center';
      ctx.fillStyle = '#8a8';
      ctx.fillText(t(UI_STRINGS.parrotsGiveTokens), cx, cy - 50);
      ctx.fillText(t(UI_STRINGS.withoutHesitation), cx, cy - 30);

      ctx.fillStyle = '#667';
      ctx.font = "13px 'Outfit', 'DM Sans', sans-serif";
      ctx.fillText(t(UI_STRINGS.swipeTokensToPartner), cx, cy + 85);

      const tapAlpha = 0.3 + Math.sin(elapsed * 4) * 0.7;
      ctx.globalAlpha = Math.max(0, tapAlpha);
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart).toUpperCase(), cx, cy + 130, '#F5A623', 20);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // --- PLAYING ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.tokenAngle += delta * 2;
    s.leftParrotBob = elapsed * 2.5;
    s.rightParrotBob = elapsed * 2.5 + 1;

    const tk = s.currentToken;

    // Flying token
    if (tk.flying) {
      tk.flyProgress += delta * 3.5;
      const p = Math.min(1, tk.flyProgress);
      const ease = 1 - Math.pow(1 - p, 3);
      tk.x = tk.startX + (tk.endX - tk.startX) * ease;
      const arcHeight = -100;
      tk.y = tk.startY + (tk.endY - tk.startY) * ease + arcHeight * Math.sin(p * Math.PI);
      spawnTrail(tk.x, tk.y);

      if (p >= 1) {
        tk.active = false; tk.flying = false;
        s.tokensGiven++;
        const now = performance.now();
        const hesitation = (now - tk.spawnTime) / 1000;

        if (hesitation < 0.5) { s.consecutiveSpeed++; }
        else if (hesitation < 1.0) { s.consecutiveSpeed = Math.max(0, s.consecutiveSpeed - 1); }
        else { s.consecutiveSpeed = 0; }

        s.multiplier = 1.0 + s.consecutiveSpeed * 0.3;
        const tokenScore = Math.round(1 * s.multiplier * 10) / 10;
        s.score += tokenScore;

        if (hesitation < 0.5) {
          s.feedbackText = `${t(UI_STRINGS.fast)} ×${s.multiplier.toFixed(1)}`;
          spawnParticles(tk.endX, tk.endY, 18, 46, 234, 163, { maxSpeed: 300, upBias: 40 });
          s.shockwaves.push({ x: tk.endX, y: tk.endY, radius: 15, maxRadius: 120, life: 0.4, maxLife: 0.4, color: 'rgba(46,234,163,0.5)' });
          juice.shake(5, 0.12);
          juice.flash('#2EEAA3', 0.15);
          haptics.comboFeedback(s.consecutiveSpeed);
          sounds.combo(s.consecutiveSpeed);
        } else if (hesitation < 1.0) {
          s.feedbackText = `${t(UI_STRINGS.ok)} ×${s.multiplier.toFixed(1)}`;
          spawnParticles(tk.endX, tk.endY, 10, 245, 166, 35);
          haptics.tapFeedback();
          sounds.pop();
        } else {
          s.feedbackText = t(UI_STRINGS.tooSlow);
          haptics.failFeedback();
        }
        s.feedbackTimer = 0.8;
        s.floatingTexts.push({ text: `+${tokenScore.toFixed(1)}`, x: tk.endX, y: tk.endY - 30, life: 0.8, color: hesitation < 0.5 ? '#2EEAA3' : '#F5A623', size: 22 });

        if (s.tokensGiven < TOTAL_TOKENS) setTimeout(() => resetToken(w, h), 180);
        setDisplayScore(Math.round(s.score));
      }
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta; p.y += p.vy * delta;
      p.vy += 100 * delta;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      p.life -= delta;
      p.alpha = (p.life / p.maxLife) * 0.6;
      if (p.life <= 0) p.active = false;
    }
    // Shockwaves
    for (let i = s.shockwaves.length - 1; i >= 0; i--) {
      const sw = s.shockwaves[i];
      sw.life -= delta;
      const prog = 1 - sw.life / sw.maxLife;
      sw.radius = 15 + (sw.maxRadius - 15) * prog;
      if (sw.life <= 0) s.shockwaves.splice(i, 1);
    }
    // Floating texts
    for (let i = s.floatingTexts.length - 1; i >= 0; i--) {
      const ft = s.floatingTexts[i];
      ft.y -= 50 * delta; ft.life -= delta;
      if (ft.life <= 0) s.floatingTexts.splice(i, 1);
    }
    if (s.feedbackTimer > 0) s.feedbackTimer -= delta;
    juice.update(delta);

    // Game over
    if ((s.timeLeft <= 0 || s.tokensGiven >= TOTAL_TOKENS) && phase === 'playing') {
      haptics.successFeedback(); sounds.success();
      setPhase('ended'); setDisplayScore(Math.round(s.score));
      return;
    }

    // --- RENDER ---
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0d2818');
    bgGrad.addColorStop(0.4, '#122a15');
    bgGrad.addColorStop(1, '#0a1f0d');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    juice.applyShake(ctx);

    // Floating leaves (subtle bg)
    for (const leaf of s.leaves) {
      const lx = leaf.x * w + Math.sin(elapsed * leaf.speed * 10 + leaf.phase) * 15;
      const ly = leaf.y * h;
      ctx.save();
      ctx.translate(lx, ly);
      ctx.rotate(leaf.rotation + elapsed * 0.3);
      ctx.fillStyle = `rgba(46,234,163,0.05)`;
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Branches
    ctx.strokeStyle = '#4a3015';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-5, cy + 48);
    ctx.quadraticCurveTo(w * 0.15, cy + 42, w * 0.35, cy + 52);
    ctx.stroke();
    // Bark texture
    ctx.strokeStyle = '#3a2510';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.05, cy + 46); ctx.lineTo(w * 0.1, cy + 44);
    ctx.moveTo(w * 0.18, cy + 43); ctx.lineTo(w * 0.22, cy + 45);
    ctx.stroke();

    ctx.strokeStyle = '#4a3015';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(w + 5, cy + 48);
    ctx.quadraticCurveTo(w * 0.85, cy + 42, w * 0.65, cy + 52);
    ctx.stroke();

    // Parrots
    drawParrot(ctx, w * 0.15, cy, 'right', s.leftParrotBob, '#e74c3c', '#c0392b', elapsed * 4);
    drawParrot(ctx, w * 0.85, cy, 'left', s.rightParrotBob, '#3498db', '#2980b9', elapsed * 4 + 1.5);

    // Trail particles with glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      const frac = p.life / p.maxLife;
      ctx.globalAlpha = p.alpha;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * frac, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue}, 90%, 60%, ${p.alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // Shockwaves
    for (const sw of s.shockwaves) {
      const alpha = sw.life / sw.maxLife;
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color.replace(/[\d.]+\)$/, `${alpha * 0.7})`);
      ctx.lineWidth = 3 * alpha;
      ctx.stroke();
    }

    // Token
    if (tk.active) {
      ctx.save();
      ctx.translate(tk.x, tk.y);

      // Outer glow
      juice.drawGlow(ctx, 0, 0, 45, '#F5A623', 0.25);

      ctx.rotate(s.tokenAngle);

      // Token body
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      const tokenGrad = ctx.createRadialGradient(-6, -6, 0, 0, 0, 20);
      tokenGrad.addColorStop(0, '#FFE866');
      tokenGrad.addColorStop(0.5, '#F5A623');
      tokenGrad.addColorStop(1, '#B8780F');
      ctx.fillStyle = tokenGrad;
      ctx.fill();

      // Rim
      ctx.beginPath();
      ctx.arc(0, 0, 20, 0, Math.PI * 2);
      ctx.strokeStyle = '#D4910A';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Inner ring
      ctx.beginPath();
      ctx.arc(0, 0, 13, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Number
      ctx.rotate(-s.tokenAngle);
      ctx.font = "bold 13px 'Outfit', 'DM Sans', sans-serif";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#6B4000';
      ctx.fillText(`${s.tokensGiven + 1}`, 0, 1);

      ctx.restore();
    }

    // Particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.globalAlpha = alpha;
      if (p.type === 'line') {
        ctx.strokeStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.lineWidth = p.size * alpha * 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${p.r},${p.g},${p.b})`;
        ctx.fill();
      }
    }
    ctx.restore();

    // Floating texts
    for (const ft of s.floatingTexts) {
      const alpha = Math.min(1, ft.life * 2.5);
      ctx.globalAlpha = alpha;
      juice.drawNeonText(ctx, ft.text, ft.x, ft.y, ft.color, ft.size);
      ctx.globalAlpha = 1;
    }

    // Feedback text
    if (s.feedbackTimer > 0) {
      const alpha = Math.min(1, s.feedbackTimer * 2);
      ctx.globalAlpha = alpha;
      const fbColor = s.feedbackText === t(UI_STRINGS.tooSlow) ? '#FF4444' : '#2EEAA3';
      juice.drawNeonText(ctx, s.feedbackText, cx, cy - 90, fbColor, 26);
      ctx.globalAlpha = 1;
    }

    // Token counter dots
    for (let i = 0; i < TOTAL_TOKENS; i++) {
      const dotX = cx - (TOTAL_TOKENS * 14) / 2 + i * 14 + 7;
      const dotY = h - 50;
      ctx.beginPath();
      ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
      if (i < s.tokensGiven) {
        ctx.fillStyle = '#F5A623';
        ctx.shadowColor = '#F5A623';
        ctx.shadowBlur = 6;
      } else {
        ctx.fillStyle = 'rgba(255,255,255,0.15)';
        ctx.shadowBlur = 0;
      }
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // Multiplier
    if (s.multiplier > 1) {
      juice.drawNeonText(ctx, `×${s.multiplier.toFixed(1)}`, cx, 78, '#2EEAA3', 24);
    }

    // Flash overlay
    juice.drawFlash(ctx, w, h);

    ctx.restore(); // end shake

    // Timer bar (outside shake)
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, 0, w, 5);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerGrad = ctx.createLinearGradient(0, 0, w * timerFrac, 0);
    timerGrad.addColorStop(0, s.timeLeft < 3 ? '#FF4444' : '#F5A623');
    timerGrad.addColorStop(1, s.timeLeft < 3 ? '#FF8800' : '#FFD700');
    ctx.fillStyle = timerGrad;
    ctx.fillRect(0, 0, w * timerFrac, 5);

    // Timer + Score
    ctx.font = "bold 20px 'Outfit', 'DM Sans', sans-serif";
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 3 ? '#FF4444' : '#FFF';
    ctx.shadowColor = s.timeLeft < 3 ? '#FF4444' : '#F5A623';
    ctx.shadowBlur = 6;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 16, 34);
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.fillStyle = '#FFF';
    ctx.shadowColor = '#F5A623';
    ctx.shadowBlur = 6;
    ctx.fillText(`${Math.round(s.score)}`, 16, 34);
    ctx.shadowBlur = 0;
    ctx.font = "11px 'Outfit', 'DM Sans', sans-serif";
    ctx.fillStyle = '#667';
    ctx.fillText(t(UI_STRINGS.pts), 16 + ctx.measureText(`${Math.round(s.score)}`).width + 4, 34);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, spawnTrail, resetToken, drawParrot, t]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.tokensGiven = 0; s.score = 0; s.multiplier = 1;
      s.consecutiveSpeed = 0; s.timeLeft = GAME_DURATION;
      s.floatingTexts = []; s.shockwaves = [];
      resetToken(window.innerWidth, window.innerHeight);
      gameLoop.reset(); gameLoop.start();
    }
  }, [phase, gameLoop, resetToken]);

  useEffect(() => { if (phase === 'ended') gameLoop.stop(); }, [phase, gameLoop]);
  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(8px)',
        }}>
          <div style={{ color: '#AAB', fontSize: 16, letterSpacing: 4, marginBottom: 8, textTransform: 'uppercase' }}>{t(GAME_NAMES['13'])}</div>
          <div style={{
            color: '#F5A623', fontSize: 56, fontWeight: 'bold', marginBottom: 4,
            textShadow: '0 0 30px rgba(245,166,35,0.5)',
          }}>{displayScore}</div>
          <div style={{ color: '#667', fontSize: 14, marginBottom: 4 }}>{state.current.tokensGiven}/{TOTAL_TOKENS} {t(UI_STRINGS.tokens)}</div>
          <div style={{ color: '#556', fontSize: 13, marginBottom: 32 }}>{t(UI_STRINGS.parrotsShareWithoutHesitation)}</div>
          <button onClick={() => onComplete(state.current.score)} style={{
            background: 'linear-gradient(135deg, #F5A623, #FFD700)', color: '#0A0F1C', border: 'none',
            padding: '14px 48px', borderRadius: 14, fontSize: 18, fontWeight: 'bold', cursor: 'pointer',
            marginBottom: 12, boxShadow: '0 0 20px rgba(245,166,35,0.3)',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={onBack} style={{
            background: 'transparent', color: '#667', border: '1px solid #334',
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
          }}>{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={onBack} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.08)',
          color: '#AAB', border: 'none', borderRadius: 10, padding: '8px 16px',
          fontSize: 13, cursor: 'pointer', zIndex: 10, backdropFilter: 'blur(4px)',
        }}>{`← ${t(UI_STRINGS.back)}`}</button>
      )}
    </div>
  );
}
