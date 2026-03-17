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
const GAME_DURATION = 45;
const ENERGY_DRAIN_RATE = 18;
const ENERGY_REGEN_RATE = 12;
const SCORE_RATE = 10;
const POOL_SIZE = 100;

export default function GameTorpeur({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const lastWarningTimeRef = useRef(-1);
  const torporSoundCooldownRef = useRef(0);

  const state = useRef({
    timeLeft: GAME_DURATION,
    score: 0,
    energy: 80,
    isFlying: true,
    torpor: false,
    birdY: 0,
    birdVy: 0,
    wingAngle: 0,
    temperature: 37,
    bgTransition: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    snowflakes: Array(40).fill(null).map(() => ({
      x: Math.random() * 1000,
      y: Math.random() * 800,
      size: 1 + Math.random() * 3,
      speed: 20 + Math.random() * 40,
      wobble: Math.random() * Math.PI * 2,
      wobbleSpeed: 0.5 + Math.random() * 2,
    })),
    stars: Array(30).fill(null).map(() => ({
      x: Math.random() * 1000,
      y: Math.random() * 400,
      size: 0.5 + Math.random() * 2,
      twinkle: Math.random() * Math.PI * 2,
    })),
    energyPulse: 0,
    torpidFlash: 0,
    flyingScoreAccum: 0,
    breathAlpha: 0,
    breathPhase: 0,
  });

  const spawnParticles = useCallback((cx, cy, count, r, g, b, type) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 20;
        p.y = cy + (Math.random() - 0.5) * 10;
        const angle = Math.random() * Math.PI * 2;
        const speed = 30 + Math.random() * 80;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 1.5 + Math.random() * 3;
        p.type = type || 'dot';
        spawned++;
      }
    }
  }, []);

  const handleHoldStart = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        sounds.countdown(true);
        haptics.tapFeedback();
      }
      return;
    }
    const s = state.current;
    s.torpor = true;
    s.isFlying = false;
    s.torpidFlash = 0.3;
    // Juice: flash blue when entering torpor
    juice.flash('#0066FF', 0.3);
    juice.shake(4, 0.15);
    sounds.whoosh();
    haptics.impactFeedback();
  }, [phase, juice, sounds, haptics]);

  const handleHoldEnd = useCallback(() => {
    if (phase !== 'playing') return;
    const s = state.current;
    s.torpor = false;
    s.isFlying = true;
    s.torpidFlash = 0.3;
    // Juice: flash warm when resuming flight
    juice.flash('#FF9900', 0.3);
    juice.shake(3, 0.1);
    sounds.wingflap();
    haptics.tapFeedback();
  }, [phase, juice, sounds, haptics]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') {
      setPhase('playing');
      sounds.countdown(true);
      haptics.tapFeedback();
    }
  }, [phase, sounds, haptics]);

  useTouch(canvasRef, { onTap: handleTap, onHoldStart: handleHoldStart, onHoldEnd: handleHoldEnd });

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

    // Apply screen shake
    juice.applyShake(ctx);

    const s = state.current;
    const cx = w / 2;
    const cy = h / 2;

    if (phase === 'ready') {
      // Warm sunset bg
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#1a0a2e');
      bgGrad.addColorStop(0.3, '#4a1a3e');
      bgGrad.addColorStop(0.6, '#c06030');
      bgGrad.addColorStop(1, '#e8a040');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Animated hummingbird
      const readyBirdY = cy - 20 + Math.sin(elapsed * 2) * 10;
      ctx.save();
      ctx.translate(cx, readyBirdY);
      ctx.beginPath();
      ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#F5A623';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(24, -4, 9, 0, Math.PI * 2);
      ctx.fillStyle = '#F5A623';
      ctx.fill();
      const wAngle = Math.sin(elapsed * 15) * 20;
      ctx.globalAlpha = 0.6;
      ctx.beginPath();
      ctx.moveTo(-5, -4);
      ctx.quadraticCurveTo(-22, -30 + wAngle, -38, -12 + wAngle * 0.5);
      ctx.quadraticCurveTo(-25, -6, -5, -4);
      ctx.fillStyle = '#ffcc66';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-5, 4);
      ctx.quadraticCurveTo(-22, 30 - wAngle, -38, 12 - wAngle * 0.5);
      ctx.quadraticCurveTo(-25, 6, -5, 4);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();

      // Glow around the bird on ready screen
      juice.drawGlow(ctx, cx, readyBirdY, 60, '#F5A623', 0.3);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['02']), cx, cy + 50, COLORS.gold, 28);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.cyan;
      ctx.shadowColor = COLORS.cyan;
      ctx.shadowBlur = 8;
      ctx.fillText('Hummingbird enters torpor at night:', cx, cy + 82);
      ctx.fillText('3.3\u00B0C, -96% metabolism', cx, cy + 106);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText(t(UI_STRINGS.holdToRest) + ', ' + t(UI_STRINGS.releaseToFly), cx, cy + 145);
      ctx.fillText(t(UI_STRINGS.dontRunOutOfEnergy), cx, cy + 168);

      // Neon pulsing "TAP TO START"
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, cy + 210, COLORS.mint, 20);
      ctx.globalAlpha = 1;

      // Bloom on ready screen
      juice.applyBloom(ctx, w, h, 0.08);

      juice.update(delta);
      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);

    // Energy management
    if (s.isFlying) {
      s.energy -= ENERGY_DRAIN_RATE * delta;
      s.score += SCORE_RATE * delta;
      s.flyingScoreAccum += SCORE_RATE * delta;
      s.bgTransition += (0 - s.bgTransition) * delta * 2;
      s.temperature += (37 - s.temperature) * delta * 3;
    } else {
      // Torpor
      s.energy += ENERGY_REGEN_RATE * delta;
      s.bgTransition += (1 - s.bgTransition) * delta * 2;
      s.temperature += (3.3 - s.temperature) * delta * 2;
    }
    s.energy = Math.max(0, Math.min(100, s.energy));

    // Wing animation
    if (s.isFlying) {
      s.wingAngle += delta * 25;
      s.birdVy = Math.sin(elapsed * 3) * 1;
    } else {
      s.wingAngle += delta * 0.5;
      s.birdVy += (0 - s.birdVy) * delta * 2;
    }
    s.birdY += s.birdVy;

    // Energy pulse
    if (s.energy < 20) {
      s.energyPulse = 0.5 + Math.sin(elapsed * 8) * 0.5;
      // Warning haptics and sound when energy is critically low
      if (s.energy < 10) {
        torporSoundCooldownRef.current -= delta;
        if (torporSoundCooldownRef.current <= 0) {
          haptics.warningFeedback();
          sounds.tick();
          torporSoundCooldownRef.current = 1.0;
        }
      }
    } else {
      s.energyPulse = 0;
    }

    // Torpid flash
    if (s.torpidFlash > 0) s.torpidFlash -= delta;

    // Breath in torpor
    if (s.torpor) {
      s.breathPhase += delta * 0.8;
      s.breathAlpha = Math.max(0, Math.sin(s.breathPhase) * 0.3);
    } else {
      s.breathAlpha = 0;
    }

    // Snowflakes in cold mode
    const coldIntensity = s.bgTransition;
    for (const sf of s.snowflakes) {
      if (coldIntensity < 0.1) continue;
      sf.y += sf.speed * delta * coldIntensity;
      sf.x += Math.sin(elapsed * sf.wobbleSpeed + sf.wobble) * 15 * delta;
      if (sf.y > h + 10) {
        sf.y = -10;
        sf.x = Math.random() * w;
      }
    }

    // Flying particles
    if (s.isFlying && Math.random() < delta * 15) {
      spawnParticles(cx - 30, cy + s.birdY, 1, 255, 180, 50, 'dot');
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Warning sound on last 5 seconds
    if (s.timeLeft <= 5 && s.timeLeft > 0) {
      const sec = Math.ceil(s.timeLeft);
      if (sec !== lastWarningTimeRef.current) {
        lastWarningTimeRef.current = sec;
        sounds.tick();
        haptics.warningFeedback();
      }
    }

    // Game over conditions
    if (s.energy <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(Math.round(s.score));
      // Juice on energy depletion
      juice.shake(12, 0.5);
      juice.flash('#EF4444', 0.5);
      sounds.fail();
      haptics.failFeedback();
      return;
    }
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(Math.round(s.score));
      // Juice on time's up
      juice.flash('#F5A623', 0.4);
      sounds.success();
      haptics.successFeedback();
      return;
    }

    setDisplayScore(Math.round(s.score));

    // --- RENDER ---
    const bt = s.bgTransition;

    // Background: interpolate warm <-> cold
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    const warmTop = [26, 10, 46];
    const warmMid = [192, 96, 48];
    const warmBot = [232, 160, 64];
    const coldTop = [5, 10, 30];
    const coldMid = [10, 30, 60];
    const coldBot = [20, 40, 80];

    const lerp = (a, b, t2) => a + (b - a) * t2;
    const topR = lerp(warmTop[0], coldTop[0], bt);
    const topG = lerp(warmTop[1], coldTop[1], bt);
    const topB = lerp(warmTop[2], coldTop[2], bt);
    const midR = lerp(warmMid[0], coldMid[0], bt);
    const midG = lerp(warmMid[1], coldMid[1], bt);
    const midB = lerp(warmMid[2], coldMid[2], bt);
    const botR = lerp(warmBot[0], coldBot[0], bt);
    const botG = lerp(warmBot[1], coldBot[1], bt);
    const botB = lerp(warmBot[2], coldBot[2], bt);

    bgGrad.addColorStop(0, `rgb(${topR},${topG},${topB})`);
    bgGrad.addColorStop(0.5, `rgb(${midR},${midG},${midB})`);
    bgGrad.addColorStop(1, `rgb(${botR},${botG},${botB})`);
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Stars (visible in cold/night)
    if (bt > 0.2) {
      for (const star of s.stars) {
        const twinkle = 0.3 + Math.sin(elapsed * 2 + star.twinkle) * 0.7;
        ctx.beginPath();
        ctx.arc(star.x % w, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${twinkle * (bt - 0.2) * 1.25})`;
        ctx.fill();
      }
    }

    // Sun/Moon
    const celestialY = 60 + bt * 40;
    const celestialR = 30;
    if (bt < 0.5) {
      // Sun with glow
      const sunGrad = ctx.createRadialGradient(w * 0.8, celestialY, 0, w * 0.8, celestialY, celestialR * 2);
      sunGrad.addColorStop(0, `rgba(255,200,50,${1 - bt * 2})`);
      sunGrad.addColorStop(0.5, `rgba(255,150,30,${(1 - bt * 2) * 0.5})`);
      sunGrad.addColorStop(1, 'rgba(255,100,0,0)');
      ctx.fillStyle = sunGrad;
      ctx.beginPath();
      ctx.arc(w * 0.8, celestialY, celestialR * 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.8, celestialY, celestialR * (1 - bt), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,220,100,${1 - bt * 2})`;
      ctx.fill();
      // Additive sun glow
      juice.drawGlow(ctx, w * 0.8, celestialY, celestialR * 3, '#FFAA00', (1 - bt * 2) * 0.2);
    } else {
      // Moon with glow
      const moonAlpha = (bt - 0.5) * 2;
      ctx.beginPath();
      ctx.arc(w * 0.8, celestialY, celestialR * 0.8, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(200,210,230,${moonAlpha * 0.8})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(w * 0.8 - 5, celestialY - 5, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(170,180,200,${moonAlpha * 0.3})`;
      ctx.fill();
      // Additive moon glow
      juice.drawGlow(ctx, w * 0.8, celestialY, celestialR * 2, '#AABBFF', moonAlpha * 0.25);
    }

    // Snowflakes
    if (bt > 0.1) {
      for (const sf of s.snowflakes) {
        ctx.beginPath();
        ctx.arc(sf.x, sf.y, sf.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(200,220,255,${bt * 0.4})`;
        ctx.fill();
      }
    }

    // Vignette in torpor
    if (bt > 0.3) {
      const vigGrad = ctx.createRadialGradient(cx, cy, h * 0.2, cx, cy, h * 0.7);
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, `rgba(0,10,30,${(bt - 0.3) * 0.6})`);
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, w, h);
    }

    // Torpid flash
    if (s.torpidFlash > 0) {
      const flashColor = s.torpor ? 'rgba(0,100,255,' : 'rgba(255,150,0,';
      ctx.fillStyle = flashColor + (s.torpidFlash) + ')';
      ctx.fillRect(0, 0, w, h);
    }

    // Branch for perching during torpor
    if (!s.isFlying) {
      ctx.strokeStyle = '#5a3a1a';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(cx - 80, cy + 20);
      ctx.quadraticCurveTo(cx, cy + 15, cx + 80, cy + 25);
      ctx.stroke();

      // Small leaves
      for (let i = 0; i < 5; i++) {
        const lx = cx - 60 + i * 30;
        const ly = cy + 18 + Math.sin(i * 1.5) * 3;
        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(-0.5 + i * 0.2);
        ctx.beginPath();
        ctx.ellipse(0, -8, 4, 8, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(34,100,34,${0.3 + bt * 0.3})`;
        ctx.fill();
        ctx.restore();
      }
    }

    // Hummingbird
    const bx = cx;
    const by = cy + s.birdY;

    // Glow around the bird (warm when flying, cool when torpid)
    if (s.isFlying) {
      juice.drawGlow(ctx, bx, by, 50, '#F5A623', 0.25);
    } else {
      juice.drawGlow(ctx, bx, by, 40, '#0066FF', 0.15 + Math.sin(elapsed * 1.5) * 0.05);
    }

    ctx.save();
    ctx.translate(bx, by);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
    const bodyColor = s.isFlying ? '#F5A623' : '#6090c0';
    const bodyGrad = ctx.createLinearGradient(-22, -13, 22, 13);
    bodyGrad.addColorStop(0, bodyColor);
    bodyGrad.addColorStop(1, s.isFlying ? '#c07818' : '#405870');
    ctx.fillStyle = bodyGrad;
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(24, -4, 9, 0, Math.PI * 2);
    ctx.fillStyle = bodyColor;
    ctx.fill();

    // Eye
    if (s.isFlying) {
      ctx.beginPath();
      ctx.arc(28, -6, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = '#000';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(28.5, -6.5, 0.8, 0, Math.PI * 2);
      ctx.fillStyle = '#fff';
      ctx.fill();
    } else {
      // Closed eyes in torpor
      ctx.beginPath();
      ctx.moveTo(25, -6);
      ctx.lineTo(31, -6);
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    // Beak
    ctx.beginPath();
    ctx.moveTo(32, -4);
    ctx.lineTo(46, -2);
    ctx.lineTo(32, -1);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();

    // Breath bubble in torpor
    if (s.torpor && s.breathAlpha > 0.05) {
      ctx.beginPath();
      ctx.arc(48, -5, 3 + s.breathAlpha * 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180,200,255,${s.breathAlpha})`;
      ctx.fill();
    }

    // Tail
    ctx.beginPath();
    ctx.moveTo(-22, 0);
    ctx.lineTo(-38, -6);
    ctx.lineTo(-35, 0);
    ctx.lineTo(-38, 6);
    ctx.closePath();
    ctx.fillStyle = s.isFlying ? '#c07818' : '#405870';
    ctx.fill();

    // Wings
    const wingY = Math.sin(s.wingAngle) * (s.isFlying ? 22 : 3);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(-25, -35 + wingY, -42, -15 + wingY * 0.6);
    ctx.quadraticCurveTo(-30, -8, -4, -4);
    ctx.fillStyle = s.isFlying ? '#ffcc66' : '#7090b0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(-25, 35 - wingY, -42, 15 - wingY * 0.6);
    ctx.quadraticCurveTo(-30, 8, -4, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

    // Zzz in torpor
    if (s.torpor) {
      const zzAlpha = 0.3 + Math.sin(elapsed * 1.5) * 0.2;
      ctx.font = `bold 16px ${FONT_FAMILY}`;
      ctx.fillStyle = `rgba(150,180,255,${zzAlpha})`;
      ctx.shadowColor = '#6699FF';
      ctx.shadowBlur = 8;
      ctx.fillText('z', 35, -20 - Math.sin(elapsed) * 5);
      ctx.font = `bold 12px ${FONT_FAMILY}`;
      ctx.fillText('z', 42, -28 - Math.sin(elapsed + 0.5) * 5);
      ctx.font = `bold 9px ${FONT_FAMILY}`;
      ctx.fillText('z', 48, -34 - Math.sin(elapsed + 1) * 5);
      ctx.shadowBlur = 0;
    }

    ctx.restore();

    // Particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha * 0.6})`;
      ctx.fill();
    }
    ctx.restore();

    // --- HUD ---
    // Energy bar
    const barW = w - 60;
    const barH = 14;
    const barX = 30;
    const barY = h - 50;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW, barH, 7);
    ctx.fill();

    const energyFrac = s.energy / 100;
    const energyColor = s.energy < 20 ? `rgba(239,68,68,${0.7 + s.energyPulse * 0.3})`
      : s.isFlying ? '#F5A623' : '#00BFFF';
    ctx.fillStyle = energyColor;
    ctx.beginPath();
    ctx.roundRect(barX, barY, barW * energyFrac, barH, 7);
    ctx.fill();

    // Glow on energy bar when low
    if (s.energy < 20) {
      juice.drawGlow(ctx, barX + barW * energyFrac * 0.5, barY + barH / 2, 40, '#EF4444', s.energyPulse * 0.2);
    }

    // Neon energy label
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.shadowColor = s.energy < 20 ? COLORS.red : COLORS.white;
    ctx.shadowBlur = s.energy < 20 ? 10 : 4;
    ctx.fillText(t(UI_STRINGS.energy) + ': ' + Math.round(s.energy) + '%', cx, barY - 6);
    ctx.shadowBlur = 0;

    // Temperature with neon glow
    juice.drawNeonText(ctx, `${s.temperature.toFixed(1)}\u00B0C`, cx, barY + barH + 18, s.torpor ? COLORS.cyan : COLORS.gold, 14);

    // State indicator - neon text
    if (s.isFlying) {
      juice.drawNeonText(ctx, t(UI_STRINGS.flying), cx, 80, COLORS.gold, 18);
    } else {
      juice.drawNeonText(ctx, 'TORPOR', cx, 80, COLORS.cyan, 18);
      // Frost overlay on edges
      ctx.fillStyle = `rgba(150,200,255,${bt * 0.08})`;
      ctx.fillRect(0, 0, 30, h);
      ctx.fillRect(w - 30, 0, 30, h);
      ctx.fillRect(0, 0, w, 20);
      ctx.fillRect(0, h - 20, w, 20);
    }

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : (s.isFlying ? COLORS.gold : COLORS.cyan);
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Glow at end of timer bar
    if (s.timeLeft < 5) {
      juice.drawGlow(ctx, w * timerFrac, 2, 20, COLORS.red, 0.4);
    }

    // Timer + score - neon
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, s.timeLeft < 5 ? COLORS.red : COLORS.white, 24);

    ctx.save();
    ctx.textAlign = 'left';
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.shadowColor = COLORS.gold;
    ctx.shadowBlur = 12;
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${Math.round(s.score)}`, 20, 40);
    ctx.shadowBlur = 0;
    ctx.restore();

    // Screen flash overlay from juice
    juice.drawFlash(ctx, w, h);

    // Bloom effect - subtle during flight, more during torpor
    const bloomIntensity = s.isFlying ? 0.06 : 0.1 * bt;
    juice.applyBloom(ctx, w, h, bloomIntensity);

    // Update juice state
    juice.update(delta);

    ctx.restore();
  }, [phase, spawnParticles, juice, sounds, haptics]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0;
      s.energy = 80;
      s.isFlying = true;
      s.torpor = false;
      s.timeLeft = GAME_DURATION;
      s.bgTransition = 0;
      s.temperature = 37;
      s.birdY = 0;
      s.birdVy = 0;
      lastWarningTimeRef.current = -1;
      torporSoundCooldownRef.current = 0;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const isEnergyDeath = state.current.energy <= 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.6)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: isEnergyDeath ? COLORS.red : COLORS.white,
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 12,
            textShadow: isEnergyDeath
              ? `0 0 20px ${COLORS.red}, 0 0 40px ${COLORS.red}`
              : `0 0 15px ${COLORS.gold}, 0 0 30px ${COLORS.gold}`,
          }}>
            {isEnergyDeath ? 'Out of Energy!' : "Time's Up!"}
          </div>
          <div style={{
            color: COLORS.gold,
            fontSize: 48,
            fontWeight: 'bold',
            marginBottom: 8,
            textShadow: `0 0 20px ${COLORS.gold}, 0 0 40px ${COLORS.gold}, 0 0 60px ${COLORS.gold}`,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray,
            fontSize: 16,
            marginBottom: 4,
            textShadow: `0 0 6px ${COLORS.gray}`,
          }}>
            flying time score
          </div>
          <div style={{
            color: COLORS.cyan,
            fontSize: 14,
            marginBottom: 24,
            textShadow: `0 0 10px ${COLORS.cyan}`,
          }}>
            Hummingbirds drop to 3.3\u00B0C in torpor!
          </div>
          <button onClick={() => {
            sounds.chime();
            haptics.tapFeedback();
            onComplete(Math.round(state.current.score));
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.gold}, #c07818)`,
            color: COLORS.primary,
            border: 'none',
            padding: '14px 40px',
            borderRadius: 12,
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.gold}80, 0 4px 15px rgba(0,0,0,0.3)`,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}>Continue</button>
          <button onClick={() => {
            sounds.tick();
            haptics.tapFeedback();
            onBack();
          }} style={{
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
            boxShadow: `0 0 10px rgba(255,255,255,0.05)`,
            textShadow: `0 0 6px ${COLORS.gray}`,
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
