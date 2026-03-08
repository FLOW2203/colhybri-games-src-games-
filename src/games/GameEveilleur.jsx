import { useRef, useState, useEffect, useCallback } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';

const DURATION = 30;

const BIRDS = [
  { name: 'Colibri', color: '#2EEAA3', size: 10, joinTime: 0 },
  { name: 'Toucan', color: '#F5A623', size: 14, joinTime: 10 },
  { name: 'Aigle', color: '#8B6914', size: 18, joinTime: 13 },
  { name: 'Cygne', color: '#FFFFFF', size: 16, joinTime: 16 },
  { name: 'Flamant', color: '#E91E8C', size: 15, joinTime: 19 },
];
const PELICAN_COUNT = 6;

export default function GameEveilleur({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    phase: 'ready',
    timer: DURATION,
    elapsed: 0,
    score: 0,
    totalDrops: 0,
    activeBirds: 1,
    pelicanPhase: false,
    pelicanCascadeIndex: 0,
    cascadeTimer: 0,
    birdPositions: BIRDS.map(() => ({ x: 0, y: 0, angle: 0 })),
    pelicanPositions: Array(PELICAN_COUNT).fill(null).map(() => ({ x: 0, y: 0, flashing: false, flashTimer: 0 })),
    drops: Array(200).fill(null).map(() => ({ active: false, x: 0, y: 0, vy: 0, size: 0 })),
    fireParticles: Array(40).fill(null).map(() => ({ x: 0, y: 0, life: 0, size: 0 })),
    skyColor: { r: 80, g: 40, b: 10 },
    fireHeight: 1,
    joinAnimations: [],
  });
  const [phase, setPhase] = useState('ready');
  const sounds = useSounds();

  const spawnDrop = useCallback((x, y) => {
    const s = stateRef.current;
    for (let i = 0; i < s.drops.length; i++) {
      if (!s.drops[i].active) {
        s.drops[i].active = true;
        s.drops[i].x = x + (Math.random() - 0.5) * 15;
        s.drops[i].y = y;
        s.drops[i].vy = 3 + Math.random() * 2;
        s.drops[i].size = 2 + Math.random() * 3;
        return;
      }
    }
  }, []);

  useTouch(canvasRef, {
    onTap: () => {
      const s = stateRef.current;
      if (s.phase === 'ready') { s.phase = 'playing'; setPhase('playing'); return; }
      if (s.phase !== 'playing') return;

      sounds.tick();
      const canvas = canvasRef.current;
      const W = canvas?.width || 400;

      if (s.pelicanPhase) {
        for (let i = 0; i < PELICAN_COUNT; i++) {
          const p = s.pelicanPositions[i];
          p.flashing = true;
          p.flashTimer = 0.3;
          spawnDrop(p.x, p.y + 10);
          spawnDrop(p.x - 5, p.y + 10);
          spawnDrop(p.x + 5, p.y + 10);
        }
        s.totalDrops += PELICAN_COUNT * 3;
        s.score += PELICAN_COUNT * 3;
      } else {
        for (let i = 0; i < s.activeBirds; i++) {
          const bp = s.birdPositions[i];
          spawnDrop(bp.x, bp.y + 10);
        }
        s.totalDrops += s.activeBirds;
        s.score += s.activeBirds;
      }
    },
  });

  useGameLoop(useCallback(({ delta }) => {
    const s = stateRef.current;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    if (s.phase === 'playing') {
      s.timer -= delta;
      s.elapsed += delta;
      if (s.timer <= 0) { s.phase = 'ended'; setPhase('ended'); onComplete(s.score); return; }

      let newBirdCount = 1;
      for (let i = 1; i < BIRDS.length; i++) {
        if (s.elapsed >= BIRDS[i].joinTime) newBirdCount = i + 1;
      }
      if (newBirdCount > s.activeBirds) {
        s.joinAnimations.push({ birdIndex: newBirdCount - 1, timer: 1 });
        sounds.chime();
      }
      s.activeBirds = newBirdCount;

      s.pelicanPhase = s.elapsed >= 22;

      s.fireHeight = Math.max(0.05, 1 - s.totalDrops * 0.003);

      const targetR = Math.round(30 + (1 - s.fireHeight) * 100);
      const targetG = Math.round(40 + (1 - s.fireHeight) * 120);
      const targetB = Math.round(10 + (1 - s.fireHeight) * 200);
      s.skyColor.r += (targetR - s.skyColor.r) * 0.02;
      s.skyColor.g += (targetG - s.skyColor.g) * 0.02;
      s.skyColor.b += (targetB - s.skyColor.b) * 0.02;
    }

    const { r, g, b } = s.skyColor;
    const skyGrad = ctx.createLinearGradient(0, 0, 0, H);
    skyGrad.addColorStop(0, `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`);
    skyGrad.addColorStop(1, `rgb(${Math.round(r * 0.5)},${Math.round(g * 0.3)},${Math.round(b * 0.2)})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, W, H);

    const fireBaseY = H * 0.75;
    const fireH = H * 0.25 * s.fireHeight;
    if (s.fireHeight > 0.1) {
      for (let i = 0; i < 20; i++) {
        const fx = (i / 20) * W;
        const fh = fireH * (0.5 + Math.sin(Date.now() * 0.005 + i * 0.5) * 0.5);
        ctx.fillStyle = `rgba(255,${60 + Math.random() * 80},0,${0.4 * s.fireHeight})`;
        ctx.beginPath();
        ctx.moveTo(fx - 12, H);
        ctx.lineTo(fx, H - fh);
        ctx.lineTo(fx + 12, H);
        ctx.fill();
      }
      ctx.fillStyle = `rgba(255,69,0,${0.2 * s.fireHeight})`;
      ctx.fillRect(0, fireBaseY, W, H - fireBaseY);
    }

    const cx = W / 2;
    for (let i = 0; i < s.activeBirds; i++) {
      const bird = BIRDS[i];
      const angle = Date.now() * 0.001 + (i / s.activeBirds) * Math.PI * 2;
      const orbitR = 30 + i * 25;
      const bx = cx + Math.cos(angle) * orbitR;
      const by = H * 0.35 + Math.sin(angle) * orbitR * 0.3 - i * 10;
      s.birdPositions[i].x = bx;
      s.birdPositions[i].y = by;

      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = bird.color;
      ctx.beginPath();
      ctx.ellipse(0, 0, bird.size, bird.size * 0.6, 0, 0, Math.PI * 2);
      ctx.fill();
      const wingA = Math.sin(Date.now() * 0.02 + i) * 8;
      ctx.fillStyle = bird.color;
      ctx.globalAlpha = 0.7;
      ctx.beginPath();
      ctx.moveTo(-4, -2);
      ctx.lineTo(-bird.size - 5, -8 + wingA);
      ctx.lineTo(-2, 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    if (s.pelicanPhase) {
      for (let i = 0; i < PELICAN_COUNT; i++) {
        const angle = Math.PI * 0.15 + (Math.PI * 0.7 / (PELICAN_COUNT - 1)) * i;
        const px = cx + Math.cos(angle) * (W * 0.35);
        const py = H * 0.18 - Math.sin(angle) * 40;
        s.pelicanPositions[i].x = px;
        s.pelicanPositions[i].y = py;

        const p = s.pelicanPositions[i];
        if (p.flashing && p.flashTimer > 0) {
          p.flashTimer -= delta;
          ctx.fillStyle = 'rgba(255,255,255,0.8)';
          ctx.beginPath();
          ctx.arc(px, py, 20, 0, Math.PI * 2);
          ctx.fill();
        }

        ctx.save();
        ctx.translate(px, py);
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.ellipse(0, 0, 12, 8, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#F5A623';
        ctx.beginPath();
        ctx.moveTo(12, 2);
        ctx.lineTo(20, 4);
        ctx.lineTo(12, 7);
        ctx.closePath();
        ctx.fill();
        const wA = Math.sin(Date.now() * 0.01 + i * 0.5) * 6;
        ctx.fillStyle = '#E8E8E8';
        ctx.beginPath();
        ctx.moveTo(-4, -3);
        ctx.lineTo(-14, -10 + wA);
        ctx.lineTo(-2, 0);
        ctx.fill();
        ctx.restore();
      }
    }

    for (let i = 0; i < s.drops.length; i++) {
      const d = s.drops[i];
      if (!d.active) continue;
      d.y += d.vy;
      d.vy += 0.1;
      if (d.y > H) { d.active = false; continue; }
      ctx.fillStyle = '#00BFFF';
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fill();
    }

    for (let i = s.joinAnimations.length - 1; i >= 0; i--) {
      const ja = s.joinAnimations[i];
      ja.timer -= delta;
      if (ja.timer <= 0) { s.joinAnimations.splice(i, 1); continue; }
      const bird = BIRDS[ja.birdIndex];
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.globalAlpha = ja.timer;
      ctx.fillText(`+ ${bird.name}!`, W / 2, H * 0.55 - (1 - ja.timer) * 30);
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = 'white';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${s.score}`, W / 2, 35);

    ctx.font = '12px sans-serif';
    ctx.fillStyle = s.timer < 8 ? '#EF4444' : '#9CA3AF';
    ctx.fillText(`${Math.ceil(s.timer)}s`, W / 2, 55);

    const phaseNum = s.elapsed < 10 ? 1 : (s.elapsed < 22 ? 2 : 3);
    const phaseLabel = phaseNum === 1 ? 'SOLO' : phaseNum === 2 ? `FORMATION ×${s.activeBirds}` : `PÉLICANS ×${PELICAN_COUNT * 3}`;
    ctx.fillStyle = phaseNum === 3 ? '#F5A623' : '#2EEAA3';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(phaseLabel, W / 2, 70);

    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px sans-serif';
    ctx.fillText(`💧 ${s.totalDrops}`, W / 2, H * 0.72);

    if (s.phase === 'ready') {
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('🐦 L\'Éveilleur', W / 2, H / 2 - 40);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = '#9CA3AF';
      ctx.fillText('Phase 1: Solo tap', W / 2, H / 2);
      ctx.fillText('Phase 2: Birds join (×N)', W / 2, H / 2 + 20);
      ctx.fillText('Phase 3: Pelican frenzy!', W / 2, H / 2 + 40);
      ctx.fillStyle = '#2EEAA3';
      ctx.fillText('Tap to start', W / 2, H / 2 + 70);
    }
  }, [onComplete, spawnDrop]));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, []);

  return (
    <div className="relative w-full h-full">
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      <button onClick={onBack} className="absolute top-4 left-4 text-white/60 text-2xl z-10">←</button>
    </div>
  );
}
