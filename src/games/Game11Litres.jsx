import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 15;
const TARGET_LITRES = 11;
const POOL_SIZE = 100;

export default function Game11Litres({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const sounds = useSounds();

  const state = useRef({
    litres: 0,
    timeLeft: GAME_DURATION,
    pelicanX: 0,
    pelicanY: 0,
    targetAlt: 0.35,
    altitude: 0.35,
    scooping: false,
    scoopCooldown: 0,
    scoopFlash: 0,
    lastScoopAmount: 0,
    wavePhase: 0,
    waveAmplitude: 18,
    spillFlash: 0,
    spillAmount: 0,
    totalScoops: 0,
    perfectScoops: 0,
    seagulls: Array(5).fill(null).map(() => ({
      x: -100, y: 80 + Math.random() * 200,
      speed: 80 + Math.random() * 120,
      wingPhase: Math.random() * Math.PI * 2,
      active: false,
      spawnTimer: 2 + Math.random() * 4,
    })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    clouds: Array(6).fill(null).map(() => ({
      x: Math.random() * 1000,
      y: 30 + Math.random() * 120,
      w: 50 + Math.random() * 90,
      speed: 8 + Math.random() * 20,
      alpha: 0.08 + Math.random() * 0.12,
    })),
  });

  const spawnParticles = useCallback((cx, cy, count, colors) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 20;
        p.y = cy + (Math.random() - 0.5) * 10;
        const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.0;
        const speed = 40 + Math.random() * 120;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        const c = colors[Math.floor(Math.random() * colors.length)];
        p.r = c[0]; p.g = c[1]; p.b = c[2];
        p.size = 1.5 + Math.random() * 3;
        p.type = Math.random() > 0.4 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') {
      if (phase === 'ready') setPhase('playing');
      return;
    }
    const s = state.current;
    if (direction === 'down') {
      s.targetAlt = 0.78;
      s.scooping = true;
    } else if (direction === 'up') {
      s.targetAlt = 0.2;
      s.scooping = false;
    }
  }, [phase]);

  const handleTap = useCallback(() => {
    if (phase === 'ready') setPhase('playing');
  }, [phase]);

  useTouch(canvasRef, { onSwipe: handleSwipe, onTap: handleTap });

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

    // --- READY SCREEN ---
    if (phase === 'ready') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#1a5276');
      skyGrad.addColorStop(0.6, '#5dade2');
      skyGrad.addColorStop(1, '#1a8ccc');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      const waveY = h * 0.8;
      ctx.beginPath();
      ctx.moveTo(0, waveY);
      for (let x = 0; x <= w; x += 4) {
        ctx.lineTo(x, waveY + Math.sin(x * 0.02 + elapsed * 2) * 12 + Math.sin(x * 0.01 + elapsed) * 8);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = '#1565C0';
      ctx.fill();

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('11 Litres', cx, h * 0.25);
      ctx.font = '18px sans-serif';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText("A pelican's pouch holds 11 litres!", cx, h * 0.35);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('SWIPE DOWN to scoop water', cx, h * 0.47);
      ctx.fillText('SWIPE UP to fly higher & dodge', cx, h * 0.47 + 22);
      ctx.font = 'bold 20px sans-serif';
      ctx.fillStyle = COLORS.white;
      ctx.globalAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.fillText('TAP TO START', cx, h * 0.62);
      ctx.globalAlpha = 1;
      ctx.restore();
      return;
    }

    // --- UPDATE ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.wavePhase += delta * 2.5;

    // Pelican altitude interpolation
    s.altitude += (s.targetAlt - s.altitude) * Math.min(1, delta * 5);
    s.pelicanX = cx - 20;
    s.pelicanY = h * s.altitude;

    if (s.scoopCooldown > 0) s.scoopCooldown -= delta;

    // Scoop when pelican near water
    const waveSurface = h * 0.75;
    if (s.scooping && s.pelicanY > waveSurface && s.scoopCooldown <= 0 && s.litres < TARGET_LITRES) {
      const waveVal = Math.sin(s.pelicanX * 0.02 + s.wavePhase);
      const timing = (waveVal + 1) / 2;
      const amt = 0.5 + timing * 1.5;
      s.litres = Math.min(TARGET_LITRES, s.litres + amt);
      s.lastScoopAmount = amt;
      s.scoopFlash = 0.5;
      s.scoopCooldown = 0.6;
      s.totalScoops++;
      if (amt >= 1.5) s.perfectScoops++;
      s.targetAlt = 0.35;
      s.scooping = false;
      spawnParticles(s.pelicanX, s.pelicanY + 15, 8, [[0, 191, 255], [0, 150, 220], [255, 255, 255]]);
      sounds.splash();
    }

    s.scoopFlash *= Math.pow(0.01, delta);
    s.spillFlash *= Math.pow(0.01, delta);

    // Seagull logic
    for (const g of s.seagulls) {
      if (!g.active) {
        g.spawnTimer -= delta;
        if (g.spawnTimer <= 0) {
          g.active = true;
          g.x = w + 40;
          g.y = 60 + Math.random() * (h * 0.5);
          g.speed = 100 + Math.random() * 140;
        }
        continue;
      }
      g.x -= g.speed * delta;
      g.wingPhase += delta * 8;
      // Collision
      if (Math.abs(g.x - s.pelicanX) < 35 && Math.abs(g.y - s.pelicanY) < 25) {
        s.litres = Math.max(0, s.litres - 1);
        s.spillFlash = 0.4;
        s.spillAmount = 1;
        g.active = false;
        g.spawnTimer = 3 + Math.random() * 4;
        spawnParticles(s.pelicanX, s.pelicanY, 6, [[239, 68, 68], [255, 150, 100], [255, 255, 255]]);
        sounds.tick();
        continue;
      }
      if (g.x < -60) {
        g.active = false;
        g.spawnTimer = 2 + Math.random() * 3;
      }
    }

    // Cloud movement
    for (const c of s.clouds) {
      c.x -= c.speed * delta;
      if (c.x + c.w < 0) {
        c.x = w + 20;
        c.y = 30 + Math.random() * 120;
      }
    }

    // Particle update
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 60 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over check
    if (s.timeLeft <= 0 && phase === 'playing') {
      const speedBonus = s.litres >= TARGET_LITRES ? 2.0 : 1.0;
      setPhase('ended');
      setDisplayScore(Math.round(s.litres * speedBonus * 10));
      return;
    }

    // --- RENDER ---
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#1a5276');
    skyGrad.addColorStop(0.5, '#5dade2');
    skyGrad.addColorStop(1, '#2e86c1');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Clouds
    for (const c of s.clouds) {
      ctx.beginPath();
      ctx.ellipse(c.x, c.y, c.w, c.w * 0.35, 0, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,255,${c.alpha})`;
      ctx.fill();
    }

    // Ocean waves (3 layers)
    const waveBase = h * 0.78;
    const waveColors = ['#1565C0', '#0D47A1', '#0A3570'];
    for (let layer = 0; layer < 3; layer++) {
      const off = layer * 6;
      ctx.beginPath();
      ctx.moveTo(0, waveBase + off);
      for (let x = 0; x <= w; x += 3) {
        const y = waveBase + off
          + Math.sin(x * 0.02 + s.wavePhase + layer * 1.2) * s.waveAmplitude
          + Math.sin(x * 0.008 + s.wavePhase * 0.7 + layer) * 10;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(w, h);
      ctx.lineTo(0, h);
      ctx.closePath();
      ctx.fillStyle = waveColors[layer];
      ctx.globalAlpha = 0.6 + layer * 0.15;
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // Screen flashes
    if (s.scoopFlash > 0.01) {
      ctx.fillStyle = `rgba(0,191,255,${s.scoopFlash * 0.4})`;
      ctx.fillRect(0, 0, w, h);
    }
    if (s.spillFlash > 0.01) {
      ctx.fillStyle = `rgba(239,68,68,${s.spillFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw pelican
    const px = s.pelicanX, py = s.pelicanY;
    ctx.save(); ctx.translate(px, py);
    // Body
    ctx.beginPath(); ctx.ellipse(0, 0, 30, 16, 0, 0, Math.PI * 2); ctx.fillStyle = '#F5F5DC'; ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(30, -10, 12, 0, Math.PI * 2); ctx.fillStyle = '#FFF8E1'; ctx.fill();
    // Eye
    ctx.beginPath(); ctx.arc(35, -12, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#000'; ctx.fill();
    ctx.beginPath(); ctx.arc(35.5, -12.5, 1, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    // Beak
    ctx.beginPath(); ctx.moveTo(40, -8); ctx.lineTo(65, -6); ctx.lineTo(65, -2); ctx.lineTo(40, 2);
    ctx.closePath(); ctx.fillStyle = '#F5A623'; ctx.fill();
    // Pouch (bulges with water)
    const pouchFill = s.litres / TARGET_LITRES;
    ctx.beginPath(); ctx.moveTo(40, 2); ctx.quadraticCurveTo(52, 8 + pouchFill * 10, 65, -2);
    ctx.strokeStyle = '#E8941A'; ctx.lineWidth = 1.5; ctx.stroke();
    if (pouchFill > 0) { ctx.fillStyle = `rgba(0,150,220,${0.4 + pouchFill * 0.4})`; ctx.fill(); }
    // Wings
    const wingFlap = Math.sin(elapsed * 6) * 20;
    ctx.beginPath(); ctx.moveTo(-5, -5);
    ctx.quadraticCurveTo(-25, -35 + wingFlap, -45, -15 + wingFlap * 0.6);
    ctx.quadraticCurveTo(-30, -5, -5, -5); ctx.fillStyle = '#D7CCC8'; ctx.fill();
    ctx.beginPath(); ctx.moveTo(-5, 5);
    ctx.quadraticCurveTo(-25, 35 - wingFlap, -45, 15 - wingFlap * 0.6);
    ctx.quadraticCurveTo(-30, 5, -5, 5); ctx.fill();
    // Tail
    ctx.beginPath(); ctx.moveTo(-30, 0); ctx.lineTo(-45, -5); ctx.lineTo(-42, 0); ctx.lineTo(-45, 5);
    ctx.closePath(); ctx.fillStyle = '#BCAAA4'; ctx.fill();
    ctx.restore();

    // Draw seagulls
    for (const g of s.seagulls) {
      if (!g.active) continue;
      ctx.save(); ctx.translate(g.x, g.y);
      const sw = Math.sin(g.wingPhase) * 12;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(-8, -10 + sw, -20, -5 + sw * 0.5);
      ctx.moveTo(0, 0); ctx.quadraticCurveTo(8, -10 + sw, 20, -5 + sw * 0.5);
      ctx.strokeStyle = '#555'; ctx.lineWidth = 2.5; ctx.stroke();
      ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fillStyle = '#666'; ctx.fill();
      ctx.restore();
    }

    // Draw particles
    for (const p of s.particles) {
      if (!p.active) continue;
      const alpha = p.life / p.maxLife;
      ctx.beginPath();
      if (p.type === 'line') {
        ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`; ctx.lineWidth = p.size * 0.8; ctx.stroke();
      } else {
        ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`; ctx.fill();
      }
    }

    // Scoop amount popup
    if (s.scoopFlash > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.scoopFlash * 3);
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      const isPerfect = s.lastScoopAmount >= 1.5;
      ctx.fillStyle = isPerfect ? COLORS.gold : COLORS.cyan;
      const label = isPerfect ? `+${s.lastScoopAmount.toFixed(1)}L PERFECT!` : `+${s.lastScoopAmount.toFixed(1)}L`;
      ctx.fillText(label, px, py - 40 - (1 - s.scoopFlash) * 30);
      ctx.restore();
    }

    // Spill popup
    if (s.spillFlash > 0.05) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, s.spillFlash * 3);
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.red;
      ctx.fillText(`-${s.spillAmount}L SPILL!`, px, py - 50 - (1 - s.spillFlash) * 20);
      ctx.restore();
    }

    // Water gauge (left side)
    const gx = 28;
    const gt = h * 0.15;
    const gh = h * 0.45;
    const gw = 22;
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(gx - gw / 2, gt, gw, gh, 6);
    ctx.fill();
    ctx.stroke();

    const fillH = gh * Math.min(1, s.litres / TARGET_LITRES);
    const fillGrad = ctx.createLinearGradient(0, gt + gh - fillH, 0, gt + gh);
    fillGrad.addColorStop(0, '#00BFFF');
    fillGrad.addColorStop(1, '#0077B6');
    ctx.fillStyle = fillGrad;
    ctx.beginPath();
    ctx.roundRect(gx - gw / 2 + 2, gt + gh - fillH + 2, gw - 4, fillH - 4, 4);
    ctx.fill();

    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`${s.litres.toFixed(1)}`, gx, gt - 8);
    ctx.font = '11px sans-serif';
    ctx.fillStyle = COLORS.cyan;
    ctx.fillText(`/ ${TARGET_LITRES}L`, gx, gt + 8);

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.cyan;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer text
    ctx.font = 'bold 24px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    // Altitude indicator
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.gray;
    const altLabel = s.altitude < 0.5 ? 'HIGH' : s.altitude < 0.7 ? 'MID' : 'LOW';
    ctx.fillText(altLabel, w - 20, 60);

    ctx.restore();
  }, [phase, sounds, spawnParticles]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.litres = 0;
      s.timeLeft = GAME_DURATION;
      s.altitude = 0.35;
      s.targetAlt = 0.35;
      s.scooping = false;
      s.scoopCooldown = 0;
      s.totalScoops = 0;
      s.perfectScoops = 0;
      for (const g of s.seagulls) {
        g.active = false;
        g.spawnTimer = 2 + Math.random() * 4;
      }
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'ended') gameLoop.stop();
  }, [phase, gameLoop]);

  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const finalLitres = phase === 'ended' ? state.current.litres.toFixed(1) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.85)',
        }}>
          <div style={{ color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>
            Results
          </div>
          <div style={{ color: COLORS.cyan, fontSize: 20, marginBottom: 8 }}>
            {finalLitres} / {TARGET_LITRES} litres
          </div>
          <div style={{ color: COLORS.gold, fontSize: 16, marginBottom: 8 }}>
            Scoops: {state.current.totalScoops} (Perfect: {state.current.perfectScoops})
          </div>
          <div style={{ color: COLORS.white, fontSize: 44, fontWeight: 'bold', marginBottom: 4 }}>
            {displayScore}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>points</div>
          <button onClick={() => onComplete(displayScore)} style={{
            background: COLORS.cyan, color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
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
