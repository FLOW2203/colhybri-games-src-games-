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
const POOL_SIZE = 100;
const DIRECTIONS = ['up', 'down', 'left', 'right'];
const ARROW_SYMBOLS = { up: '\u2191', down: '\u2193', left: '\u2190', right: '\u2192' };
const DIR_ANGLES = { up: -Math.PI / 2, down: Math.PI / 2, left: Math.PI, right: 0 };
const INITIAL_SEQ_LENGTH = 3;
const DEMO_STEP_DURATION = 0.8;
const MAX_LIVES = 3;

export default function GameEcolePelicans({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION,
    lives: MAX_LIVES,
    score: 0,
    roundsCompleted: 0,
    fishCaught: 0,
    sequence: [],
    seqLength: INITIAL_SEQ_LENGTH,
    playerIndex: 0,
    gamePhase: 'demo', // demo | player
    demoIndex: 0,
    demoTimer: 0,
    demoArrowAlpha: 0,
    flashColor: null,
    flashAlpha: 0,
    wrongFlash: 0,
    elderY: 0,
    elderBobTime: 0,
    youngY: 0,
    youngBobTime: 0,
    waveOffset: 0,
    swipeTrail: [],
    lastSwipeDir: null,
    lastSwipeTime: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
  });

  const generateSequence = useCallback((len) => {
    const seq = [];
    for (let i = 0; i < len; i++) {
      seq.push(DIRECTIONS[Math.floor(Math.random() * 4)]);
    }
    return seq;
  }, []);

  const startNewRound = useCallback(() => {
    const s = state.current;
    s.sequence = generateSequence(s.seqLength);
    s.playerIndex = 0;
    s.demoIndex = 0;
    s.demoTimer = 0;
    s.gamePhase = 'demo';
  }, [generateSequence]);

  const spawnParticles = useCallback((cx, cy, count, colors) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 40;
        p.y = cy + (Math.random() - 0.5) * 30;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
        const speed = 50 + Math.random() * 120;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.5 + Math.random() * 0.7;
        p.maxLife = p.life;
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.r = c[0]; p.g = c[1]; p.b = c[2];
        p.size = 2 + Math.random() * 4;
        p.type = Math.random() > 0.4 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const spawnSplash = useCallback((cx, cy) => {
    spawnParticles(cx, cy, 15, [
      [0, 150, 255], [100, 200, 255], [255, 255, 255], [0, 212, 255],
    ]);
  }, [spawnParticles]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        haptics.tapFeedback();
        sounds.pop();
      }
      return;
    }
    const s = state.current;
    if (s.gamePhase !== 'player') return;

    s.lastSwipeDir = direction;
    s.lastSwipeTime = performance.now();
    haptics.tapFeedback();

    const expected = s.sequence[s.playerIndex];
    if (direction === expected) {
      sounds.tick();
      sounds.pop();
      s.playerIndex++;
      s.flashColor = 'green';
      s.flashAlpha = 0.15;
      juice.flash('#22C55E', 0.2);

      if (s.playerIndex >= s.sequence.length) {
        // Round complete
        s.roundsCompleted++;
        s.fishCaught += s.seqLength;
        s.score = s.roundsCompleted * s.fishCaught;
        s.seqLength++;
        sounds.chime();
        sounds.success();
        haptics.successFeedback();
        juice.flash('#2EEAA3', 0.35);
        juice.shake(6, 0.2);
        const canvas = canvasRef.current;
        const dpr = window.devicePixelRatio || 1;
        const w = canvas ? canvas.width / dpr : 400;
        const h = canvas ? canvas.height / dpr : 700;
        spawnSplash(w / 2, h * 0.7);
        startNewRound();
      }
    } else {
      // Wrong move
      s.lives--;
      s.wrongFlash = 0.4;
      s.flashColor = 'red';
      s.flashAlpha = 0.25;
      sounds.splash();
      sounds.fail();
      haptics.failFeedback();
      juice.flash('#EF4444', 0.4);
      juice.shake(12, 0.35);

      if (s.lives <= 0) {
        haptics.heavyFeedback();
        sounds.impact();
        setPhase('ended');
        setDisplayScore(s.score);
        return;
      }
      // Replay same round from beginning
      s.playerIndex = 0;
      s.demoIndex = 0;
      s.demoTimer = 0;
      s.gamePhase = 'demo';
    }
  }, [phase, sounds, haptics, juice, spawnSplash, startNewRound]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') {
      setPhase('playing');
      haptics.tapFeedback();
      sounds.pop();
    }
  }, [phase, haptics, sounds]);

  useTouch(canvasRef, { onSwipe: handleSwipe, onTap: handleTap });

  const drawPelican = useCallback((ctx, x, y, scale, isElder, bobAngle) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale);
    const col = isElder ? '#e8dcc8' : '#f0e6d4';
    // Body + head
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    ctx.beginPath(); ctx.arc(28, -18, 14, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    // Eye
    ctx.beginPath(); ctx.arc(33, -22, 3, 0, Math.PI * 2); ctx.fillStyle = '#222'; ctx.fill();
    ctx.beginPath(); ctx.arc(34, -23, 1.2, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    // Beak with pouch
    ctx.beginPath(); ctx.moveTo(40, -18); ctx.lineTo(70, -14); ctx.lineTo(68, -8);
    ctx.quadraticCurveTo(55, 2 + Math.sin(bobAngle) * 3, 38, -10); ctx.closePath();
    ctx.fillStyle = '#e8a832'; ctx.fill();
    ctx.strokeStyle = '#c48a20'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(42, -10);
    ctx.quadraticCurveTo(55, 5 + Math.sin(bobAngle) * 4, 66, -10);
    ctx.strokeStyle = '#c48a20'; ctx.lineWidth = 1.5; ctx.stroke();
    // Wing + tail
    ctx.beginPath(); ctx.ellipse(-8, -2, 22, 12, -0.2, 0, Math.PI * 2);
    ctx.fillStyle = isElder ? '#d4c8b4' : '#e0d6c6'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-28, -2); ctx.lineTo(-42, -10); ctx.lineTo(-38, 0);
    ctx.lineTo(-42, 8); ctx.closePath(); ctx.fillStyle = isElder ? '#c0b4a0' : '#d4c8b8'; ctx.fill();
    // Feet
    ctx.strokeStyle = '#d4842a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-5, 18); ctx.lineTo(-8, 28);
    ctx.moveTo(-8, 28); ctx.lineTo(-14, 30); ctx.moveTo(-8, 28); ctx.lineTo(-4, 31); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 18); ctx.lineTo(5, 28);
    ctx.moveTo(5, 28); ctx.lineTo(-1, 30); ctx.moveTo(5, 28); ctx.lineTo(9, 31); ctx.stroke();
    ctx.restore();
  }, []);

  const drawArrow = useCallback((ctx, x, y, dir, alpha, size) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(DIR_ANGLES[dir]);
    ctx.globalAlpha = alpha;

    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.4, -size * 0.6);
    ctx.lineTo(-size * 0.1, 0);
    ctx.lineTo(-size * 0.4, size * 0.6);
    ctx.closePath();
    ctx.fillStyle = COLORS.cyan;
    ctx.fill();
    ctx.strokeStyle = COLORS.white;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }, []);

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

    // Update juice system
    juice.update(delta);

    // Apply screen shake
    juice.applyShake(ctx);

    const s = state.current;
    const cx = w / 2;

    if (phase === 'ready') {
      // Sky gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1a3a5c');
      skyGrad.addColorStop(0.6, '#4a90b8');
      skyGrad.addColorStop(1, '#2a6090');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Ocean at bottom
      ctx.fillStyle = '#1a5070';
      ctx.fillRect(0, h * 0.75, w, h * 0.25);

      // Title with neon text
      juice.drawNeonText(ctx, t(GAME_NAMES['18']), cx, h * 0.3, COLORS.cyan, 26);

      // Glow behind title
      juice.drawGlow(ctx, cx, h * 0.3, 120, COLORS.cyan, 0.15);

      ctx.font = `17px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('Watch the elder pelican\'s fishing', cx, h * 0.38);
      ctx.fillText('sequence, then repeat it by swiping!', cx, h * 0.42);
      ctx.font = `15px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Swipe: UP / DOWN / LEFT / RIGHT', cx, h * 0.50);
      ctx.fillText(`${MAX_LIVES} lives \u2022 ${GAME_DURATION}s timer`, cx, h * 0.54);

      // Pulsing TAP TO START with neon
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, h * 0.65, COLORS.mint, 20);
      ctx.globalAlpha = 1;

      // Glow under pelicans
      juice.drawGlow(ctx, cx - 60, h * 0.2, 50, COLORS.gold, 0.12);
      juice.drawGlow(ctx, cx + 60, h * 0.2, 40, COLORS.cyan, 0.10);

      drawPelican(ctx, cx - 60, h * 0.2, 0.7, true, elapsed * 2);
      drawPelican(ctx, cx + 60, h * 0.2, 0.6, false, elapsed * 2.5);

      // Draw juice flash overlay
      juice.drawFlash(ctx, w, h);

      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.waveOffset += delta * 40;
    s.elderBobTime += delta * 2.5;
    s.youngBobTime += delta * 3;

    // Low time warning haptic
    if (s.timeLeft <= 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      haptics.warningFeedback();
      sounds.countdown(s.timeLeft <= 1);
    }

    // Demo phase logic
    if (s.gamePhase === 'demo') {
      s.demoTimer += delta;
      const stepDuration = DEMO_STEP_DURATION;
      const newIndex = Math.floor(s.demoTimer / stepDuration);
      if (newIndex >= s.sequence.length) {
        s.gamePhase = 'player';
        s.playerIndex = 0;
        sounds.whoosh();
      } else {
        if (newIndex !== s.demoIndex) {
          sounds.drop();
          haptics.tapFeedback();
        }
        s.demoIndex = newIndex;
        s.demoArrowAlpha = 1 - ((s.demoTimer % stepDuration) / stepDuration) * 0.5;
      }
    }

    // Flash decay
    s.flashAlpha *= Math.pow(0.01, delta);
    s.wrongFlash *= Math.pow(0.01, delta);

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
      s.score = s.roundsCompleted * s.fishCaught;
      haptics.heavyFeedback();
      sounds.impact();
      setPhase('ended');
      setDisplayScore(s.score);
      ctx.restore();
      return;
    }

    // --- RENDER ---
    // Sky
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#1a3a5c');
    skyGrad.addColorStop(0.5, '#4a90b8');
    skyGrad.addColorStop(1, '#2a6090');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Sun with glow
    juice.drawGlow(ctx, w * 0.85, h * 0.1, 60, '#FFE080', 0.25);
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.1, 35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,220,100,0.4)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(w * 0.85, h * 0.1, 22, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,230,130,0.7)';
    ctx.fill();

    // Ocean
    const oceanY = h * 0.72;
    ctx.fillStyle = '#1a5878';
    ctx.fillRect(0, oceanY, w, h - oceanY);

    // Waves
    for (let row = 0; row < 4; row++) {
      const wy = oceanY + row * 20;
      ctx.beginPath();
      ctx.moveTo(0, wy);
      for (let x = 0; x <= w; x += 10) {
        const yOff = Math.sin((x + s.waveOffset + row * 60) * 0.03) * 6;
        ctx.lineTo(x, wy + yOff);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = `rgba(20,80,120,${0.3 + row * 0.15})`;
      ctx.fill();
    }

    // Flash overlay (original)
    if (s.flashAlpha > 0.01) {
      const fc = s.flashColor === 'green' ? '46,234,163' : '239,68,68';
      ctx.fillStyle = `rgba(${fc},${s.flashAlpha})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay (from useJuice)
    juice.drawFlash(ctx, w, h);

    // Elder pelican (top) with glow
    const elderX = cx - 40;
    const elderYBase = h * 0.18;
    const elderBob = Math.sin(s.elderBobTime) * 5;
    juice.drawGlow(ctx, elderX, elderYBase + elderBob, 45, COLORS.gold, 0.12);
    drawPelican(ctx, elderX, elderYBase + elderBob, 0.85, true, s.elderBobTime);

    // Label with neon
    juice.drawNeonText(ctx, 'Elder', elderX, elderYBase + 45, COLORS.gold, 13);

    // Young pelican (center) with glow
    const youngX = cx + 30;
    const youngYBase = h * 0.45;
    const youngBob = Math.sin(s.youngBobTime) * 4;
    juice.drawGlow(ctx, youngX, youngYBase + youngBob, 38, COLORS.cyan, 0.10);
    drawPelican(ctx, youngX, youngYBase + youngBob, 0.7, false, s.youngBobTime);

    juice.drawNeonText(ctx, 'You', youngX, youngYBase + 38, COLORS.cyan, 13);

    // Demo phase: show arrows near elder
    if (s.gamePhase === 'demo' && s.demoIndex < s.sequence.length) {
      const dir = s.sequence[s.demoIndex];
      const arrowX = elderX + 80;
      const arrowY = elderYBase + elderBob;

      // Glow around demo arrow
      juice.drawGlow(ctx, arrowX, arrowY, 35, COLORS.cyan, 0.25 * s.demoArrowAlpha);
      drawArrow(ctx, arrowX, arrowY, dir, s.demoArrowAlpha, 28);

      // Show sequence progress dots
      const dotY = elderYBase + 60;
      for (let i = 0; i < s.sequence.length; i++) {
        const dotX = cx - (s.sequence.length * 8) + i * 16;
        if (i === s.demoIndex) {
          juice.drawGlow(ctx, dotX, dotY, 12, COLORS.cyan, 0.3);
        }
        ctx.beginPath();
        ctx.arc(dotX, dotY, 4, 0, Math.PI * 2);
        ctx.fillStyle = i === s.demoIndex ? COLORS.cyan : 'rgba(255,255,255,0.3)';
        ctx.fill();
      }

      // WATCH! with neon
      juice.drawNeonText(ctx, 'WATCH!', cx, h * 0.33, COLORS.gold, 16);
    }

    // Player phase: show progress and prompt
    if (s.gamePhase === 'player') {
      juice.drawNeonText(ctx, 'YOUR TURN! Swipe the sequence', cx, h * 0.33, COLORS.mint, 16);

      // Sequence dots (filled = completed)
      const dotY = h * 0.36;
      for (let i = 0; i < s.sequence.length; i++) {
        const dotX = cx - (s.sequence.length * 8) + i * 16;
        if (i < s.playerIndex) {
          juice.drawGlow(ctx, dotX, dotY, 10, COLORS.mint, 0.3);
          ctx.beginPath();
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.mint;
        } else if (i === s.playerIndex) {
          juice.drawGlow(ctx, dotX, dotY, 14, COLORS.cyan, 0.35);
          ctx.beginPath();
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
          ctx.fillStyle = COLORS.cyan;
        } else {
          ctx.beginPath();
          ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(255,255,255,0.2)';
        }
        ctx.fill();
      }

      // Show expected direction hint arrow near young pelican
      if (s.playerIndex < s.sequence.length) {
        const hintDir = s.sequence[s.playerIndex];
        const hintAlpha = 0.3 + Math.sin(elapsed * 5) * 0.15;
        juice.drawGlow(ctx, youngX + 70, youngYBase + youngBob, 25, COLORS.cyan, hintAlpha * 0.3);
        drawArrow(ctx, youngX + 70, youngYBase + youngBob, hintDir, hintAlpha, 20);
      }
    }

    // Last swipe indicator
    if (s.lastSwipeDir && performance.now() - s.lastSwipeTime < 400) {
      const fade = 1 - (performance.now() - s.lastSwipeTime) / 400;
      juice.drawGlow(ctx, youngX - 60, youngYBase + youngBob, 30, COLORS.mint, fade * 0.3);
      drawArrow(ctx, youngX - 60, youngYBase + youngBob, s.lastSwipeDir, fade * 0.8, 24);
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

    // HUD - Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Glow on timer bar tip
    if (timerFrac > 0.01) {
      juice.drawGlow(ctx, w * timerFrac, 2, 15, timerColor, 0.4);
    }

    // Timer text with neon
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 36, s.timeLeft < 5 ? COLORS.red : COLORS.white, 22);

    // Score with neon
    juice.drawNeonText(ctx, t(UI_STRINGS.score) + ': ' + s.score, 90, 36, COLORS.white, 18);

    // Lives
    ctx.font = `16px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.red;
    let livesText = '';
    for (let i = 0; i < MAX_LIVES; i++) {
      livesText += i < s.lives ? '\u2764 ' : '\u2661 ';
    }
    ctx.fillText(livesText, 60, 58);

    // Glow behind lives
    juice.drawGlow(ctx, 80, 55, 30, COLORS.red, 0.08);

    // Round info with neon
    juice.drawNeonText(ctx, `Round ${s.roundsCompleted + 1} \u2022 Sequence: ${s.seqLength}`, cx, h - 20, COLORS.gray, 14);

    // Fish caught display
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.gold;
    ctx.textAlign = 'right';
    ctx.fillText(`\uD83D\uDC1F ${s.fishCaught}`, w - 16, 58);
    juice.drawGlow(ctx, w - 35, 55, 20, COLORS.gold, 0.1);

    ctx.restore();
  }, [phase, drawPelican, drawArrow, juice, haptics, sounds, t]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION;
      s.lives = MAX_LIVES;
      s.score = 0;
      s.roundsCompleted = 0;
      s.fishCaught = 0;
      s.seqLength = INITIAL_SEQ_LENGTH;
      s.flashAlpha = 0;
      s.wrongFlash = 0;
      s.lastSwipeDir = null;
      for (const p of s.particles) p.active = false;
      gameLoop.reset();
      gameLoop.start();
      startNewRound();
    }
  }, [phase, gameLoop, startNewRound]);

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
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16,
            textShadow: `0 0 20px ${state.current.lives <= 0 ? COLORS.red : COLORS.cyan}, 0 0 40px ${state.current.lives <= 0 ? COLORS.red : COLORS.cyan}50`,
          }}>
            {state.current.lives <= 0 ? t(UI_STRINGS.gameOver) : t(UI_STRINGS.timesUp)}
          </div>
          <div style={{
            color: COLORS.gold, fontSize: 20, marginBottom: 8,
            textShadow: `0 0 12px ${COLORS.gold}80`,
          }}>
            Rounds: {state.current.roundsCompleted}
          </div>
          <div style={{
            color: COLORS.cyan, fontSize: 18, marginBottom: 8,
            textShadow: `0 0 12px ${COLORS.cyan}80`,
          }}>
            Fish caught: {state.current.fishCaught}
          </div>
          <div style={{
            color: COLORS.white, fontSize: 48, fontWeight: 'bold', marginBottom: 4,
            textShadow: `0 0 30px ${COLORS.cyan}, 0 0 60px ${COLORS.cyan}40`,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 14, marginBottom: 24,
            textShadow: `0 0 8px ${COLORS.gray}60`,
          }}>{t(UI_STRINGS.points)}</div>
          <button onClick={() => {
            haptics.tapFeedback();
            sounds.chime();
            onComplete(state.current.score);
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.cyan}, ${COLORS.mint})`,
            color: COLORS.primary,
            border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.cyan}60, 0 4px 15px rgba(0,0,0,0.3)`,
            textShadow: 'none',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={() => {
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.05)',
            color: COLORS.gray,
            border: `1px solid ${COLORS.gray}50`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14,
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.2)',
            textShadow: `0 0 8px ${COLORS.gray}40`,
          }}>{t(UI_STRINGS.back)}</button>
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
        }}>{t(UI_STRINGS.back)}</button>
      )}
    </div>
  );
}
