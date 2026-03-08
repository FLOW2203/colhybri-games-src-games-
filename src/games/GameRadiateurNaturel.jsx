import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import { COLORS } from './engine/constants';

const GAME_DURATION = 45;
const POOL_SIZE = 100;
const TEMP_MIN = 32;
const TEMP_MAX = 44;
const SAFE_LOW = 36;
const SAFE_HIGH = 40;
const TAP_COOL = 2;
const HOLD_HEAT_RATE = 1;
const EVENT_MIN_DURATION = 6;
const EVENT_MAX_DURATION = 8;

const WEATHER_TYPES = ['sun', 'rain', 'wind'];

export default function GameRadiateurNaturel({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();

  const state = useRef({
    timeLeft: GAME_DURATION,
    temperature: 38,
    score: 0,
    safeTime: 0,
    stabilitySum: 0,
    stabilitySamples: 0,
    lastTemp: 38,
    weather: 'sun',
    weatherTimer: 0,
    weatherDuration: 7,
    isHolding: false,
    holdingSunny: false,
    beakGlow: 0,
    beakCoolFlash: 0,
    tappedRecently: false,
    tapCoolTimer: 0,
    toucanBobTime: 0,
    cloudOffset: 0,
    raindrops: Array(30).fill(null).map(() => ({
      x: 0, y: 0, speed: 0, active: false, length: 0,
    })),
    windLines: Array(20).fill(null).map(() => ({
      x: 0, y: 0, speed: 0, active: false, length: 0,
    })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
    gaugeShake: 0,
    sunAngle: 0,
    sunPulse: 0,
  });

  const nextWeather = useCallback(() => {
    const s = state.current;
    const available = WEATHER_TYPES.filter(w => w !== s.weather);
    s.weather = available[Math.floor(Math.random() * available.length)];
    s.weatherDuration = EVENT_MIN_DURATION + Math.random() * (EVENT_MAX_DURATION - EVENT_MIN_DURATION);
    s.weatherTimer = 0;
  }, []);

  const spawnHeatParticles = useCallback((cx, cy, count) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 20;
        p.y = cy + (Math.random() - 0.5) * 10;
        p.vx = (Math.random() - 0.5) * 40;
        p.vy = -30 - Math.random() * 60;
        p.life = 0.5 + Math.random() * 0.5;
        p.maxLife = p.life;
        p.r = 255; p.g = 100 + Math.floor(Math.random() * 80); p.b = 50;
        p.size = 2 + Math.random() * 3;
        p.type = Math.random() > 0.5 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const spawnCoolParticles = useCallback((cx, cy, count) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 30;
        p.y = cy + (Math.random() - 0.5) * 15;
        p.vx = (Math.random() - 0.5) * 60;
        p.vy = -20 - Math.random() * 40;
        p.life = 0.4 + Math.random() * 0.4;
        p.maxLife = p.life;
        p.r = 100; p.g = 180; p.b = 255;
        p.size = 1.5 + Math.random() * 2.5;
        p.type = 'dot';
        spawned++;
      }
    }
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') setPhase('playing');
      return;
    }
    const s = state.current;
    s.temperature = Math.max(TEMP_MIN, s.temperature - TAP_COOL);
    s.beakCoolFlash = 0.5;
    s.tapCoolTimer = 0.3;
    s.tappedRecently = true;
    sounds.tick();

    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas ? canvas.width / dpr : 400;
    const h = canvas ? canvas.height / dpr : 700;
    spawnHeatParticles(w * 0.55, h * 0.4, 6);
  }, [phase, sounds, spawnHeatParticles]);

  const handleHoldStart = useCallback(() => {
    if (phase !== 'playing') return;
    state.current.isHolding = true;
  }, [phase]);

  const handleHoldEnd = useCallback(() => {
    state.current.isHolding = false;
  }, []);

  useTouch(canvasRef, { onTap: handleTap, onHoldStart: handleHoldStart, onHoldEnd: handleHoldEnd });

  const drawToucan = useCallback((ctx, x, y, temp, bobAngle, beakGlow, beakCoolFlash) => {
    ctx.save();
    ctx.translate(x, y);

    const tempNorm = (temp - SAFE_LOW) / (SAFE_HIGH - SAFE_LOW);
    const beakHue = temp > SAFE_HIGH ? 0 : (temp < SAFE_LOW ? 220 : 60 - tempNorm * 60);

    // Body (black)
    ctx.beginPath();
    ctx.ellipse(0, 0, 32, 24, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // White chest
    ctx.beginPath();
    ctx.ellipse(12, 4, 16, 14, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f0e8';
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(30, -12, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // Eye ring
    ctx.beginPath();
    ctx.arc(36, -16, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#2ecc71';
    ctx.fill();
    // Eye
    ctx.beginPath();
    ctx.arc(37, -16, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#111';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(38, -17, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Large beak with glow
    ctx.save();
    const beakBob = Math.sin(bobAngle) * 2;

    // Beak glow
    if (beakGlow > 0.05 || beakCoolFlash > 0.05) {
      ctx.shadowBlur = 15 + beakGlow * 15;
      if (temp > SAFE_HIGH) {
        ctx.shadowColor = `rgba(255,60,30,${beakGlow * 0.8})`;
      } else if (temp < SAFE_LOW) {
        ctx.shadowColor = `rgba(50,120,255,${beakGlow * 0.8})`;
      } else {
        ctx.shadowColor = `rgba(255,180,50,${beakGlow * 0.4})`;
      }
    }
    if (beakCoolFlash > 0.05) {
      ctx.shadowBlur = 20;
      ctx.shadowColor = `rgba(255,100,50,${beakCoolFlash})`;
    }

    // Upper beak
    ctx.beginPath();
    ctx.moveTo(44, -14 + beakBob);
    ctx.quadraticCurveTo(70, -20 + beakBob, 88, -10 + beakBob);
    ctx.quadraticCurveTo(72, -6 + beakBob, 44, -8 + beakBob);
    ctx.closePath();
    const upperGrad = ctx.createLinearGradient(44, -20, 88, -5);
    upperGrad.addColorStop(0, '#ff6b35');
    upperGrad.addColorStop(0.4, '#ffd700');
    upperGrad.addColorStop(0.7, '#ff4500');
    upperGrad.addColorStop(1, '#cc0000');
    ctx.fillStyle = upperGrad;
    ctx.fill();

    // Lower beak
    ctx.beginPath();
    ctx.moveTo(44, -6 + beakBob);
    ctx.quadraticCurveTo(68, 0 + beakBob, 85, -6 + beakBob);
    ctx.quadraticCurveTo(68, 4 + beakBob, 44, -2 + beakBob);
    ctx.closePath();
    ctx.fillStyle = '#222';
    ctx.fill();

    // Beak temperature tint overlay
    if (temp > SAFE_HIGH) {
      const overheat = Math.min(1, (temp - SAFE_HIGH) / 4);
      ctx.globalAlpha = overheat * 0.4;
      ctx.beginPath();
      ctx.moveTo(44, -14 + beakBob);
      ctx.quadraticCurveTo(70, -20 + beakBob, 88, -10 + beakBob);
      ctx.quadraticCurveTo(72, -6 + beakBob, 44, -8 + beakBob);
      ctx.closePath();
      ctx.fillStyle = '#ff0000';
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (temp < SAFE_LOW) {
      const overcold = Math.min(1, (SAFE_LOW - temp) / 4);
      ctx.globalAlpha = overcold * 0.4;
      ctx.beginPath();
      ctx.moveTo(44, -14 + beakBob);
      ctx.quadraticCurveTo(70, -20 + beakBob, 88, -10 + beakBob);
      ctx.quadraticCurveTo(72, -6 + beakBob, 44, -8 + beakBob);
      ctx.closePath();
      ctx.fillStyle = '#3388ff';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.shadowBlur = 0;
    ctx.restore();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-30, -4);
    ctx.lineTo(-52, -14);
    ctx.lineTo(-48, 0);
    ctx.lineTo(-52, 12);
    ctx.closePath();
    ctx.fillStyle = '#cc2200';
    ctx.fill();

    // Wing
    ctx.beginPath();
    ctx.ellipse(-10, 2, 20, 14, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // Feet
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(-4, 22);
    ctx.lineTo(-6, 34);
    ctx.moveTo(-6, 34);
    ctx.lineTo(-12, 37);
    ctx.moveTo(-6, 34);
    ctx.lineTo(-1, 37);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(10, 22);
    ctx.lineTo(8, 34);
    ctx.moveTo(8, 34);
    ctx.lineTo(2, 37);
    ctx.moveTo(8, 34);
    ctx.lineTo(13, 37);
    ctx.stroke();

    ctx.restore();
  }, []);

  const drawGauge = useCallback((ctx, x, y, gaugeW, gaugeH, temp) => {
    ctx.save();
    ctx.translate(x, y);

    // Background
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.roundRect(-2, -2, gaugeW + 4, gaugeH + 4, 6);
    ctx.fill();

    // Temperature zones
    const totalRange = TEMP_MAX - TEMP_MIN;
    const coldEnd = (SAFE_LOW - TEMP_MIN) / totalRange;
    const safeEnd = (SAFE_HIGH - TEMP_MIN) / totalRange;

    // Cold zone (blue)
    ctx.fillStyle = '#3388ff';
    ctx.fillRect(0, 0, gaugeW * coldEnd, gaugeH);

    // Safe zone (green)
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(gaugeW * coldEnd, 0, gaugeW * (safeEnd - coldEnd), gaugeH);

    // Hot zone (red)
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(gaugeW * safeEnd, 0, gaugeW * (1 - safeEnd), gaugeH);

    // Temperature marker
    const tempFrac = Math.max(0, Math.min(1, (temp - TEMP_MIN) / totalRange));
    const markerX = gaugeW * tempFrac;

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.moveTo(markerX, -6);
    ctx.lineTo(markerX - 5, -12);
    ctx.lineTo(markerX + 5, -12);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = COLORS.white;
    ctx.beginPath();
    ctx.roundRect(markerX - 2, -1, 4, gaugeH + 2, 1);
    ctx.fill();

    // Labels
    ctx.font = '11px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#88bbff';
    ctx.fillText(`${TEMP_MIN}\u00B0`, 0, gaugeH + 14);
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`${SAFE_LOW}\u00B0`, gaugeW * coldEnd, gaugeH + 14);
    ctx.fillStyle = '#22c55e';
    ctx.fillText(`${SAFE_HIGH}\u00B0`, gaugeW * safeEnd, gaugeH + 14);
    ctx.fillStyle = '#ff6666';
    ctx.fillText(`${TEMP_MAX}\u00B0`, gaugeW, gaugeH + 14);

    // Current temp text
    ctx.font = 'bold 18px sans-serif';
    const inSafe = temp >= SAFE_LOW && temp <= SAFE_HIGH;
    ctx.fillStyle = inSafe ? COLORS.green : (temp > SAFE_HIGH ? COLORS.red : '#5599ff');
    ctx.fillText(`${temp.toFixed(1)}\u00B0C`, gaugeW / 2, -18);

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

    const s = state.current;
    const cx = w / 2;

    if (phase === 'ready') {
      const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
      skyGrad.addColorStop(0, '#0f2b1a');
      skyGrad.addColorStop(0.6, '#1a4a2a');
      skyGrad.addColorStop(1, '#2d6b3f');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, w, h);

      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Radiateur Naturel', cx, h * 0.25);
      ctx.font = '17px sans-serif';
      ctx.fillStyle = COLORS.cyan;
      ctx.fillText('The toucan\'s beak is nature\'s', cx, h * 0.33);
      ctx.fillText('radiator \u2014 regulate body temperature!', cx, h * 0.37);
      ctx.font = '15px sans-serif';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('TAP beak = radiate heat (-2\u00B0C)', cx, h * 0.45);
      ctx.fillText('HOLD in sun = absorb heat (+1\u00B0C/s)', cx, h * 0.49);
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Keep temp between 36\u00B0-40\u00B0C', cx, h * 0.55);
      ctx.fillText(`${GAME_DURATION}s timer`, cx, h * 0.59);
      ctx.fillStyle = COLORS.white;
      ctx.font = 'bold 20px sans-serif';
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = tapAlpha;
      ctx.fillText('TAP TO START', cx, h * 0.70);
      ctx.globalAlpha = 1;

      drawToucan(ctx, cx, h * 0.15, 38, elapsed * 2, 0, 0);

      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.toucanBobTime += delta * 2.5;
    s.sunAngle += delta;
    s.sunPulse = 0.8 + Math.sin(s.sunAngle * 2) * 0.2;

    // Weather timer
    s.weatherTimer += delta;
    if (s.weatherTimer >= s.weatherDuration) {
      nextWeather();
    }

    // Temperature changes from environment
    const prevTemp = s.temperature;
    switch (s.weather) {
      case 'sun':
        s.temperature += 1.5 * delta;
        break;
      case 'rain':
        s.temperature -= 1.8 * delta;
        break;
      case 'wind':
        s.temperature += (Math.sin(elapsed * 3) * 1.2) * delta;
        break;
    }

    // Hold to absorb heat (only in sun)
    if (s.isHolding && s.weather === 'sun') {
      s.temperature += HOLD_HEAT_RATE * delta;
      s.holdingSunny = true;
    } else {
      s.holdingSunny = false;
    }

    // Clamp temperature
    s.temperature = Math.max(TEMP_MIN, Math.min(TEMP_MAX, s.temperature));

    // Beak glow based on temperature extremes
    const inSafe = s.temperature >= SAFE_LOW && s.temperature <= SAFE_HIGH;
    if (s.temperature > SAFE_HIGH) {
      s.beakGlow = Math.min(1, (s.temperature - SAFE_HIGH) / 4);
    } else if (s.temperature < SAFE_LOW) {
      s.beakGlow = Math.min(1, (SAFE_LOW - s.temperature) / 4);
    } else {
      s.beakGlow *= 0.9;
    }

    // Tap cool flash decay
    s.beakCoolFlash *= Math.pow(0.01, delta);
    s.tapCoolTimer -= delta;
    if (s.tapCoolTimer <= 0) s.tappedRecently = false;

    // Score: time in safe zone
    if (inSafe) {
      s.safeTime += delta;
    }
    const tempDiff = Math.abs(s.temperature - prevTemp);
    s.stabilitySum += (1 - Math.min(1, tempDiff * 2));
    s.stabilitySamples++;
    const stabilityBonus = s.stabilitySamples > 0 ? s.stabilitySum / s.stabilitySamples : 0;
    s.score = Math.floor(s.safeTime * 10 * (1 + stabilityBonus));

    // Gauge shake when in danger
    if (!inSafe) {
      s.gaugeShake = (Math.random() - 0.5) * 4;
    } else {
      s.gaugeShake *= 0.8;
    }

    // Rain/wind particle management
    if (s.weather === 'rain') {
      for (const rd of s.raindrops) {
        if (rd.active) {
          rd.y += rd.speed * delta;
          if (rd.y > h) rd.active = false;
        } else if (Math.random() < 0.4) {
          rd.active = true;
          rd.x = Math.random() * w;
          rd.y = -10;
          rd.speed = 300 + Math.random() * 200;
          rd.length = 8 + Math.random() * 12;
        }
      }
    }
    if (s.weather === 'wind') {
      for (const wl of s.windLines) {
        if (wl.active) {
          wl.x += wl.speed * delta;
          if (wl.x > w + 50) wl.active = false;
        } else if (Math.random() < 0.25) {
          wl.active = true;
          wl.x = -30;
          wl.y = Math.random() * h;
          wl.speed = 200 + Math.random() * 300;
          wl.length = 30 + Math.random() * 50;
        }
      }
    }

    // Spawn heat particles from beak periodically when hot
    if (s.temperature > SAFE_HIGH && Math.random() < 0.15) {
      spawnHeatParticles(cx + 50, h * 0.4 - 10, 2);
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
      setDisplayScore(s.score);
      ctx.restore();
      return;
    }

    // --- RENDER ---
    // Background based on weather
    let bgTop, bgMid, bgBot;
    if (s.weather === 'sun') {
      bgTop = '#1a4a2a';
      bgMid = '#2d6b3f';
      bgBot = '#4a8a55';
    } else if (s.weather === 'rain') {
      bgTop = '#1a2a3a';
      bgMid = '#2a3a4a';
      bgBot = '#3a4a5a';
    } else {
      bgTop = '#1a3a3a';
      bgMid = '#2a5a4a';
      bgBot = '#3a6a5a';
    }
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, bgTop);
    skyGrad.addColorStop(0.5, bgMid);
    skyGrad.addColorStop(1, bgBot);
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Ground
    ctx.fillStyle = '#2a4a25';
    ctx.fillRect(0, h * 0.78, w, h * 0.22);
    // Grass tufts
    for (let gx = 0; gx < w; gx += 18) {
      const gh = 6 + Math.sin(gx * 0.5 + elapsed) * 3;
      ctx.strokeStyle = '#3a6a30';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(gx, h * 0.78);
      ctx.lineTo(gx - 3, h * 0.78 - gh);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(gx + 5, h * 0.78);
      ctx.lineTo(gx + 8, h * 0.78 - gh * 0.8);
      ctx.stroke();
    }

    // Tree branch
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(-10, h * 0.42);
    ctx.quadraticCurveTo(w * 0.2, h * 0.38, w * 0.55, h * 0.42);
    ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(w * 0.55, h * 0.42);
    ctx.quadraticCurveTo(w * 0.65, h * 0.40, w * 0.75, h * 0.44);
    ctx.stroke();

    // Leaves
    for (let lx = w * 0.05; lx < w * 0.7; lx += 22) {
      const ly = h * 0.38 + Math.sin(lx * 0.08) * 15 - 15;
      ctx.beginPath();
      ctx.ellipse(lx, ly, 12, 7, Math.sin(lx) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(30,${100 + Math.floor(Math.random() * 50)},40,0.7)`;
      ctx.fill();
    }

    // Weather effects
    if (s.weather === 'sun') {
      // Sun
      const sunX = w * 0.82;
      const sunY = h * 0.1;
      ctx.beginPath();
      ctx.arc(sunX, sunY, 40 * s.sunPulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,80,0.3)';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,230,100,0.8)';
      ctx.fill();
      // Rays
      for (let r = 0; r < 8; r++) {
        const ra = s.sunAngle + r * Math.PI / 4;
        ctx.beginPath();
        ctx.moveTo(sunX + Math.cos(ra) * 32, sunY + Math.sin(ra) * 32);
        ctx.lineTo(sunX + Math.cos(ra) * 50 * s.sunPulse, sunY + Math.sin(ra) * 50 * s.sunPulse);
        ctx.strokeStyle = 'rgba(255,230,100,0.5)';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }

    if (s.weather === 'rain') {
      // Dark clouds
      for (let ci = 0; ci < 4; ci++) {
        const cxp = w * 0.15 + ci * w * 0.22;
        const cyp = h * 0.06 + Math.sin(ci * 2) * 15;
        ctx.beginPath();
        ctx.ellipse(cxp, cyp, 60, 25, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(60,70,80,0.7)';
        ctx.fill();
      }
      // Raindrops
      for (const rd of s.raindrops) {
        if (!rd.active) continue;
        ctx.beginPath();
        ctx.moveTo(rd.x, rd.y);
        ctx.lineTo(rd.x - 1, rd.y - rd.length);
        ctx.strokeStyle = 'rgba(150,180,220,0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    if (s.weather === 'wind') {
      for (const wl of s.windLines) {
        if (!wl.active) continue;
        ctx.beginPath();
        ctx.moveTo(wl.x, wl.y);
        ctx.lineTo(wl.x + wl.length, wl.y + Math.sin(wl.x * 0.02) * 5);
        ctx.strokeStyle = 'rgba(200,220,200,0.3)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // Toucan
    const toucanX = cx - 20;
    const toucanY = h * 0.42 + Math.sin(s.toucanBobTime) * 4 - 26;
    drawToucan(ctx, toucanX, toucanY, s.temperature, s.toucanBobTime, s.beakGlow, s.beakCoolFlash);

    // Particles
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

    // Temperature gauge
    const gaugeW = w * 0.7;
    const gaugeH = 14;
    const gaugeX = (w - gaugeW) / 2;
    const gaugeY = h * 0.62;
    drawGauge(ctx, gaugeX + s.gaugeShake, gaugeY, gaugeW, gaugeH, s.temperature);

    // Weather indicator
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    const weatherEmoji = s.weather === 'sun' ? '\u2600\uFE0F' : s.weather === 'rain' ? '\uD83C\uDF27\uFE0F' : '\uD83C\uDF2C\uFE0F';
    const weatherLabel = s.weather === 'sun' ? 'Sunny' : s.weather === 'rain' ? 'Rain' : 'Wind';
    ctx.fillStyle = s.weather === 'sun' ? COLORS.gold : s.weather === 'rain' ? '#88bbff' : COLORS.gray;
    ctx.fillText(`${weatherEmoji} ${weatherLabel}`, cx, h * 0.72);

    // Weather timer bar
    const wtBarW = 80;
    const wtFrac = 1 - s.weatherTimer / s.weatherDuration;
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(cx - wtBarW / 2, h * 0.74, wtBarW, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(cx - wtBarW / 2, h * 0.74, wtBarW * wtFrac, 4);

    // Instructions
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    if (s.isHolding && s.weather === 'sun') {
      ctx.fillStyle = COLORS.gold;
      ctx.fillText('Absorbing heat from sun...', cx, h * 0.86);
    } else if (s.tappedRecently) {
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('Radiating heat! -2\u00B0C', cx, h * 0.86);
    } else {
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('TAP = cool \u2022 HOLD in sun = warm', cx, h * 0.86);
    }

    // Safe zone indicator
    ctx.font = 'bold 14px sans-serif';
    if (inSafe) {
      ctx.fillStyle = COLORS.green;
      ctx.fillText('\u2713 Safe Zone', cx, h * 0.90);
    } else if (s.temperature > SAFE_HIGH) {
      ctx.fillStyle = COLORS.red;
      ctx.fillText('\u26A0 Too Hot! Tap to cool!', cx, h * 0.90);
    } else {
      ctx.fillStyle = '#5599ff';
      ctx.fillText('\u26A0 Too Cold! Hold in sun!', cx, h * 0.90);
    }

    // HUD - Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.cyan;
    ctx.fillRect(0, 0, w * timerFrac, 4);

    // Timer text
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'right';
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 16, 36);

    // Score
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`Score: ${s.score}`, 60, 36);

    // Safe time display
    ctx.font = '14px sans-serif';
    ctx.fillStyle = COLORS.green;
    ctx.fillText(`Safe: ${s.safeTime.toFixed(1)}s`, 60, 56);

    ctx.restore();
  }, [phase, nextWeather, drawToucan, drawGauge, spawnHeatParticles]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION;
      s.temperature = 38;
      s.score = 0;
      s.safeTime = 0;
      s.stabilitySum = 0;
      s.stabilitySamples = 0;
      s.lastTemp = 38;
      s.weather = 'sun';
      s.weatherTimer = 0;
      s.weatherDuration = 7;
      s.isHolding = false;
      s.beakGlow = 0;
      s.beakCoolFlash = 0;
      s.gaugeShake = 0;
      for (const p of s.particles) p.active = false;
      for (const rd of s.raindrops) rd.active = false;
      for (const wl of s.windLines) wl.active = false;
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

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
          background: 'rgba(0,0,0,0.85)',
        }}>
          <div style={{ color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 16 }}>Time's Up!</div>
          <div style={{ color: COLORS.green, fontSize: 18, marginBottom: 8 }}>
            Safe zone: {state.current.safeTime.toFixed(1)}s / {GAME_DURATION}s
          </div>
          <div style={{ color: COLORS.cyan, fontSize: 16, marginBottom: 8 }}>
            Stability bonus: {(state.current.stabilitySamples > 0 ? state.current.stabilitySum / state.current.stabilitySamples : 0).toFixed(2)}x
          </div>
          <div style={{ color: COLORS.white, fontSize: 48, fontWeight: 'bold', marginBottom: 4 }}>
            {displayScore}
          </div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>points</div>
          <button onClick={() => onComplete(state.current.score)} style={{
            background: COLORS.cyan, color: COLORS.primary, border: 'none',
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
