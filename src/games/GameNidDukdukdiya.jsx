import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 45;
const POOL_SIZE = 100;
const WIND_INTERVAL = 8;
const MATERIAL_TYPES = ['twig', 'leaf', 'moss', 'flower'];

export default function GameNidDukdukdiya({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const sounds = useSounds();

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
  }, [phase]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') { setPhase('playing'); return; }
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

      // Diversity bonus
      if (s.typesCollected.size >= 4 && !s.diversityBonusGiven) {
        s.diversityBonusGiven = true;
        s.score += 30;
        s.solidarityGauge = Math.min(100, s.solidarityGauge + 15);
        setDisplayScore(s.score);
        spawnParticles(s.nestX, s.nestY, 20, 233, 30, 140);
      }
    }
  }, [phase, sounds, spawnParticles]);

  const handleHoldStart = useCallback(() => {
    if (phase !== 'playing') return;
    state.current.isHolding = true;
  }, [phase]);

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
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Nid de Dukdukdiya', w / 2, h / 2 - 70);
      ctx.font = '16px sans-serif';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Dukdukdiya builds with love', w / 2, h / 2 - 20);
      ctx.font = '14px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE L/R: move nest', w / 2, h / 2 + 30);
      ctx.fillText('TAP: weave material into nest', w / 2, h / 2 + 52);
      ctx.fillText('HOLD: shield against wind', w / 2, h / 2 + 74);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAP TO START', w / 2, h / 2 + 120);
      ctx.restore();
      return;
    }

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

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
        sounds.tick();
        continue;
      }
      // Off screen
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
      return;
    }

    // --- RENDER ---
    ctx.save();
    ctx.translate(s.shakeOffset, 0);

    // Sunset background
    const sunsetGrad = ctx.createLinearGradient(0, 0, 0, h);
    sunsetGrad.addColorStop(0, '#FF6B35');
    sunsetGrad.addColorStop(0.3, '#FF8C42');
    sunsetGrad.addColorStop(0.5, '#FFA07A');
    sunsetGrad.addColorStop(0.7, '#FFD4A8');
    sunsetGrad.addColorStop(1, '#2D1B00');
    ctx.fillStyle = sunsetGrad;
    ctx.fillRect(-10, 0, w + 20, h);

    // Sun
    const sunGrad = ctx.createRadialGradient(w * 0.7, h * 0.15, 10, w * 0.7, h * 0.15, 80);
    sunGrad.addColorStop(0, 'rgba(255,220,100,0.8)');
    sunGrad.addColorStop(1, 'rgba(255,150,50,0)');
    ctx.fillStyle = sunGrad;
    ctx.fillRect(w * 0.5, 0, w * 0.4, h * 0.35);

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

    // Caught materials indicator (above nest)
    if (s.caughtMaterials.length > 0) {
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#FFE066';
      ctx.fillText(`${s.caughtMaterials.length} caught - TAP to weave!`, s.nestX, s.nestY - 30);
    }

    // Falling materials
    for (const mat of s.fallingMaterials) {
      ctx.save();
      ctx.translate(mat.x, mat.y);
      ctx.rotate(mat.rotation);
      drawMaterial(ctx, mat, 0, 0);
      ctx.restore();
    }

    // Shield indicator
    if (s.isHolding) {
      ctx.beginPath();
      ctx.arc(s.nestX, s.nestY - 10, nestW * 0.8, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(100,200,255,0.5)';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = 'rgba(100,200,255,0.1)';
      ctx.fill();
    }

    // Wind indicator
    if (s.windActive) {
      ctx.font = 'bold 18px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(255,255,255,${0.5 + 0.5 * Math.sin(elapsed * 8)})`;
      ctx.fillText(s.windDirection > 0 ? 'WIND →→→' : '←←← WIND', w / 2, h * 0.2);
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

    // Particles
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }

    ctx.restore(); // shake

    // Solidarity gauge
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
    ctx.fillRect(gaugeX, gaugeY, gaugeW * (s.solidarityGauge / 100), gaugeH);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(gaugeX, gaugeY, gaugeW, gaugeH);
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Solidarity: ${Math.floor(s.solidarityGauge)}%`, w / 2, gaugeY - 5);

    // Types collected
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    const typeIcons = { twig: '🪵', leaf: '🍃', moss: '🌿', flower: '🌸' };
    let tx = 20;
    for (const t of MATERIAL_TYPES) {
      ctx.fillStyle = s.typesCollected.has(t) ? COLORS.white : 'rgba(255,255,255,0.3)';
      ctx.fillText(typeIcons[t] + (s.typesCollected.has(t) ? ' ✓' : ''), tx, h * 0.88);
      tx += 55;
    }

    // Score & timer
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${s.score}`, 20, 40);
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    ctx.restore();
  }, [phase, sounds, spawnParticles]));

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }}>
          <div style={{ color: COLORS.white, fontSize: 30, fontWeight: 'bold', marginBottom: 8 }}>Nest Complete!</div>
          <div style={{ color: COLORS.gold, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>{state.current.score}</div>
          <div style={{ color: COLORS.gray, fontSize: 15, marginBottom: 4 }}>
            Solidarity: {Math.floor(state.current.solidarityGauge)}%
          </div>
          <div style={{ color: COLORS.gray, fontSize: 13, marginBottom: 24 }}>
            Dukdukdiya builds with love
          </div>
          <button onClick={() => onComplete(state.current.score)} style={{
            background: COLORS.mint, color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold', cursor: 'pointer', marginBottom: 12,
          }}>Continue</button>
          <button onClick={onBack} style={{
            background: 'transparent', color: COLORS.gray, border: `1px solid ${COLORS.gray}`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
          }}>Back</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={onBack} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
          color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 14, cursor: 'pointer', zIndex: 10,
        }}>Back</button>
      )}
    </div>
  );
}
