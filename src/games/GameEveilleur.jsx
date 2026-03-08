import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 30;
const POOL_SIZE = 200;
const PELICAN_COUNT = 7;

const BIRDS = [
  { name: 'Colibri', color: '#2EEAA3', darkColor: '#1CA04A', size: 10, joinTime: 0 },
  { name: 'Toucan', color: '#F5A623', darkColor: '#C17D10', size: 14, joinTime: 10 },
  { name: 'Aigle', color: '#8B6914', darkColor: '#5C3D1E', size: 18, joinTime: 13 },
  { name: 'Cygne', color: '#FFFFFF', darkColor: '#CCCCCC', size: 16, joinTime: 16 },
  { name: 'Flamant', color: '#E91E8C', darkColor: '#B8156E', size: 15, joinTime: 19 },
];

export default function GameEveilleur({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const [displayTime, setDisplayTime] = useState(GAME_DURATION);

  const sounds = useSounds();

  const state = useRef({
    score: 0,
    timeLeft: GAME_DURATION,
    totalDrops: 0,
    activeBirds: 1,
    gamePhase: 1,
    pelicanActive: false,
    birdPositions: BIRDS.map(() => ({ x: 0, y: 0, angle: 0, entered: false, entranceTimer: 0 })),
    pelicanPositions: Array(PELICAN_COUNT).fill(null).map(() => ({
      x: 0, y: 0, cascading: false, cascadeTimer: 0, flashTimer: 0,
    })),
    drops: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vy: 0, size: 0, r: 0, g: 191, b: 255,
    })),
    particles: Array(80).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    fireEmbers: Array(30).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, size: 0,
    })),
    skyColorR: 80,
    skyColorG: 40,
    skyColorB: 10,
    fireHeight: 1.0,
    joinAnimations: [],
    cascadeQueue: [],
    cascadeDelay: 0,
    lastNewBirdCount: 1,
    tapPulse: 0,
    epicShake: 0,
  });

  const spawnDrop = useCallback((x, y, r, g, b) => {
    const s = state.current;
    for (let i = 0; i < s.drops.length; i++) {
      const d = s.drops[i];
      if (!d.active) {
        d.active = true;
        d.x = x + (Math.random() - 0.5) * 15;
        d.y = y;
        d.vy = 120 + Math.random() * 80;
        d.size = 2 + Math.random() * 3;
        d.r = r || 0;
        d.g = g || 191;
        d.b = b || 255;
        return;
      }
    }
  }, []);

  const spawnParticles = useCallback((cx, cy, count, r, g, b) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx; p.y = cy;
        const angle = Math.random() * Math.PI * 2;
        const speed = 60 + Math.random() * 120;
        p.vx = Math.cos(angle) * speed;
        p.vy = Math.sin(angle) * speed;
        p.life = 0.3 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = r; p.g = g; p.b = b;
        p.size = 2 + Math.random() * 5;
        spawned++;
      }
    }
  }, []);

  const handleTap = useCallback(() => {
    if (phase === 'ready') { setPhase('playing'); return; }
    if (phase !== 'playing') return;
    const s = state.current;

    s.tapPulse = 1;

    if (s.gamePhase === 3 && s.pelicanActive) {
      // Pelican cascade - domino effect
      s.cascadeQueue = [];
      for (let i = 0; i < PELICAN_COUNT; i++) {
        s.cascadeQueue.push({ index: i, delay: i * 0.06 });
      }
      s.cascadeDelay = 0;

      // Immediate massive drop from all birds too
      for (let i = 0; i < s.activeBirds; i++) {
        const bp = s.birdPositions[i];
        spawnDrop(bp.x, bp.y + 10);
      }
      s.totalDrops += s.activeBirds;
      s.score += s.activeBirds;

      sounds.splash();
      s.epicShake = 0.3;
    } else if (s.gamePhase <= 2) {
      // Drop from all active birds
      for (let i = 0; i < s.activeBirds; i++) {
        const bp = s.birdPositions[i];
        const bird = BIRDS[i];
        spawnDrop(bp.x, bp.y + 10);
        spawnParticles(bp.x, bp.y + 10, 2, 0, 191, 255);
      }
      s.totalDrops += s.activeBirds;
      s.score += s.activeBirds;
      sounds.tick();
    }

    setDisplayScore(s.score);
  }, [phase, sounds, spawnDrop, spawnParticles]);

  useTouch(canvasRef, { onTap: handleTap });

  function drawBird(ctx, x, y, bird, time, scale) {
    const sc = scale || 1;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(sc, sc);

    const wingFlap = Math.sin(time * 10 + x * 0.1) * 10;

    // Body
    ctx.fillStyle = bird.color;
    ctx.beginPath();
    ctx.ellipse(0, 0, bird.size, bird.size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();

    // Wing
    ctx.fillStyle = bird.darkColor;
    ctx.beginPath();
    ctx.moveTo(-4, -2);
    ctx.lineTo(-bird.size - 6, -10 + wingFlap);
    ctx.lineTo(-2, 2);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(4, -2);
    ctx.lineTo(bird.size + 6, -10 - wingFlap);
    ctx.lineTo(2, 2);
    ctx.closePath();
    ctx.fill();

    // Head
    ctx.fillStyle = bird.color;
    ctx.beginPath();
    ctx.arc(bird.size * 0.6, -bird.size * 0.3, bird.size * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(bird.size * 0.75, -bird.size * 0.4, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Beak
    ctx.fillStyle = '#F5A623';
    ctx.beginPath();
    ctx.moveTo(bird.size * 0.9, -bird.size * 0.3);
    ctx.lineTo(bird.size * 1.3, -bird.size * 0.15);
    ctx.lineTo(bird.size * 0.9, -bird.size * 0.1);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawPelican(ctx, x, y, time, flashing) {
    ctx.save();
    ctx.translate(x, y);

    if (flashing) {
      ctx.beginPath();
      ctx.arc(0, 0, 22, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fill();
    }

    const wingA = Math.sin(time * 8 + x * 0.05) * 8;

    // Body
    ctx.fillStyle = '#F5F5DC';
    ctx.beginPath();
    ctx.ellipse(0, 0, 14, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(10, -7, 6, 0, Math.PI * 2);
    ctx.fill();

    // Beak pouch
    ctx.fillStyle = '#F5A623';
    ctx.beginPath();
    ctx.moveTo(15, -7);
    ctx.lineTo(26, -4);
    ctx.quadraticCurveTo(22, 2, 15, -2);
    ctx.closePath();
    ctx.fill();

    // Eye
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.arc(12, -9, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Wings
    ctx.fillStyle = '#D4C9A8';
    ctx.beginPath();
    ctx.moveTo(-4, -4);
    ctx.lineTo(-18, -12 + wingA);
    ctx.lineTo(-3, 0);
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
    const cx = w / 2;

    if (phase === 'ready') {
      ctx.fillStyle = '#1A0A00';
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText("L'Eveilleur", w / 2, h / 2 - 80);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('The individual triggers', w / 2, h / 2 - 30);
      ctx.fillText('the collective!', w / 2, h / 2 - 8);
      ctx.font = '13px sans-serif';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Phase 1: Solo hummingbird drops', w / 2, h / 2 + 30);
      ctx.fillText('Phase 2: Birds join, multiplier grows', w / 2, h / 2 + 50);
      ctx.fillText('Phase 3: Pelican frenzy cascade!', w / 2, h / 2 + 70);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText('TAP TO START', w / 2, h / 2 + 120);
      ctx.restore();
      return;
    }

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    // Determine game phase
    if (elapsed < 10) s.gamePhase = 1;
    else if (elapsed < 22) s.gamePhase = 2;
    else s.gamePhase = 3;

    // Count active birds
    let newBirdCount = 1;
    for (let i = 1; i < BIRDS.length; i++) {
      if (elapsed >= BIRDS[i].joinTime) newBirdCount = i + 1;
    }
    if (newBirdCount > s.lastNewBirdCount) {
      const idx = newBirdCount - 1;
      s.joinAnimations.push({ birdIndex: idx, timer: 1.5 });
      s.birdPositions[idx].entranceTimer = 1.0;
      s.birdPositions[idx].entered = true;
      sounds.chime();
      spawnParticles(cx, h * 0.3, 15, 255, 255, 255);
    }
    s.lastNewBirdCount = newBirdCount;
    s.activeBirds = newBirdCount;

    // Pelican phase
    s.pelicanActive = elapsed >= 22;

    // Fire shrinks based on drops
    s.fireHeight = Math.max(0.02, 1 - s.totalDrops * 0.0015);

    // Sky color transition
    const targetR = Math.round(30 + (1 - s.fireHeight) * 100);
    const targetG = Math.round(40 + (1 - s.fireHeight) * 150);
    const targetB = Math.round(10 + (1 - s.fireHeight) * 230);
    s.skyColorR += (targetR - s.skyColorR) * delta * 2;
    s.skyColorG += (targetG - s.skyColorG) * delta * 2;
    s.skyColorB += (targetB - s.skyColorB) * delta * 2;

    // Tap pulse decay
    s.tapPulse *= Math.pow(0.02, delta);
    s.epicShake *= Math.pow(0.05, delta);

    // Cascade queue processing
    if (s.cascadeQueue.length > 0) {
      s.cascadeDelay += delta;
      const toProcess = [];
      for (let i = s.cascadeQueue.length - 1; i >= 0; i--) {
        const c = s.cascadeQueue[i];
        if (s.cascadeDelay >= c.delay) {
          toProcess.push(c);
          s.cascadeQueue.splice(i, 1);
        }
      }
      for (const c of toProcess) {
        const p = s.pelicanPositions[c.index];
        p.cascading = true;
        p.cascadeTimer = 0.4;
        p.flashTimer = 0.3;
        // Drop 3 drops per pelican
        spawnDrop(p.x, p.y + 10, 0, 191, 255);
        spawnDrop(p.x - 8, p.y + 12, 50, 200, 255);
        spawnDrop(p.x + 8, p.y + 12, 50, 200, 255);
        s.totalDrops += 3;
        s.score += 3;
        setDisplayScore(s.score);
        spawnParticles(p.x, p.y, 6, 200, 230, 255);
      }
    }

    // Update bird positions
    for (let i = 0; i < s.activeBirds; i++) {
      const bp = s.birdPositions[i];
      bp.angle = elapsed * (1.2 - i * 0.1) + (i / Math.max(1, s.activeBirds)) * Math.PI * 2;
      const orbitR = 30 + i * 22;
      bp.x = cx + Math.cos(bp.angle) * orbitR;
      bp.y = h * 0.38 + Math.sin(bp.angle) * orbitR * 0.3 - i * 8;
      if (bp.entranceTimer > 0) bp.entranceTimer -= delta;
    }

    // Update pelican positions
    if (s.pelicanActive) {
      for (let i = 0; i < PELICAN_COUNT; i++) {
        const t = Math.PI * 0.12 + (Math.PI * 0.76 / (PELICAN_COUNT - 1)) * i;
        const arcR = Math.min(w * 0.4, 180);
        s.pelicanPositions[i].x = cx + Math.cos(t + Math.PI) * arcR;
        s.pelicanPositions[i].y = h * 0.15 - Math.sin(t) * 30;
        if (s.pelicanPositions[i].cascadeTimer > 0) s.pelicanPositions[i].cascadeTimer -= delta;
        if (s.pelicanPositions[i].flashTimer > 0) s.pelicanPositions[i].flashTimer -= delta;
      }
    }

    // Update drops
    for (const d of s.drops) {
      if (!d.active) continue;
      d.y += d.vy * delta;
      d.vy += 200 * delta;
      if (d.y > h) { d.active = false; }
    }

    // Fire embers
    for (const e of s.fireEmbers) {
      if (!e.active) {
        if (Math.random() < delta * 3 * s.fireHeight) {
          e.active = true;
          e.x = Math.random() * w;
          e.y = h;
          e.vx = (Math.random() - 0.5) * 40;
          e.vy = -(40 + Math.random() * 80);
          e.size = 1 + Math.random() * 3;
          e.life = 1 + Math.random() * 2;
        }
      } else {
        e.x += e.vx * delta;
        e.y += e.vy * delta;
        e.life -= delta;
        if (e.life <= 0) e.active = false;
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

    // Join animations
    for (let i = s.joinAnimations.length - 1; i >= 0; i--) {
      s.joinAnimations[i].timer -= delta;
      if (s.joinAnimations[i].timer <= 0) s.joinAnimations.splice(i, 1);
    }

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      return;
    }

    // --- RENDER ---
    // Apply epic shake
    ctx.save();
    if (s.epicShake > 0.01) {
      ctx.translate(Math.sin(elapsed * 40) * s.epicShake * 8, Math.cos(elapsed * 35) * s.epicShake * 5);
    }

    // Sky gradient
    const sr = Math.round(s.skyColorR);
    const sg = Math.round(s.skyColorG);
    const sb = Math.round(s.skyColorB);
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, `rgb(${sr},${sg},${sb})`);
    skyGrad.addColorStop(0.7, `rgb(${Math.round(sr * 0.5)},${Math.round(sg * 0.4)},${Math.round(sb * 0.3)})`);
    skyGrad.addColorStop(1, `rgb(${Math.round(sr * 0.3)},${Math.round(sg * 0.2)},${Math.round(sb * 0.1)})`);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Tap pulse flash
    if (s.tapPulse > 0.05) {
      ctx.fillStyle = `rgba(100,200,255,${s.tapPulse * 0.15})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Fire zone at bottom
    const fireBaseY = h * (1 - 0.25 * s.fireHeight);
    if (s.fireHeight > 0.05) {
      const fh = h * 0.25 * s.fireHeight;
      // Flame columns
      for (let i = 0; i < 20; i++) {
        const fx = (i / 20) * w + Math.sin(elapsed * 4 + i * 1.3) * 8;
        const flameH = fh * (0.5 + Math.sin(elapsed * 6 + i * 0.7) * 0.5);
        ctx.beginPath();
        ctx.moveTo(fx - 12, h);
        ctx.quadraticCurveTo(fx - 4, h - flameH * 0.6, fx, h - flameH);
        ctx.quadraticCurveTo(fx + 4, h - flameH * 0.6, fx + 12, h);
        ctx.closePath();
        const flameR = 255;
        const flameG = Math.floor(60 + Math.random() * 80);
        ctx.fillStyle = `rgba(${flameR},${flameG},0,${0.5 * s.fireHeight})`;
        ctx.fill();
      }
      // Base fire glow
      ctx.fillStyle = `rgba(255,69,0,${0.3 * s.fireHeight})`;
      ctx.fillRect(0, fireBaseY, w, h - fireBaseY);
    }

    // Fire embers
    for (const e of s.fireEmbers) {
      if (!e.active) continue;
      const alpha = Math.min(1, e.life * 0.8);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${Math.floor(100 + Math.random() * 80)},0,${alpha * 0.6})`;
      ctx.fill();
    }

    // Draw pelicans (phase 3)
    if (s.pelicanActive) {
      // Semi-circle arc guide
      ctx.strokeStyle = 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      const arcR = Math.min(w * 0.4, 180);
      ctx.arc(cx, h * 0.15, arcR, Math.PI * 0.12 + Math.PI, Math.PI * 0.88 + Math.PI);
      ctx.stroke();

      for (let i = 0; i < PELICAN_COUNT; i++) {
        const pp = s.pelicanPositions[i];
        drawPelican(ctx, pp.x, pp.y, elapsed, pp.flashTimer > 0);
        if (pp.cascadeTimer > 0) {
          // Cascade ring effect
          const ringSize = (0.4 - pp.cascadeTimer) * 60;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, ringSize, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,191,255,${pp.cascadeTimer})`;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Draw birds
    for (let i = 0; i < s.activeBirds; i++) {
      const bp = s.birdPositions[i];
      const bird = BIRDS[i];
      const entranceScale = bp.entranceTimer > 0 ? 1 + bp.entranceTimer * 2 : 1;
      drawBird(ctx, bp.x, bp.y, bird, elapsed, entranceScale);
    }

    // Water drops
    for (const d of s.drops) {
      if (!d.active) continue;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${d.r},${d.g},${d.b},0.8)`;
      ctx.fill();
      // Drop trail
      ctx.beginPath();
      ctx.arc(d.x, d.y - d.size * 2, d.size * 0.5, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${d.r},${d.g},${d.b},0.3)`;
      ctx.fill();
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

    // Join animations
    for (const ja of s.joinAnimations) {
      const bird = BIRDS[ja.birdIndex];
      ctx.globalAlpha = Math.min(1, ja.timer);
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = bird.color;
      const yOff = (1.5 - ja.timer) * 30;
      ctx.fillText(`+ ${bird.name}!`, cx, h * 0.55 - yOff);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // shake

    // Phase indicator
    const phaseNum = s.gamePhase;
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    let phaseLabel, phaseCol;
    if (phaseNum === 1) {
      phaseLabel = 'SOLO';
      phaseCol = COLORS.mint;
    } else if (phaseNum === 2) {
      phaseLabel = `FORMATION x${s.activeBirds}`;
      phaseCol = COLORS.cyan;
    } else {
      phaseLabel = `PELICAN CASCADE x${PELICAN_COUNT * 3 + s.activeBirds}`;
      phaseCol = COLORS.gold;
    }
    ctx.fillStyle = phaseCol;
    ctx.fillText(phaseLabel, cx, 72);

    // Total drops
    ctx.font = '13px sans-serif';
    ctx.fillStyle = COLORS.water;
    ctx.fillText(`Drops: ${s.totalDrops}`, cx, 90);

    // Score
    ctx.font = 'bold 28px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`${s.score}`, cx, 42);

    // Timer
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 8 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);

    // Phase progress bar
    const barW = w * 0.7;
    const barX = (w - barW) / 2;
    const barY = h * 0.95;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(barX, barY, barW, 6);
    // Phase markers
    const p1End = barX + barW * (10 / GAME_DURATION);
    const p2End = barX + barW * (22 / GAME_DURATION);
    ctx.fillStyle = COLORS.mint;
    ctx.fillRect(barX, barY, Math.min(p1End - barX, barW * (elapsed / GAME_DURATION)), 6);
    if (elapsed > 10) {
      ctx.fillStyle = COLORS.cyan;
      ctx.fillRect(p1End, barY, Math.min(p2End - p1End, barW * ((elapsed - 10) / GAME_DURATION)), 6);
    }
    if (elapsed > 22) {
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(p2End, barY, barW * ((elapsed - 22) / GAME_DURATION), 6);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX, barY, barW, 6);
    // Phase dividers
    ctx.fillStyle = '#fff';
    ctx.fillRect(p1End, barY - 2, 1, 10);
    ctx.fillRect(p2End, barY - 2, 1, 10);

    // Hint text in phase 1
    if (s.gamePhase === 1 && elapsed < 3) {
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('TAP to send water drops!', cx, h * 0.65);
    }

    ctx.restore();
  }, [phase, sounds, spawnDrop, spawnParticles]));

  useEffect(() => { if (phase === 'ready') gameLoop.start(); }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0; s.totalDrops = 0; s.activeBirds = 1; s.gamePhase = 1;
      s.pelicanActive = false; s.fireHeight = 1.0; s.joinAnimations = [];
      s.cascadeQueue = []; s.lastNewBirdCount = 1; s.tapPulse = 0; s.epicShake = 0;
      s.skyColorR = 80; s.skyColorG = 40; s.skyColorB = 10;
      for (const d of s.drops) d.active = false;
      for (const p of s.particles) p.active = false;
      for (const e of s.fireEmbers) e.active = false;
      for (const bp of s.birdPositions) { bp.entered = false; bp.entranceTimer = 0; }
      s.birdPositions[0].entered = true;
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
          <div style={{ color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 8 }}>The Collective Awakens!</div>
          <div style={{ color: COLORS.cyan, fontSize: 48, fontWeight: 'bold', marginBottom: 8 }}>{state.current.score}</div>
          <div style={{ color: COLORS.gray, fontSize: 15, marginBottom: 4 }}>
            Total drops: {state.current.totalDrops}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 15, marginBottom: 4 }}>
            Fire reduced to {Math.floor(state.current.fireHeight * 100)}%
          </div>
          <div style={{ color: COLORS.gray, fontSize: 13, marginBottom: 24 }}>
            One spark ignites the collective!
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
