import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, sans-serif';
const GAME_DURATION = 60;
const POOL_SIZE = 100;
const INITIAL_GRID = 3;
const MAX_GRID = 5;
const INITIAL_SEQ_LEN = 3;
const LIVES_TOTAL = 3;
const SHOW_DELAY = 0.6;
const FLOWER_COLORS = [
  [255, 100, 150], [255, 200, 50], [100, 180, 255],
  [180, 100, 255], [255, 130, 50], [100, 255, 180],
  [255, 80, 80], [80, 200, 255], [200, 255, 100],
  [255, 160, 200], [120, 255, 120], [255, 220, 100],
  [150, 120, 255], [255, 180, 80], [80, 230, 200],
  [230, 130, 255], [255, 100, 100], [100, 255, 255],
  [200, 200, 100], [180, 255, 150], [255, 150, 150],
  [120, 200, 255], [200, 100, 200], [255, 200, 150],
  [100, 200, 150],
];

export default function GameSuperBrain({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();

  const state = useRef({
    timeLeft: GAME_DURATION,
    gridSize: INITIAL_GRID,
    sequence: [],
    seqLength: INITIAL_SEQ_LEN,
    playerInput: [],
    showingIdx: -1,
    showTimer: 0,
    roundPhase: 'showing', // showing | input | correct | wrong | nextRound
    phaseTimer: 0,
    lives: LIVES_TOTAL,
    score: 0,
    roundsCompleted: 0,
    roundStartTime: 0,
    birdX: 0,
    birdY: 0,
    birdTargetX: 0,
    birdTargetY: 0,
    flashCells: [], // { idx, r, g, b, alpha }
    shakeAmount: 0,
    shakeTimer: 0,
    flowers: [],
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    glowAlpha: 0,
    glowIdx: -1,
    screenFlashAlpha: 0,
    screenFlashColor: '#FFFFFF',
  });

  const getFlowerPositions = useCallback((gridSize, w, h) => {
    const flowers = [];
    const gridArea = Math.min(w * 0.8, h * 0.5);
    const cellSize = gridArea / gridSize;
    const startX = (w - gridSize * cellSize) / 2;
    const startY = h * 0.22;
    for (let row = 0; row < gridSize; row++) {
      for (let col = 0; col < gridSize; col++) {
        const idx = row * gridSize + col;
        flowers.push({
          x: startX + col * cellSize + cellSize / 2,
          y: startY + row * cellSize + cellSize / 2,
          radius: cellSize * 0.35,
          color: FLOWER_COLORS[idx % FLOWER_COLORS.length],
        });
      }
    }
    return flowers;
  }, []);

  const generateSequence = useCallback((gridSize, length) => {
    const total = gridSize * gridSize;
    const seq = [];
    for (let i = 0; i < length; i++) {
      seq.push(Math.floor(Math.random() * total));
    }
    return seq;
  }, []);

  const startNewRound = useCallback((s) => {
    s.sequence = generateSequence(s.gridSize, s.seqLength);
    s.playerInput = [];
    s.showingIdx = 0;
    s.showTimer = 0;
    s.roundPhase = 'showing';
    s.phaseTimer = 0;
    s.roundStartTime = performance.now();
    s.flashCells = [];
  }, [generateSequence]);

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
        const speed = 40 + Math.random() * 120;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.4 + Math.random() * 0.5;
        p.maxLife = p.life;
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.r = c[0]; p.g = c[1]; p.b = c[2];
        p.size = 1.5 + Math.random() * 3;
        p.type = Math.random() > 0.5 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const handleTap = useCallback(({ x, y }) => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        setPhase('playing');
        sounds.whoosh();
        haptics.tapFeedback();
      }
      return;
    }
    const s = state.current;
    if (s.roundPhase !== 'input') return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    const flowers = getFlowerPositions(s.gridSize, w, h);

    let tappedIdx = -1;
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      const dx = x - f.x;
      const dy = y - f.y;
      if (dx * dx + dy * dy < f.radius * f.radius * 1.6) {
        tappedIdx = i;
        break;
      }
    }
    if (tappedIdx < 0) return;

    const expectedIdx = s.sequence[s.playerInput.length];
    const flower = flowers[tappedIdx];

    // Move bird toward tapped flower
    s.birdTargetX = flower.x;
    s.birdTargetY = flower.y - flower.radius - 20;

    if (tappedIdx === expectedIdx) {
      // Correct tap
      s.playerInput.push(tappedIdx);
      s.flashCells.push({ idx: tappedIdx, alpha: 1.0, correct: true });
      sounds.tick();
      haptics.tapFeedback();
      sounds.wingflap();
      spawnParticles(flower.x, flower.y, 5, [[34, 197, 94], [46, 234, 163], [255, 255, 255]]);

      if (s.playerInput.length === s.sequence.length) {
        // Round complete
        const elapsed = (performance.now() - s.roundStartTime) / 1000;
        const speedBonus = Math.max(0, Math.floor((s.seqLength * 2 - elapsed) * 2));
        const roundScore = s.roundsCompleted * s.seqLength + s.seqLength + speedBonus;
        s.score += roundScore;
        s.roundsCompleted++;
        s.seqLength++;
        if (s.roundsCompleted % 3 === 0 && s.gridSize < MAX_GRID) {
          s.gridSize++;
          sounds.powerup();
        }
        s.roundPhase = 'correct';
        s.phaseTimer = 0;
        sounds.chime();
        sounds.success();
        haptics.successFeedback();
        juice.flash('#22C55E', 0.4);
        spawnParticles(flower.x, flower.y, 15, [[46, 234, 163], [0, 212, 255], [245, 166, 35]]);
      }
    } else {
      // Wrong tap
      s.lives--;
      s.flashCells.push({ idx: tappedIdx, alpha: 1.0, correct: false });
      s.shakeAmount = 8;
      s.shakeTimer = 0.3;
      s.roundPhase = 'wrong';
      s.phaseTimer = 0;
      sounds.firecrackle();
      sounds.fail();
      haptics.failFeedback();
      juice.shake(12, 0.4);
      juice.flash('#EF4444', 0.5);
      spawnParticles(flower.x, flower.y, 8, [[239, 68, 68], [255, 100, 100], [200, 50, 50]]);

      if (s.lives <= 0) {
        haptics.heavyFeedback();
        sounds.impact();
        setPhase('ended');
        setDisplayScore(s.score);
        return;
      }
    }
  }, [phase, sounds, haptics, juice, spawnParticles, getFlowerPositions]);

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

    // Update juice effects
    juice.update(delta);

    if (phase === 'ready') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1a2a4c');
      skyGrad.addColorStop(0.5, '#2d5a3e');
      skyGrad.addColorStop(1, '#1a4a2e');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, 'Super Brain', cx, cy - 60, COLORS.cyan, 32);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 8;
      ctx.fillText('Hummingbirds memorize', cx, cy - 10);
      ctx.fillText('hundreds of flower locations!', cx, cy + 16);
      ctx.shadowBlur = 0;

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Watch the sequence, then repeat it!', cx, cy + 60);

      // Pulsing neon tap-to-start
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, 'TAP TO START', cx, cy + 110, COLORS.gold, 20);
      ctx.globalAlpha = 1;

      // Subtle ambient glow in center
      juice.drawGlow(ctx, cx, cy, 200, COLORS.cyan, 0.08 + Math.sin(elapsed * 2) * 0.04);

      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);

    // Low time warning haptics
    if (s.timeLeft <= 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      haptics.warningFeedback();
      sounds.countdown(s.timeLeft <= 1);
    }

    // Shake decay
    if (s.shakeTimer > 0) {
      s.shakeTimer -= delta;
      if (s.shakeTimer <= 0) s.shakeAmount = 0;
    }

    // Bird interpolation
    s.birdX += (s.birdTargetX - s.birdX) * Math.min(1, delta * 8);
    s.birdY += (s.birdTargetY - s.birdY) * Math.min(1, delta * 8);

    // Flash cell decay
    for (let i = s.flashCells.length - 1; i >= 0; i--) {
      s.flashCells[i].alpha -= delta * 2;
      if (s.flashCells[i].alpha <= 0) s.flashCells.splice(i, 1);
    }

    // Glow animation for showing phase
    if (s.roundPhase === 'showing') {
      s.showTimer += delta;
      if (s.showTimer >= SHOW_DELAY) {
        s.showTimer -= SHOW_DELAY;
        s.showingIdx++;
        if (s.showingIdx >= s.sequence.length) {
          s.roundPhase = 'input';
          s.playerInput = [];
          s.showingIdx = -1;
          sounds.whoosh();
        } else {
          s.glowIdx = s.sequence[s.showingIdx];
          s.glowAlpha = 1.0;
          sounds.tick();
          haptics.tapFeedback();
        }
      }
      if (s.showingIdx >= 0 && s.showingIdx < s.sequence.length) {
        s.glowIdx = s.sequence[s.showingIdx];
        s.glowAlpha = 1.0 - (s.showTimer / SHOW_DELAY) * 0.5;
      }
    } else {
      s.glowAlpha *= Math.pow(0.01, delta);
      if (s.glowAlpha < 0.01) s.glowIdx = -1;
    }

    // Round phase transitions
    if (s.roundPhase === 'correct') {
      s.phaseTimer += delta;
      if (s.phaseTimer >= 1.0) {
        startNewRound(s);
      }
    }
    if (s.roundPhase === 'wrong') {
      s.phaseTimer += delta;
      if (s.phaseTimer >= 1.2) {
        // Replay same sequence
        s.playerInput = [];
        s.showingIdx = 0;
        s.showTimer = 0;
        s.roundPhase = 'showing';
        s.flashCells = [];
      }
    }

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 50 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over by time
    if (s.timeLeft <= 0 && phase === 'playing') {
      haptics.heavyFeedback();
      sounds.impact();
      setPhase('ended');
      setDisplayScore(s.score);
      return;
    }

    // --- RENDER ---
    const shakeX = s.shakeAmount > 0 ? (Math.random() - 0.5) * s.shakeAmount * 2 : 0;
    const shakeY = s.shakeAmount > 0 ? (Math.random() - 0.5) * s.shakeAmount * 2 : 0;

    // Background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#1a2a4c');
    skyGrad.addColorStop(0.5, '#2d5a3e');
    skyGrad.addColorStop(1, '#1a4a2e');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(shakeX, shakeY);

    // Apply juice shake on top
    juice.applyShake(ctx);

    // Get flower positions
    const flowers = getFlowerPositions(s.gridSize, w, h);

    // Initialize bird position on first frame
    if (s.birdX === 0 && s.birdY === 0 && flowers.length > 0) {
      s.birdX = cx;
      s.birdY = flowers[0].y - flowers[0].radius - 30;
      s.birdTargetX = s.birdX;
      s.birdTargetY = s.birdY;
    }

    // Draw flowers
    for (let i = 0; i < flowers.length; i++) {
      const f = flowers[i];
      const [cr, cg, cb] = f.color;
      const isGlowing = s.glowIdx === i && s.glowAlpha > 0.05;
      const flashCell = s.flashCells.find(fc => fc.idx === i);

      // Ambient glow around each flower (additive blending)
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.08 + Math.sin(elapsed * 1.5 + i * 0.7) * 0.04;
      const ambGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 1.8);
      ambGrad.addColorStop(0, `rgba(${cr},${cg},${cb},0.4)`);
      ambGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = ambGrad;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * 1.8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Flower shadow
      ctx.beginPath();
      ctx.arc(f.x + 2, f.y + 2, f.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fill();

      // Petals
      const petalCount = 6;
      for (let p = 0; p < petalCount; p++) {
        const angle = (p / petalCount) * Math.PI * 2 + elapsed * 0.3;
        const px = f.x + Math.cos(angle) * f.radius * 0.5;
        const py = f.y + Math.sin(angle) * f.radius * 0.5;
        ctx.beginPath();
        ctx.ellipse(px, py, f.radius * 0.45, f.radius * 0.25, angle, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},0.7)`;
        ctx.fill();
      }

      // Center
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * 0.35, 0, Math.PI * 2);
      const cGrad = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, f.radius * 0.35);
      cGrad.addColorStop(0, `rgba(${Math.min(255, cr + 80)},${Math.min(255, cg + 80)},${Math.min(255, cb + 80)},1)`);
      cGrad.addColorStop(1, `rgba(${cr},${cg},${cb},1)`);
      ctx.fillStyle = cGrad;
      ctx.fill();

      // Glow effect (enhanced with juice.drawGlow)
      if (isGlowing) {
        // Use juice glow with additive blending
        juice.drawGlow(ctx, f.x, f.y, f.radius * 2.0, `rgb(${cr},${cg},${cb})`, s.glowAlpha * 0.6);

        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * 1.4, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},${s.glowAlpha * 0.5})`;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * 1.1, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,255,255,${s.glowAlpha * 0.8})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      // Flash feedback
      if (flashCell) {
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.radius * 1.2, 0, Math.PI * 2);
        if (flashCell.correct) {
          ctx.fillStyle = `rgba(34,197,94,${flashCell.alpha * 0.6})`;
          // Additive glow for correct
          juice.drawGlow(ctx, f.x, f.y, f.radius * 2.5, '#22C55E', flashCell.alpha * 0.3);
        } else {
          ctx.fillStyle = `rgba(239,68,68,${flashCell.alpha * 0.6})`;
          // Red glow for wrong
          juice.drawGlow(ctx, f.x, f.y, f.radius * 2.5, '#EF4444', flashCell.alpha * 0.3);
        }
        ctx.fill();
      }

      // Already tapped indicator (dimmed check)
      if (s.roundPhase === 'input') {
        const tapCount = s.playerInput.filter(idx => idx === i).length;
        if (tapCount > 0) {
          ctx.font = `bold ${f.radius * 0.5}px ${FONT_FAMILY}`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.shadowColor = '#FFFFFF';
          ctx.shadowBlur = 6;
          ctx.fillText(tapCount.toString(), f.x, f.y);
          ctx.shadowBlur = 0;
        }
      }
    }

    // Draw hummingbird
    const bx = s.birdX;
    const by = s.birdY;
    ctx.save();
    ctx.translate(bx, by);
    const birdScale = 0.6;
    ctx.scale(birdScale, birdScale);

    // Bird glow (additive)
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.15 + Math.sin(elapsed * 3) * 0.05;
    const birdGlowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 50);
    birdGlowGrad.addColorStop(0, '#2EEAA3');
    birdGlowGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = birdGlowGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 50, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

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
    ctx.arc(22, -4, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#2EEAA3';
    ctx.fill();

    // Eye
    ctx.beginPath();
    ctx.arc(25, -6, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(29, -4);
    ctx.lineTo(40, -2);
    ctx.lineTo(29, -1);
    ctx.closePath();
    ctx.fillStyle = '#333';
    ctx.fill();

    // Wings (animated)
    const wingY = Math.sin(elapsed * 20) * 18;
    ctx.globalAlpha = 0.6;
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.quadraticCurveTo(-22, -30 + wingY, -38, -15 + wingY * 0.7);
    ctx.quadraticCurveTo(-25, -8, -4, -4);
    ctx.fillStyle = '#5ff5c0';
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-4, 4);
    ctx.quadraticCurveTo(-22, 30 - wingY, -38, 15 - wingY * 0.7);
    ctx.quadraticCurveTo(-25, 8, -4, 4);
    ctx.fill();
    ctx.globalAlpha = 1;

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

    ctx.restore(); // undo shake

    // --- Screen flash overlay from juice ---
    juice.drawFlash(ctx, w, h);

    // --- HUD ---
    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer bar glow
    if (s.timeLeft < 10) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.3 + Math.sin(elapsed * 6) * 0.15;
      ctx.fillStyle = timerColor;
      ctx.fillRect(0, 0, w * timerFrac, 6);
      ctx.restore();
    }

    // Timer text (neon when low)
    if (s.timeLeft < 5) {
      juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 20, 40, COLORS.red, 24);
    } else {
      ctx.font = `bold 24px ${FONT_FAMILY}`;
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.white;
      ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    }

    // Score (neon)
    juice.drawNeonText(ctx, `Score: ${s.score}`, 80, 40, COLORS.cyan, 20);

    // Lives
    ctx.font = `18px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.red;
    ctx.shadowColor = COLORS.red;
    ctx.shadowBlur = 8;
    let livesStr = '';
    for (let i = 0; i < LIVES_TOTAL; i++) {
      livesStr += i < s.lives ? '\u2665 ' : '\u2661 ';
    }
    ctx.fillText(livesStr, 20, 65);
    ctx.shadowBlur = 0;

    // Round info
    ctx.font = `14px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.gray;
    ctx.textAlign = 'center';
    ctx.fillText(`Round ${s.roundsCompleted + 1} | Sequence: ${s.seqLength}`, cx, h - 30);

    // Phase indicator (neon text)
    if (s.roundPhase === 'showing') {
      juice.drawNeonText(ctx, 'Watch the sequence...', cx, h * 0.16, COLORS.gold, 22);
    } else if (s.roundPhase === 'input') {
      juice.drawNeonText(ctx, `Tap: ${s.playerInput.length}/${s.sequence.length}`, cx, h * 0.16, COLORS.mint, 22);
    } else if (s.roundPhase === 'correct') {
      const pulseScale = 1 + Math.sin(elapsed * 12) * 0.1;
      ctx.save();
      ctx.translate(cx, h * 0.16);
      ctx.scale(pulseScale, pulseScale);
      juice.drawNeonText(ctx, 'Correct!', 0, 0, COLORS.green, 26);
      ctx.restore();
    } else if (s.roundPhase === 'wrong') {
      juice.drawNeonText(ctx, 'Wrong! Watch again...', cx, h * 0.16, COLORS.red, 26);
    }

    // Grid size indicator
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.fillStyle = COLORS.gray;
    ctx.textAlign = 'right';
    ctx.fillText(`Grid: ${s.gridSize}x${s.gridSize}`, w - 20, 65);

    // Subtle bloom overlay
    juice.applyBloom(ctx, w, h, 0.06);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, getFlowerPositions, startNewRound]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION;
      s.gridSize = INITIAL_GRID;
      s.seqLength = INITIAL_SEQ_LEN;
      s.lives = LIVES_TOTAL;
      s.score = 0;
      s.roundsCompleted = 0;
      s.birdX = 0;
      s.birdY = 0;
      s.birdTargetX = 0;
      s.birdTargetY = 0;
      s.shakeAmount = 0;
      s.shakeTimer = 0;
      s.flashCells = [];
      for (const p of s.particles) p.active = false;
      startNewRound(s);
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop, startNewRound]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

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
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16,
            textShadow: `0 0 20px ${COLORS.cyan}, 0 0 40px ${COLORS.cyan}`,
            fontFamily: FONT_FAMILY,
          }}>Results</div>
          <div style={{
            color: COLORS.mint, fontSize: 20, marginBottom: 8,
            textShadow: `0 0 10px ${COLORS.mint}`,
            fontFamily: FONT_FAMILY,
          }}>
            Rounds: {state.current.roundsCompleted}
          </div>
          <div style={{
            color: COLORS.cyan, fontSize: 16, marginBottom: 4,
            textShadow: `0 0 8px ${COLORS.cyan}`,
            fontFamily: FONT_FAMILY,
          }}>
            Max Sequence: {state.current.seqLength - 1}
          </div>
          <div style={{
            color: COLORS.gold, fontSize: 16, marginBottom: 4,
            textShadow: `0 0 8px ${COLORS.gold}`,
            fontFamily: FONT_FAMILY,
          }}>
            Grid Reached: {state.current.gridSize}x{state.current.gridSize}
          </div>
          <div style={{
            color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4,
            textShadow: `0 0 20px ${COLORS.gold}, 0 0 40px ${COLORS.gold}, 0 0 60px ${COLORS.gold}`,
            fontFamily: FONT_FAMILY,
          }}>
            {displayScore}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 14, marginBottom: 24,
            fontFamily: FONT_FAMILY,
          }}>points</div>
          <button onClick={() => {
            haptics.tapFeedback();
            sounds.chime();
            onComplete(state.current.score);
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
            boxShadow: `0 0 20px ${COLORS.cyan}80, 0 0 40px ${COLORS.cyan}40`,
            textShadow: 'none',
          }}>Continue</button>
          <button onClick={() => {
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.05)',
            color: COLORS.gray,
            border: `1px solid ${COLORS.gray}60`,
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
