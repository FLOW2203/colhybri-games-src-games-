import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';

const GAME_DURATION = 45;
const POOL_SIZE = 100;
const WIND_INTERVAL = 8;
const MATERIAL_TYPES = ['twig', 'leaf', 'moss', 'flower'];
const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, sans-serif';

export default function GameNidDukdukdiya({ onComplete, onBack }) {
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
    nestX: 0,
    nestY: 0,
    nestWidth: 60,
    nestHeight: 20,
    nestMaterials: [],
    caughtMaterials: [],
    fallingMaterials: [],
    materialSpawnTimer: 0,
    solidarityGauge: 0,
    typesCollected: new Set(),
    diversityBonusGiven: false,
    windTimer: 0,
    windActive: false,
    windDuration: 0,
    windDirection: 1,
    shakeOffset: 0,
    isHolding: false,
    weaveTimer: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    nestLayers: 0,
    branchY: 0,
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
        const speed = 30 + Math.random() * 80;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 2 + Math.random() * 4;
        spawned++;
      }
    }
  }, []);

  const handleSwipe = useCallback((direction) => {
    if (phase === 'ready') { setPhase('playing'); return; }
    if (phase !== 'playing') return;
    const s = state.current;
    const w = window.innerWidth;
    const moveAmt = 40;
    if (direction === 'left') s.nestX = Math.max(s.nestWidth / 2, s.nestX - moveAmt);
    if (direction === 'right') s.nestX = Math.min(w - s.nestWidth / 2, s.nestX + moveAmt);
    haptics.tapFeedback();
  }, [phase, haptics]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') { setPhase('playing'); sounds.countdown(true); return; }
    if (phase !== 'playing') return;
    const s = state.current;
    // Weave caught materials
    if (s.caughtMaterials.length > 0) {
      const mat = s.caughtMaterials.shift();
      s.nestMaterials.push(mat);
      s.typesCollected.add(mat.type);

      const typeValues = { twig: 8, leaf: 6, moss: 10, flower: 12 };
      const val = typeValues[mat.type] || 5;
      s.solidarityGauge = Math.min(100, s.solidarityGauge + val * 0.8);
      s.score += val;
      s.nestLayers = Math.floor(s.nestMaterials.length / 3);
      setDisplayScore(s.score);

      spawnParticles(s.nestX, s.nestY, 8, 245, 200, 100);
      sounds.chime();
      haptics.impactFeedback();
      juice.flash('#22C55E', 0.15);

      // Diversity bonus
      if (s.typesCollected.size >= 4 && !s.diversityBonusGiven) {
        s.diversityBonusGiven = true;
        s.score += 30;
        s.solidarityGauge = Math.min(100, s.solidarityGauge + 15);
        setDisplayScore(s.score);
        spawnParticles(s.nestX, s.nestY, 20, 233, 30, 140);
        sounds.success();
        haptics.successFeedback();
        juice.flash('#E91E8C', 0.3);
        juice.shake(6, 0.3);
      }
    } else {
      haptics.tapFeedback();
    }
  }, [phase, sounds, spawnParticles, haptics, juice]);

  const handleHoldStart = useCallback(() => {
    if (phase !== 'playing') return;
    state.current.isHolding = true;
    haptics.tapFeedback();
  }, [phase, haptics]);

  const handleHoldEnd = useCallback(() => {
    state.current.isHolding = false;
  }, []);

  useTouch(canvasRef, {
    onSwipe: handleSwipe,
    onTap: handleTap,
    onHoldStart: handleHoldStart,
    onHoldEnd: handleHoldEnd,
  });

  function drawMaterial(ctx, mat, x, y) {
    switch (mat.type) {
      case 'twig':
        ctx.strokeStyle = '#8B6914';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x - 12, y - 2);
        ctx.lineTo(x + 12, y + 2);
        ctx.moveTo(x + 5, y + 1);
        ctx.lineTo(x + 10, y - 5);
        ctx.stroke();
        break;
      case 'leaf':
        ctx.fillStyle = '#22C55E';
        ctx.beginPath();
        ctx.ellipse(x, y, 8, 5, 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#1A8A3A';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(x - 6, y);
        ctx.lineTo(x + 6, y);
        ctx.stroke();
        break;
      case 'moss':
        ctx.fillStyle = '#4CAF50';
        for (let i = 0; i < 6; i++) {
          const mx = x - 6 + Math.random() * 12;
          const my = y - 4 + Math.random() * 8;
          ctx.beginPath();
          ctx.arc(mx, my, 2 + Math.random() * 2, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      case 'flower':
        const colors = ['#E91E8C', '#FF6B6B', '#DDA0DD', '#FFB347'];
        ctx.fillStyle = colors[Math.floor(mat.seed * colors.length)];
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2;
          ctx.beginPath();
          ctx.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.fillStyle = '#FFE066';
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
        break;
    }
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
    s.branchY = h * 0.78;
    if (s.nestY === 0) {
      s.nestX = w / 2;
      s.nestY = s.branchY - 10;
    }

    if (phase === 'ready') {
      ctx.fillStyle = '#1A1020';
      ctx.fillRect(0, 0, w, h);

      // Glow behind title
      juice.drawGlow(ctx, w / 2, h / 2 - 70, 120, '#F5A623', 0.25);

      // Neon title
      juice.drawNeonText(ctx, 'Nid de Dukdukdiya', w / 2, h / 2 - 70, '#F5A623', 26);

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.shadowColor = COLORS.mint;
      ctx.shadowBlur = 8;
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Dukdukdiya builds with love', w / 2, h / 2 - 20);
      ctx.shadowBlur = 0;

      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE L/R: move nest', w / 2, h / 2 + 30);
      ctx.fillText('TAP: weave material into nest', w / 2, h / 2 + 52);
      ctx.fillText('HOLD: shield against wind', w / 2, h / 2 + 74);

      // Pulsing start text
      const pulse = 0.6 + 0.4 * Math.sin(elapsed * 4);
      ctx.globalAlpha = pulse;
      juice.drawNeonText(ctx, 'TAP TO START', w / 2, h / 2 + 120, COLORS.mint, 20);
      ctx.globalAlpha = 1;

      ctx.restore();
      juice.update(delta);
      return;
    }

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    // Low time warning haptic
    if (s.timeLeft <= 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      haptics.warningFeedback();
      sounds.countdown(s.timeLeft <= 1);
    }

    // Spawn materials
    s.materialSpawnTimer += delta;
    if (s.materialSpawnTimer > 0.8) {
      s.materialSpawnTimer = 0;
      const type = MATERIAL_TYPES[Math.floor(Math.random() * MATERIAL_TYPES.length)];
      s.fallingMaterials.push({
        type,
        x: 30 + Math.random() * (w - 60),
        y: -20,
        vy: 60 + Math.random() * 40,
        vx: 0,
        seed: Math.random(),
        rotation: Math.random() * Math.PI * 2,
      });
    }

    // Wind
    s.windTimer += delta;
    if (!s.windActive && s.windTimer >= WIND_INTERVAL) {
      s.windActive = true;
      s.windDuration = 0;
      s.windDirection = Math.random() > 0.5 ? 1 : -1;
      s.windTimer = 0;
      sounds.whoosh();
      haptics.impactFeedback();
      juice.shake(5, 0.4);
    }
    if (s.windActive) {
      s.windDuration += delta;
      if (s.windDuration > 2) {
        s.windActive = false;
      }
      s.shakeOffset = s.windActive ? Math.sin(elapsed * 30) * 4 * (s.isHolding ? 0.1 : 1) : 0;
    } else {
      s.shakeOffset *= 0.9;
    }

    // Update falling materials
    for (let i = s.fallingMaterials.length - 1; i >= 0; i--) {
      const mat = s.fallingMaterials[i];
      mat.y += mat.vy * delta;
      mat.rotation += delta * 2;
      if (s.windActive && !s.isHolding) {
        mat.vx += s.windDirection * 200 * delta;
      }
      mat.x += mat.vx * delta;
      mat.vx *= 0.98;

      // Check catch by nest
      if (mat.y >= s.nestY - 15 && mat.y <= s.nestY + 10 &&
          mat.x >= s.nestX - s.nestWidth / 2 - 5 && mat.x <= s.nestX + s.nestWidth / 2 + 5) {
        s.caughtMaterials.push(mat);
        s.fallingMaterials.splice(i, 1);
        sounds.pop();
        haptics.tapFeedback();
        spawnParticles(mat.x, mat.y, 4, 255, 220, 100);
        continue;
      }
      // Off screen — missed material
      if (mat.y > h + 20 || mat.x < -30 || mat.x > w + 30) {
        s.fallingMaterials.splice(i, 1);
      }
    }

    // Wind blows caught materials away if not holding
    if (s.windActive && !s.isHolding && s.caughtMaterials.length > 0 && Math.random() < delta * 0.5) {
      const lost = s.caughtMaterials.pop();
      if (lost) {
        lost.vx = s.windDirection * 100;
        lost.y = s.nestY - 10;
        s.fallingMaterials.push(lost);
        sounds.fail();
        haptics.failFeedback();
        juice.flash('#EF4444', 0.2);
        juice.shake(4, 0.2);
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

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      if (s.score >= 80) {
        sounds.success();
        haptics.successFeedback();
        juice.flash('#22C55E', 0.4);
      } else {
        sounds.fail();
        haptics.heavyFeedback();
        juice.flash('#EF4444', 0.3);
      }
      juice.shake(8, 0.4);
      return;
    }

    // --- RENDER ---
    ctx.save();
    ctx.translate(s.shakeOffset, 0);
    juice.applyShake(ctx);

    // Sunset background
    const sunsetGrad = ctx.createLinearGradient(0, 0, 0, h);
    sunsetGrad.addColorStop(0, '#FF6B35');
    sunsetGrad.addColorStop(0.3, '#FF8C42');
    sunsetGrad.addColorStop(0.5, '#FFA07A');
    sunsetGrad.addColorStop(0.7, '#FFD4A8');
    sunsetGrad.addColorStop(1, '#2D1B00');
    ctx.fillStyle = sunsetGrad;
    ctx.fillRect(-10, 0, w + 20, h);

    // Sun with glow
    const sunGrad = ctx.createRadialGradient(w * 0.7, h * 0.15, 10, w * 0.7, h * 0.15, 80);
    sunGrad.addColorStop(0, 'rgba(255,220,100,0.8)');
    sunGrad.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(w * 0.5, 0, w * 0.4, h * 0.35);
    juice.drawGlow(ctx, w * 0.7, h * 0.15, 100, '#FFDC64', 0.3);

    // Branch
    ctx.strokeStyle = '#5C3D1E';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-10, s.branchY);
    ctx.quadraticCurveTo(w * 0.3, s.branchY + 15, w * 0.5, s.branchY);
    ctx.quadraticCurveTo(w * 0.7, s.branchY - 10, w + 10, s.branchY + 5);
    ctx.stroke();
    ctx.strokeStyle = '#4A2F0F';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-10, s.branchY + 2);
    ctx.quadraticCurveTo(w * 0.3, s.branchY + 17, w * 0.5, s.branchY + 2);
    ctx.quadraticCurveTo(w * 0.7, s.branchY - 8, w + 10, s.branchY + 7);
    ctx.stroke();

    // Nest base
    const nestW = s.nestWidth + s.nestLayers * 4;
    const nestH = 15 + s.nestLayers * 5;
    ctx.save();
    ctx.translate(s.nestX, s.nestY);

    // Glow under nest
    juice.drawGlow(ctx, 0, 0, nestW * 0.9, '#F5A623', 0.2);

    // Nest bowl shape
    ctx.beginPath();
    ctx.ellipse(0, 0, nestW / 2, nestH / 2, 0, 0, Math.PI);
    ctx.fillStyle = '#8B6914';
    ctx.fill();
    ctx.strokeStyle = '#6B4F10';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Nest rim
    ctx.beginPath();
    ctx.ellipse(0, 0, nestW / 2, 6, 0, Math.PI, Math.PI * 2);
    ctx.strokeStyle = '#A07D20';
    ctx.lineWidth = 3;
    ctx.stroke();

    // Draw integrated materials in nest
    for (let i = 0; i < s.nestMaterials.length; i++) {
      const mat = s.nestMaterials[i];
      const mx = -nestW / 3 + (i % 6) * (nestW / 5);
      const my = 3 + Math.floor(i / 6) * 5;
      drawMaterial(ctx, mat, mx, my);
    }

    ctx.restore();

    // Caught materials indicator (above nest) — neon style
    if (s.caughtMaterials.length > 0) {
      juice.drawGlow(ctx, s.nestX, s.nestY - 35, 40, '#FFE066', 0.25);
      juice.drawNeonText(ctx, `${s.caughtMaterials.length} caught - TAP to weave!`, s.nestX, s.nestY - 30, '#FFE066', 14);
    }

    // Falling materials with glow
    for (const mat of s.fallingMaterials) {
      ctx.save();
      ctx.translate(mat.x, mat.y);
      ctx.rotate(mat.rotation);
      // Subtle glow behind falling items
      const glowColor = mat.type === 'flower' ? '#E91E8C' : mat.type === 'leaf' ? '#22C55E' : mat.type === 'moss' ? '#4CAF50' : '#F5A623';
      juice.drawGlow(ctx, 0, 0, 18, glowColor, 0.15);
      drawMaterial(ctx, mat, 0, 0);
      ctx.restore();
    }

    // Shield indicator with glow
    if (s.isHolding) {
      juice.drawGlow(ctx, s.nestX, s.nestY - 10, nestW * 1.2, '#64C8FF', 0.3);
      ctx.beginPath();
      ctx.arc(s.nestX, s.nestY - 10, nestW * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,200,255,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,200,255,0.1)';
      ctx.fill();
    }

    // Wind indicator — neon text
    if (s.windActive) {
      const windAlpha = 0.5 + 0.5 * Math.sin(elapsed * 8);
      ctx.globalAlpha = windAlpha;
      juice.drawNeonText(ctx, s.windDirection > 0 ? 'WIND \u2192\u2192\u2192' : '\u2190\u2190\u2190 WIND', w / 2, h * 0.2, '#00D4FF', 18);
      ctx.globalAlpha = 1;
      // Wind lines
      for (let i = 0; i < 8; i++) {
        const lx = (w * (i / 8) + elapsed * 200 * s.windDirection) % w;
        const ly = h * 0.3 + Math.sin(i * 2 + elapsed * 3) * 30;
        ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lx, ly);
        ctx.lineTo(lx + s.windDirection * 30, ly);
        ctx.stroke();
      }
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

    ctx.restore(); // shake

    // Draw screen flash
    juice.drawFlash(ctx, w, h);

    // Solidarity gauge with glow
    const gaugeW = w * 0.5;
    const gaugeH = 14;
    const gaugeX = (w - gaugeW) / 2;
    const gaugeY = h * 0.92;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(gaugeX - 2, gaugeY - 2, gaugeW + 4, gaugeH + 4);
    const gaugeGrad = ctx.createLinearGradient(gaugeX, 0, gaugeX + gaugeW, 0);
    gaugeGrad.addColorStop(0, '#E91E8C');
    gaugeGrad.addColorStop(0.5, '#F5A623');
    gaugeGrad.addColorStop(1, '#22C55E');
    ctx.fillStyle = gaugeGrad;
    const gaugeFill = gaugeW * (s.solidarityGauge / 100);
    ctx.fillRect(gaugeX, gaugeY, gaugeFill, gaugeH);
    // Glow at gauge tip
    if (s.solidarityGauge > 5) {
      juice.drawGlow(ctx, gaugeX + gaugeFill, gaugeY + gaugeH / 2, 15, '#F5A623', 0.35);
    }
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);

    // Solidarity label — neon
    juice.drawNeonText(ctx, `Solidarity: ${Math.floor(s.solidarityGauge)}%`, w / 2, gaugeY - 8, '#F5A623', 12);

    // Types collected
    ctx.font = `12px ${FONT_FAMILY}`;
    ctx.textAlign = 'left';
    const typeIcons = { twig: '\uD83E\uDEB5', leaf: '\uD83C\uDF43', moss: '\uD83C\uDF3F', flower: '\uD83C\uDF38' };
    let tx = 20;
    for (const t of MATERIAL_TYPES) {
      ctx.fillStyle = s.typesCollected.has(t) ? COLORS.white : 'rgba(255,255,255,0.3)';
      ctx.fillText(typeIcons[t] + (s.typesCollected.has(t) ? ' \u2713' : ''), tx, h * 0.88);
      tx += 55;
    }

    // Score — neon text
    juice.drawNeonText(ctx, `Score: ${s.score}`, 70, 40, COLORS.mint, 22);

    // Timer — neon with red glow when low
    const timerColor = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.save();
    ctx.textAlign = 'right';
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 20, 40, timerColor, 24);
    ctx.restore();
    if (s.timeLeft < 5) {
      juice.drawGlow(ctx, w - 30, 40, 30, COLORS.red, 0.3 + 0.2 * Math.sin(elapsed * 8));
    }

    ctx.restore();

    // Update juice system
    juice.update(delta);
  }, [phase, sounds, spawnParticles, haptics, juice]));

  useEffect(() => { if (phase === 'ready') gameLoop.start(); }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0; s.solidarityGauge = 0; s.nestMaterials = []; s.caughtMaterials = [];
      s.fallingMaterials = []; s.materialSpawnTimer = 0; s.typesCollected = new Set();
      s.diversityBonusGiven = false; s.windTimer = 0; s.windActive = false;
      s.nestLayers = 0; s.nestX = window.innerWidth / 2; s.isHolding = false;
      gameLoop.reset(); gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => { if (phase === 'ended') gameLoop.stop(); }, [phase, gameLoop]);
  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const finalScore = state.current.score;
  const finalSolidarity = Math.floor(state.current.solidarityGauge);
  const isHighScore = finalScore >= 80;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 30, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 20px ${isHighScore ? COLORS.mint : COLORS.gold}, 0 0 40px ${isHighScore ? COLORS.mint : COLORS.gold}50`,
          }}>
            Nest Complete!
          </div>
          <div style={{
            color: COLORS.gold, fontSize: 48, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 20px ${COLORS.gold}, 0 0 40px ${COLORS.gold}80, 0 0 60px ${COLORS.gold}40`,
          }}>
            {finalScore}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 15, marginBottom: 4,
            textShadow: '0 0 8px rgba(245,166,35,0.5)',
          }}>
            Solidarity: {finalSolidarity}%
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 13, marginBottom: 24,
            textShadow: '0 0 6px rgba(255,255,255,0.3)',
          }}>
            Dukdukdiya builds with love
          </div>
          <button onClick={() => { sounds.pop(); haptics.tapFeedback(); onComplete(state.current.score); }} style={{
            background: `linear-gradient(135deg, ${COLORS.mint}, ${COLORS.emerald})`,
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.mint}60, 0 4px 15px rgba(0,0,0,0.3)`,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}>Continue</button>
          <button onClick={() => { sounds.tick(); haptics.tapFeedback(); onBack(); }} style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
            color: COLORS.gray, border: `1px solid ${COLORS.gray}50`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            backdropFilter: 'blur(4px)',
            WebkitBackdropFilter: 'blur(4px)',
          }}>Back</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => { haptics.tapFeedback(); onBack(); }} style={{
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
