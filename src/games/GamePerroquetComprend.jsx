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
const BASE_CUPS = 4;
const CORRECT_POINTS = 10;
const WRONG_POINTS = 5;
const CUPS_INCREASE_EVERY = 3;
const SHUFFLE_DURATION = 1.2;
const REVEAL_DURATION = 0.8;
const HINT_DURATION = 1.0;
const CUP_WIDTH = 52;
const CUP_HEIGHT = 60;

const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";

export default function GamePerroquetComprend({ onComplete, onBack }) {
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
    streak: 0,
    bestStreak: 0,
    correctCount: 0,
    wrongCount: 0,
    numCups: BASE_CUPS,
    rewardCup: 0,
    roundPhase: 'hint', // hint, shuffle, choose, reveal
    roundTimer: 0,
    cups: [],
    shufflePairs: [],
    shuffleIndex: 0,
    shuffleT: 0,
    revealedCup: -1,
    revealCorrect: false,
    cupPositions: [], // {x,y} computed
    hintGlows: [], // intensity per cup
    parrotMood: 'neutral', // neutral, happy, sad
    parrotBob: 0,
    parrotX: 0,
    parrotY: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    flashAlpha: 0,
    flashColor: [0, 0, 0],
    lastWarningSecond: -1,
  });

  const initRound = useCallback(() => {
    const s = state.current;
    s.numCups = BASE_CUPS + Math.floor(s.correctCount / CUPS_INCREASE_EVERY);
    if (s.numCups > 8) s.numCups = 8;
    s.rewardCup = Math.floor(Math.random() * s.numCups);
    s.cups = Array(s.numCups).fill(0).map((_, i) => i);
    s.hintGlows = Array(s.numCups).fill(0);
    // Reward cup gets strong hint, neighbors get weaker
    s.hintGlows[s.rewardCup] = 1.0;
    if (s.rewardCup > 0) s.hintGlows[s.rewardCup - 1] = 0.3;
    if (s.rewardCup < s.numCups - 1) s.hintGlows[s.rewardCup + 1] = 0.3;
    s.roundPhase = 'hint';
    s.roundTimer = 0;
    s.revealedCup = -1;
    s.revealCorrect = false;
    // Pre-generate shuffle sequence
    const numShuffles = 3 + Math.floor(s.correctCount / 2);
    s.shufflePairs = [];
    for (let k = 0; k < Math.min(numShuffles, 10); k++) {
      let a = Math.floor(Math.random() * s.numCups);
      let b = Math.floor(Math.random() * s.numCups);
      while (b === a) b = Math.floor(Math.random() * s.numCups);
      s.shufflePairs.push([a, b]);
    }
    s.shuffleIndex = 0;
    s.shuffleT = 0;
  }, []);

  const spawnParticles = useCallback((cx, cy, count, color) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 20;
        p.y = cy + (Math.random() - 0.5) * 20;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2;
        const speed = 50 + Math.random() * 120;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = color[0]; p.g = color[1]; p.b = color[2];
        p.size = 2 + Math.random() * 3;
        p.type = Math.random() > 0.5 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const getCupPositions = useCallback((w, h, numCups) => {
    const positions = [];
    const totalW = numCups * (CUP_WIDTH + 16) - 16;
    const startX = (w - totalW) / 2 + CUP_WIDTH / 2;
    const cupY = h * 0.48;
    for (let i = 0; i < numCups; i++) {
      positions.push({ x: startX + i * (CUP_WIDTH + 16), y: cupY });
    }
    return positions;
  }, []);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        haptics.tapFeedback();
        sounds.pop();
        setPhase('playing');
      }
      return;
    }
    const s = state.current;
    if (s.roundPhase !== 'choose') return;

    // Check which cup was tapped
    for (let i = 0; i < s.cupPositions.length; i++) {
      const cp = s.cupPositions[i];
      const dx = x - cp.x;
      const dy = y - cp.y;
      if (Math.abs(dx) < CUP_WIDTH / 2 + 8 && Math.abs(dy) < CUP_HEIGHT / 2 + 8) {
        s.revealedCup = i;
        // Find the actual cup index at visual position i
        const actualCup = s.cups[i];
        s.revealCorrect = (actualCup === s.rewardCup);

        if (s.revealCorrect) {
          s.score += CORRECT_POINTS * (1 + Math.floor(s.streak / 3));
          s.streak++;
          if (s.streak > s.bestStreak) s.bestStreak = s.streak;
          s.correctCount++;
          s.parrotMood = 'happy';
          s.flashAlpha = 0.25;
          s.flashColor = [46, 234, 163];
          spawnParticles(cp.x, cp.y, 12, [46, 234, 163]);
          sounds.chime();
          sounds.success();
          haptics.successFeedback();
          juice.flash('#2EEA A3', 0.4);
          if (s.streak >= 3) {
            sounds.combo(s.streak);
            haptics.comboFeedback(Math.min(s.streak, 5));
          }
        } else {
          s.score = Math.max(0, s.score - WRONG_POINTS);
          s.streak = 0;
          s.wrongCount++;
          s.parrotMood = 'sad';
          s.flashAlpha = 0.25;
          s.flashColor = [239, 68, 68];
          spawnParticles(cp.x, cp.y, 6, [239, 68, 68]);
          sounds.firecrackle();
          sounds.fail();
          haptics.failFeedback();
          juice.shake(10, 0.35);
          juice.flash('#EF4444', 0.5);
        }
        s.roundPhase = 'reveal';
        s.roundTimer = 0;
        haptics.impactFeedback();
        sounds.impact();
        return;
      }
    }
  }, [phase, sounds, haptics, juice, spawnParticles]);

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
    s.parrotX = cx;
    s.parrotY = h * 0.18;

    if (phase === 'ready') {
      const bg = ctx.createLinearGradient(0, 0, 0, h);
      bg.addColorStop(0, '#1c1a3a');
      bg.addColorStop(1, '#2c2a5a');
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['12']), cx, cy - 60, '#5BE0FF', 26);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('Parrots understand probability!', cx, cy - 10);
      ctx.fillText('Watch the hints, pick the right cup.', cx, cy + 16);
      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Tap the cup hiding the reward', cx, cy + 55);

      // Glow behind tap text
      juice.drawGlow(ctx, cx, cy + 110, 60, '#5BE0FF', 0.15 + Math.sin(elapsed * 4) * 0.1);

      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, cy + 110, '#FFFFFF', 20);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // --- UPDATE ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.parrotBob += delta * 3;
    s.flashAlpha = Math.max(0, s.flashAlpha - delta * 2);

    // Warning haptics at low time
    const currentSecond = Math.ceil(s.timeLeft);
    if (s.timeLeft <= 5 && s.timeLeft > 0 && currentSecond !== s.lastWarningSecond) {
      s.lastWarningSecond = currentSecond;
      haptics.warningFeedback();
      sounds.tick();
    }

    // Juice update
    juice.update(delta);

    // Round state machine
    s.roundTimer += delta;
    s.cupPositions = getCupPositions(w, h, s.numCups);

    if (s.roundPhase === 'hint') {
      if (s.roundTimer >= HINT_DURATION) {
        s.roundPhase = 'shuffle';
        s.roundTimer = 0;
        s.shuffleIndex = 0;
        s.shuffleT = 0;
      }
    } else if (s.roundPhase === 'shuffle') {
      const shuffleSpeed = SHUFFLE_DURATION / Math.max(1, s.shufflePairs.length);
      s.shuffleT += delta;
      if (s.shuffleT >= shuffleSpeed) {
        // Execute swap
        if (s.shuffleIndex < s.shufflePairs.length) {
          const [a, b] = s.shufflePairs[s.shuffleIndex];
          const tmp = s.cups[a];
          s.cups[a] = s.cups[b];
          s.cups[b] = tmp;
          s.shuffleIndex++;
          s.shuffleT = 0;
          sounds.whoosh();
          haptics.tapFeedback();
        }
      }
      if (s.shuffleIndex >= s.shufflePairs.length && s.shuffleT >= shuffleSpeed) {
        s.roundPhase = 'choose';
        s.roundTimer = 0;
        s.parrotMood = 'neutral';
        sounds.pop();
      }
    } else if (s.roundPhase === 'reveal') {
      if (s.roundTimer >= REVEAL_DURATION) {
        initRound();
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

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(s.score);
      haptics.heavyFeedback();
      sounds.impact();
      return;
    }

    // --- RENDER ---
    const bg = ctx.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#1c1a3a');
    bg.addColorStop(0.5, '#2c2a5a');
    bg.addColorStop(1, '#1c1a4a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    // Apply screen shake
    ctx.save();
    juice.applyShake(ctx);

    // Flash overlay (original)
    if (s.flashAlpha > 0.01) {
      ctx.fillStyle = `rgba(${s.flashColor[0]},${s.flashColor[1]},${s.flashColor[2]},${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay
    juice.drawFlash(ctx, w, h);

    // Draw parrot companion
    const pbob = Math.sin(s.parrotBob) * 5;
    ctx.save();
    ctx.translate(s.parrotX, s.parrotY + pbob);

    // Parrot glow
    const parrotGlowColor = s.parrotMood === 'happy' ? '#2EEAA3' : s.parrotMood === 'sad' ? '#EF4444' : '#5BE0FF';
    juice.drawGlow(ctx, 0, 0, 50, parrotGlowColor, 0.2);

    // Parrot body
    ctx.beginPath();
    ctx.ellipse(0, 0, 28, 22, 0, 0, Math.PI * 2);
    const pGrad = ctx.createRadialGradient(-5, -5, 4, 0, 0, 28);
    pGrad.addColorStop(0, '#5BE0FF');
    pGrad.addColorStop(1, '#00A0CC');
    ctx.fillStyle = pGrad;
    ctx.fill();

    // Eyes
    const eyeSize = s.parrotMood === 'sad' ? 4 : 5;
    ctx.beginPath();
    ctx.arc(-10, -5, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(-10, -5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -5, eyeSize, 0, Math.PI * 2);
    ctx.fillStyle = '#FFF';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(10, -5, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(-5, 5);
    ctx.lineTo(0, 14);
    ctx.lineTo(5, 5);
    ctx.closePath();
    ctx.fillStyle = '#F5A623';
    ctx.fill();

    // Mood expression
    if (s.parrotMood === 'happy') {
      ctx.beginPath();
      ctx.arc(0, 2, 12, 0, Math.PI);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();
    } else if (s.parrotMood === 'sad') {
      // Sad eyebrows
      ctx.beginPath();
      ctx.moveTo(-16, -12);
      ctx.lineTo(-6, -10);
      ctx.strokeStyle = '#FFF';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(16, -12);
      ctx.lineTo(6, -10);
      ctx.stroke();
    }

    // Tail feathers
    ctx.beginPath();
    ctx.moveTo(-20, 10);
    ctx.lineTo(-35, 20);
    ctx.lineTo(-28, 8);
    ctx.closePath();
    ctx.fillStyle = '#00A0CC';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(20, 10);
    ctx.lineTo(35, 20);
    ctx.lineTo(28, 8);
    ctx.closePath();
    ctx.fill();

    ctx.restore();

    // Draw table surface
    ctx.fillStyle = 'rgba(80,60,40,0.3)';
    ctx.fillRect(0, h * 0.48 + CUP_HEIGHT / 2 + 5, w, 4);

    // Draw cups
    for (let i = 0; i < s.numCups; i++) {
      const cp = s.cupPositions[i];
      if (!cp) continue;
      const isRevealed = s.roundPhase === 'reveal' && s.revealedCup === i;
      const isSwapping = s.roundPhase === 'shuffle' && s.shuffleIndex < s.shufflePairs.length;

      // Animate swap
      let drawX = cp.x;
      let drawY = cp.y;
      if (isSwapping) {
        const [a, b] = s.shufflePairs[s.shuffleIndex];
        const tVal = Math.min(1, s.shuffleT / (SHUFFLE_DURATION / Math.max(1, s.shufflePairs.length)));
        const ease = 0.5 - 0.5 * Math.cos(tVal * Math.PI);
        if (i === a) {
          const target = s.cupPositions[b];
          if (target) {
            drawX = cp.x + (target.x - cp.x) * ease;
            drawY = cp.y - Math.sin(tVal * Math.PI) * 25;
          }
        } else if (i === b) {
          const target = s.cupPositions[a];
          if (target) {
            drawX = cp.x + (target.x - cp.x) * ease;
            drawY = cp.y + Math.sin(tVal * Math.PI) * 25;
          }
        }
      }

      ctx.save();
      ctx.translate(drawX, drawY);

      // Hint glow during hint phase (enhanced with juice.drawGlow)
      if (s.roundPhase === 'hint' && s.hintGlows[i] > 0) {
        const glowIntensity = s.hintGlows[i] * (0.5 + 0.5 * Math.sin(elapsed * 8));
        // Use juice glow for stronger effect
        juice.drawGlow(ctx, 0, 0, CUP_WIDTH / 2 + 20, '#F5A623', glowIntensity * 0.5);
        // Original glow
        ctx.beginPath();
        ctx.ellipse(0, 0, CUP_WIDTH / 2 + 10, CUP_HEIGHT / 2 + 10, 0, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(245,166,35,${glowIntensity * 0.4})`;
        ctx.fill();
      }

      // Choose phase - glow on cups to indicate interactivity
      if (s.roundPhase === 'choose') {
        const pulseAlpha = 0.1 + 0.05 * Math.sin(elapsed * 5 + i);
        juice.drawGlow(ctx, 0, 0, CUP_WIDTH / 2 + 12, '#5BE0FF', pulseAlpha);
      }

      // Cup shape (trapezoid)
      if (isRevealed) {
        // Lifted cup
        ctx.globalAlpha = 0.4;
        ctx.translate(0, -20);
      }

      const topW = CUP_WIDTH * 0.65;
      const botW = CUP_WIDTH;
      const halfH = CUP_HEIGHT / 2;
      ctx.beginPath();
      ctx.moveTo(-topW / 2, -halfH);
      ctx.lineTo(topW / 2, -halfH);
      ctx.lineTo(botW / 2, halfH);
      ctx.lineTo(-botW / 2, halfH);
      ctx.closePath();
      const cupGrad = ctx.createLinearGradient(-botW / 2, 0, botW / 2, 0);
      cupGrad.addColorStop(0, '#8B4513');
      cupGrad.addColorStop(0.4, '#CD853F');
      cupGrad.addColorStop(0.6, '#CD853F');
      cupGrad.addColorStop(1, '#8B4513');
      ctx.fillStyle = cupGrad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      // Cup top rim
      ctx.beginPath();
      ctx.ellipse(0, -halfH, topW / 2, 5, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#A0622E';
      ctx.fill();

      ctx.globalAlpha = 1;

      // Show reward if revealed
      if (isRevealed) {
        ctx.translate(0, 20); // back to base
        // Draw star reward
        const actualCup = s.cups[i];
        if (actualCup === s.rewardCup) {
          // Glow behind star
          juice.drawGlow(ctx, 0, 5, 25, '#FFD700', 0.6);
          drawStar(ctx, 0, 5, 12, 6, 5, '#FFD700');
        } else {
          ctx.font = `bold 18px ${FONT_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.fillStyle = COLORS.red;
          ctx.fillText('X', 0, 10);
        }
      }

      // Choose phase hover indicator
      if (s.roundPhase === 'choose') {
        ctx.font = `10px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.fillText('?', 0, 4);
      }

      ctx.restore();
    }

    // Draw particles with additive blending
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

    // Restore from shake transform
    ctx.restore();

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);
    // Timer bar glow when low
    if (s.timeLeft < 5) {
      juice.drawGlow(ctx, w * timerFrac, 2, 30, '#EF4444', 0.3 + 0.2 * Math.sin(elapsed * 10));
    }

    // Timer text (neon)
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, s.timeLeft < 5 ? '#EF4444' : '#FFFFFF', 24);

    // Score (neon)
    juice.drawNeonText(ctx, `${s.score}`, 40, 40, '#FFD700', 22);
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText('pts', 40 + ctx.measureText(`${s.score}`).width / 2 + 18, 40);

    // Streak
    if (s.streak > 0) {
      juice.drawNeonText(ctx, t(UI_STRINGS.streak) + ': ' + s.streak + 'x', cx, h * 0.35, '#2EEAA3', 16);
      juice.drawGlow(ctx, cx, h * 0.35, 40, '#2EEAA3', 0.15);
    }

    // Cups count indicator
    ctx.font = `13px ${FONT_FAMILY}`;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText(`${s.numCups} cups`, cx, h * 0.65);

    // Round phase indicator (neon text)
    if (s.roundPhase === 'hint') {
      juice.drawNeonText(ctx, 'Watch carefully...', cx, h * 0.38, '#FFD700', 15);
    } else if (s.roundPhase === 'shuffle') {
      juice.drawNeonText(ctx, 'Shuffling...', cx, h * 0.38, '#5BE0FF', 15);
    } else if (s.roundPhase === 'choose') {
      juice.drawNeonText(ctx, 'Pick a cup!', cx, h * 0.38, '#FFFFFF', 15);
    }

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, getCupPositions, initRound, t]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION;
      s.score = 0;
      s.streak = 0;
      s.bestStreak = 0;
      s.correctCount = 0;
      s.wrongCount = 0;
      s.numCups = BASE_CUPS;
      s.parrotMood = 'neutral';
      s.flashAlpha = 0;
      s.lastWarningSecond = -1;
      for (const p of s.particles) p.active = false;
      initRound();
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop, initRound]);

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
            textShadow: '0 0 20px rgba(91,224,255,0.6), 0 0 40px rgba(91,224,255,0.3)',
          }}>
            {t(GAME_NAMES['12'])}
          </div>
          <div style={{
            color: COLORS.mint, fontSize: 18, marginBottom: 8,
            textShadow: '0 0 10px rgba(46,234,163,0.5)',
          }}>
            Correct: {state.current.correctCount} | Wrong: {state.current.wrongCount}
          </div>
          <div style={{
            color: COLORS.cyan, fontSize: 16, marginBottom: 4,
            textShadow: '0 0 10px rgba(91,224,255,0.5)',
          }}>
            {t(UI_STRINGS.bestStreak)}: {state.current.bestStreak}x
          </div>
          <div style={{
            color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4,
            textShadow: '0 0 30px rgba(255,215,0,0.7), 0 0 60px rgba(255,215,0,0.3)',
          }}>
            {displayScore}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>{t(UI_STRINGS.points)}</div>
          <button onClick={() => {
            haptics.tapFeedback();
            sounds.pop();
            onComplete(state.current.score);
          }} style={{
            background: 'linear-gradient(135deg, #5BE0FF 0%, #00A0CC 100%)',
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: '0 0 20px rgba(91,224,255,0.4), 0 4px 15px rgba(0,0,0,0.3)',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={() => {
            haptics.tapFeedback();
            sounds.pop();
            onBack();
          }} style={{
            background: 'transparent', color: COLORS.gray, border: `1px solid ${COLORS.gray}`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            boxShadow: '0 0 10px rgba(255,255,255,0.05)',
          }}>{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => {
          haptics.tapFeedback();
          sounds.pop();
          onBack();
        }} style={{
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

function drawStar(ctx, cx, cy, outerR, innerR, points, color) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outerR : innerR;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}
