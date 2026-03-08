import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 45;
const POOL_SIZE = 120;
const WATER_ZONE_TOP = 0.65;
const FIRE_ZONE_BOTTOM = 0.35;
const MAX_ENERGY = 100;
const MAX_WATER_GAUGE = 100;

export default function GamePlongeonSacre({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const sounds = useSounds();

  const state = useRef({
    score: 0,
    timeLeft: GAME_DURATION,
    parrotX: 0,
    parrotY: 0,
    parrotVY: 0,
    cyclePhase: 'fly',
    waterGauge: 0,
    energy: MAX_ENERGY,
    cycles: 0,
    dropsDelivered: 0,
    fireHealth: 100,
    obstacles: [],
    obstacleSpawnTimer: 0,
    waterDrops: [],
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    soakTimer: 0,
    waveOffset: 0,
    fireFlicker: 0,
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
        const speed = 40 + Math.random() * 100;
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
    if (direction === 'down') {
      s.parrotVY = 200;
      if (s.cyclePhase === 'fly') {
        s.cyclePhase = 'diving';
      }
    } else if (direction === 'up') {
      s.parrotVY = -250;
      if (s.cyclePhase === 'soak') {
        s.cyclePhase = 'flying_up';
        s.cycles++;
        sounds.whoosh();
      }
    } else if (direction === 'left') {
      s.parrotX = Math.max(30, s.parrotX - 50);
    } else if (direction === 'right') {
      s.parrotX = Math.min(window.innerWidth - 30, s.parrotX + 50);
    }
  }, [phase, sounds]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') { setPhase('playing'); return; }
    if (phase !== 'playing') return;
    const s = state.current;
    const h = window.innerHeight;
    // Release water drop when in fire zone
    if (s.cyclePhase === 'flying_up' && s.waterGauge > 0 && s.parrotY < h * FIRE_ZONE_BOTTOM) {
      s.waterGauge -= 10;
      s.dropsDelivered++;
      s.fireHealth = Math.max(0, s.fireHealth - 5);
      const pts = Math.floor(5 + (s.waterGauge / MAX_WATER_GAUGE) * 5);
      s.score += pts;
      setDisplayScore(s.score);
      s.waterDrops.push({
        x: s.parrotX,
        y: s.parrotY + 20,
        vy: 100,
        size: 5,
        life: 1.5,
      });
      spawnParticles(s.parrotX, s.parrotY + 20, 5, 0, 191, 255);
      sounds.splash();
    }
  }, [phase, sounds, spawnParticles]);

  const handleHoldStart = useCallback(() => {
    if (phase !== 'playing') return;
    state.current.soakTimer = 0;
  }, [phase]);

  useTouch(canvasRef, {
    onSwipe: handleSwipe,
    onTap: handleTap,
    onHoldStart: handleHoldStart,
  });

  function drawParrot(ctx, x, y, waterLevel, time) {
    ctx.save();
    ctx.translate(x, y);
    const wingFlap = Math.sin(time * 6) * 0.4;

    // Water sheen if carrying water
    if (waterLevel > 0) {
      const sheenAlpha = (waterLevel / MAX_WATER_GAUGE) * 0.3;
      ctx.beginPath();
      ctx.arc(0, 0, 25, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,191,255,${sheenAlpha})`;
      ctx.fill();
    }

    // Body
    ctx.fillStyle = '#22C55E';
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 22, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(0, -24, 11, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#F5A623';
    ctx.beginPath();
    ctx.moveTo(8, -24);
    ctx.lineTo(18, -20);
    ctx.lineTo(8, -18);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(3, -26, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(4, -27, 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.save();
    ctx.rotate(wingFlap);
    ctx.fillStyle = '#1CA04A';
    ctx.beginPath();
    ctx.ellipse(-14, -2, 8, 16, -0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(14, -2, 8, 16, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Tail
    ctx.fillStyle = '#1CA04A';
    ctx.beginPath();
    ctx.moveTo(-5, 18);
    ctx.lineTo(-10, 34);
    ctx.lineTo(0, 28);
    ctx.lineTo(10, 34);
    ctx.lineTo(5, 18);
    ctx.closePath();
    ctx.fill();

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
    const waterZoneY = h * WATER_ZONE_TOP;
    const fireZoneY = h * FIRE_ZONE_BOTTOM;

    if (phase === 'ready') {
      ctx.fillStyle = '#0A0F1C';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Plongeon Sacre', w / 2, h / 2 - 80);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Dive into the lake, soak feathers,', w / 2, h / 2 - 30);
      ctx.fillText('fly over fire to extinguish it!', w / 2, h / 2 - 8);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE DOWN: dive into water', w / 2, h / 2 + 35);
      ctx.fillText('HOLD in water to soak', w / 2, h / 2 + 55);
      ctx.fillText('SWIPE UP: fly to fire zone', w / 2, h / 2 + 75);
      ctx.fillText('TAP: release water drops on fire', w / 2, h / 2 + 95);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAP TO START', w / 2, h / 2 + 140);
      ctx.restore();
      return;
    }

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    if (s.parrotX === 0) { s.parrotX = w / 2; s.parrotY = h * 0.5; }

    // Parrot physics
    s.parrotY += s.parrotVY * delta;
    s.parrotVY *= 0.95;
    s.parrotY = Math.max(30, Math.min(h - 30, s.parrotY));

    // Phase logic
    if (s.cyclePhase === 'diving' && s.parrotY >= waterZoneY) {
      s.cyclePhase = 'soak';
      s.parrotVY = 0;
      spawnParticles(s.parrotX, waterZoneY, 10, 0, 191, 255);
      sounds.splash();
    }

    if (s.cyclePhase === 'soak') {
      s.parrotY = Math.max(waterZoneY, Math.min(h - 30, s.parrotY));
      s.soakTimer += delta;
      s.waterGauge = Math.min(MAX_WATER_GAUGE, s.waterGauge + delta * 25);
      s.energy -= delta * 12;
      if (s.energy <= 0) {
        s.energy = 0;
        s.cyclePhase = 'flying_up';
        s.parrotVY = -200;
        s.cycles++;
      }
      // Bubble particles
      if (Math.random() < delta * 5) {
        spawnParticles(s.parrotX + (Math.random() - 0.5) * 20, s.parrotY - 10, 1, 100, 200, 255);
      }
    }

    if (s.cyclePhase === 'flying_up') {
      if (s.parrotY < fireZoneY) {
        s.energy = Math.min(MAX_ENERGY, s.energy + delta * 8);
      }
      if (s.parrotY <= 40 && s.parrotVY < 0) {
        s.parrotVY = 0;
        s.cyclePhase = 'fly';
      }
      if (s.waterGauge <= 0 && s.parrotY > fireZoneY) {
        s.cyclePhase = 'fly';
      }
    }

    if (s.cyclePhase === 'fly') {
      s.energy = Math.min(MAX_ENERGY, s.energy + delta * 15);
    }

    // Spawn obstacles in fire zone
    s.obstacleSpawnTimer += delta;
    if (s.obstacleSpawnTimer > 1.5) {
      s.obstacleSpawnTimer = 0;
      s.obstacles.push({
        x: -30,
        y: 30 + Math.random() * (fireZoneY - 60),
        vx: 60 + Math.random() * 40,
        size: 12 + Math.random() * 10,
      });
    }

    // Update obstacles
    for (let i = s.obstacles.length - 1; i >= 0; i--) {
      const o = s.obstacles[i];
      o.x += o.vx * delta;
      if (o.x > w + 40) { s.obstacles.splice(i, 1); }
    }

    // Water drops
    for (let i = s.waterDrops.length - 1; i >= 0; i--) {
      const d = s.waterDrops[i];
      d.y += d.vy * delta;
      d.life -= delta;
      if (d.life <= 0 || d.y > h) {
        s.waterDrops.splice(i, 1);
      }
    }

    s.waveOffset += delta;
    s.fireFlicker += delta;

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      return;
    }

    // --- RENDER ---
    // Fire zone (top)
    const fireIntensity = s.fireHealth / 100;
    const fireGrad = ctx.createLinearGradient(0, 0, 0, fireZoneY);
    fireGrad.addColorStop(0, `rgba(${Math.floor(200 * fireIntensity)},${Math.floor(30 * fireIntensity)},0,1)`);
    fireGrad.addColorStop(0.5, `rgba(${Math.floor(255 * fireIntensity)},${Math.floor(80 * fireIntensity)},0,1)`);
    fireGrad.addColorStop(1, `rgba(${Math.floor(180 * fireIntensity)},${Math.floor(100 * fireIntensity)},${Math.floor(50 * (1 - fireIntensity))},1)`);
    ctx.fillStyle = fireGrad;
    ctx.fillRect(0, 0, w, fireZoneY);

    // Fire flames at boundary
    if (fireIntensity > 0.1) {
      for (let i = 0; i < 12; i++) {
        const fx = (i / 12) * w + Math.sin(s.fireFlicker * 3 + i) * 10;
        const fh = 20 + Math.sin(s.fireFlicker * 5 + i * 2) * 10;
        ctx.beginPath();
        ctx.moveTo(fx - 10, fireZoneY);
        ctx.quadraticCurveTo(fx, fireZoneY - fh * fireIntensity, fx + 10, fireZoneY);
        ctx.fillStyle = `rgba(255,${Math.floor(120 + Math.sin(s.fireFlicker * 4 + i) * 50)},0,${0.5 * fireIntensity})`;
        ctx.fill();
      }
    }

    // Transition zone
    const transGrad = ctx.createLinearGradient(0, fireZoneY, 0, waterZoneY);
    transGrad.addColorStop(0, `rgba(180,100,50,${fireIntensity * 0.7})`);
    transGrad.addColorStop(0.5, '#334155');
    transGrad.addColorStop(1, '#1E3A5F');
    ctx.fillStyle = transGrad;
    ctx.fillRect(0, fireZoneY, w, waterZoneY - fireZoneY);

    // Water zone
    const waterGrad = ctx.createLinearGradient(0, waterZoneY, 0, h);
    waterGrad.addColorStop(0, '#1E90FF');
    waterGrad.addColorStop(0.4, '#1565C0');
    waterGrad.addColorStop(1, '#0A2647');
    ctx.fillStyle = waterGrad;
    ctx.fillRect(0, waterZoneY, w, h - waterZoneY);

    // Water surface waves
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x < w; x += 3) {
      const wy = waterZoneY + Math.sin(x * 0.04 + s.waveOffset * 2) * 3;
      if (x === 0) ctx.moveTo(x, wy);
      else ctx.lineTo(x, wy);
    }
    ctx.stroke();

    // Zone labels
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillText('FIRE ZONE', w / 2, 20);
    ctx.fillText('WATER ZONE', w / 2, waterZoneY + 15);

    // Obstacles
    for (const o of s.obstacles) {
      ctx.beginPath();
      ctx.arc(o.x, o.y, o.size, 0, Math.PI * 2);
      const oGrad = ctx.createRadialGradient(o.x, o.y, 0, o.x, o.y, o.size);
      oGrad.addColorStop(0, '#FFE066');
      oGrad.addColorStop(0.6, '#FF6600');
      oGrad.addColorStop(1, 'rgba(255,50,0,0)');
      ctx.fillStyle = oGrad;
      ctx.fill();
    }

    // Water drops falling
    for (const d of s.waterDrops) {
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0,191,255,${d.life})`;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(d.x, d.y - 8, d.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(100,200,255,${d.life * 0.5})`;
      ctx.fill();
    }

    // Parrot
    drawParrot(ctx, s.parrotX, s.parrotY, s.waterGauge, elapsed);

    // Particles
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }

    // Water gauge (left)
    const gx = 15;
    const gTop = 90;
    const gH = h * 0.25;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(gx, gTop, 14, gH);
    ctx.fillStyle = '#00BFFF';
    const wFill = (s.waterGauge / MAX_WATER_GAUGE) * gH;
    ctx.fillRect(gx, gTop + gH - wFill, 14, wFill);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(gx, gTop, 14, gH);
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.water;
    ctx.fillText('H2O', gx + 7, gTop - 4);

    // Energy gauge
    const eTop = gTop + gH + 15;
    const eH = h * 0.15;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(gx, eTop, 14, eH);
    ctx.fillStyle = s.energy < 25 ? '#EF4444' : '#22C55E';
    const eFill = (s.energy / MAX_ENERGY) * eH;
    ctx.fillRect(gx, eTop + eH - eFill, 14, eFill);
    ctx.strokeStyle = '#fff';
    ctx.strokeRect(gx, eTop, 14, eH);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.fillText('NRG', gx + 7, eTop - 4);

    // Phase indicator
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const phaseLabel = s.cyclePhase === 'fly' ? 'FLY' : s.cyclePhase === 'diving' ? 'DIVE!' :
      s.cyclePhase === 'soak' ? 'SOAKING...' : 'DELIVER!';
    const phaseColor = s.cyclePhase === 'soak' ? COLORS.water : s.cyclePhase === 'flying_up' ? COLORS.fire : COLORS.white;
    ctx.fillStyle = phaseColor;
    ctx.fillText(phaseLabel, w / 2, h * 0.48);

    // Cycle counter
    ctx.font = '14px sans-serif';
    ctx.fillStyle = COLORS.gray;
    ctx.fillText(`Cycles: ${s.cycles}  |  Drops: ${s.dropsDelivered}`, w / 2, 88);

    // Fire health bar
    const fBarW = w * 0.4;
    const fBarX = (w - fBarW) / 2;
    const fBarY = h * 0.96;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(fBarX, fBarY, fBarW, 8);
    ctx.fillStyle = s.fireHealth > 50 ? '#FF4500' : s.fireHealth > 20 ? '#F5A623' : '#22C55E';
    ctx.fillRect(fBarX, fBarY, fBarW * (s.fireHealth / 100), 8);
    ctx.font = '10px sans-serif';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Fire: ${Math.floor(s.fireHealth)}%`, w / 2, fBarY - 3);

    // Score & timer
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${s.score}`, 40, 40);
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
      s.score = 0; s.waterGauge = 0; s.energy = MAX_ENERGY; s.cycles = 0;
      s.dropsDelivered = 0; s.fireHealth = 100; s.obstacles = []; s.waterDrops = [];
      s.cyclePhase = 'fly'; s.parrotX = window.innerWidth / 2;
      s.parrotY = window.innerHeight * 0.5; s.parrotVY = 0;
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
          <div style={{ color: COLORS.white, fontSize: 30, fontWeight: 'bold', marginBottom: 8 }}>Sacred Dive!</div>
          <div style={{ color: COLORS.water, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>{state.current.score}</div>
          <div style={{ color: COLORS.gray, fontSize: 15, marginBottom: 4 }}>
            Drops delivered: {state.current.dropsDelivered} | Cycles: {state.current.cycles}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 13, marginBottom: 24 }}>
            Fire reduced to {Math.floor(state.current.fireHealth)}%
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
