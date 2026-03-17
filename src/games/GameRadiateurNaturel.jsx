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
const TEMP_MIN = 32;
const TEMP_MAX = 44;
const SAFE_LOW = 36;
const SAFE_HIGH = 40;
const TAP_COOL = 2;
const HOLD_HEAT_RATE = 1;
const WEATHER_TYPES = ['sun', 'rain', 'wind'];

export default function GameRadiateurNaturel({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);
  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION, temperature: 38, score: 0, safeTime: 0,
    stabilitySum: 0, stabilitySamples: 0, weather: 'sun',
    weatherTimer: 0, weatherDuration: 7, isHolding: false,
    beakGlow: 0, beakCoolFlash: 0, tapCoolTimer: 0,
    toucanBob: 0, sunAngle: 0, gaugeShake: 0,
    wasInSafe: true, lastWarningTime: 0, endTriggered: false,
    raindrops: Array(25).fill(null).map(() => ({ x: 0, y: 0, speed: 0, active: false, len: 10 })),
    windLines: Array(15).fill(null).map(() => ({ x: 0, y: 0, speed: 0, active: false, len: 30 })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0, type: 'dot',
    })),
  });

  const nextWeather = useCallback(() => {
    const s = state.current;
    const avail = WEATHER_TYPES.filter(w => w !== s.weather);
    s.weather = avail[Math.floor(Math.random() * avail.length)];
    s.weatherDuration = 6 + Math.random() * 2;
    s.weatherTimer = 0;
    sounds.whoosh();
    haptics.tapFeedback();
  }, [sounds, haptics]);

  const spawnParticles = useCallback((cx, cy, count, hot) => {
    const s = state.current;
    let spawned = 0;
    for (let i = 0; i < s.particles.length && spawned < count; i++) {
      const p = s.particles[i];
      if (!p.active) {
        p.active = true;
        p.x = cx + (Math.random() - 0.5) * 24;
        p.y = cy + (Math.random() - 0.5) * 12;
        p.vx = (Math.random() - 0.5) * 50;
        p.vy = -30 - Math.random() * 50;
        p.life = 0.4 + Math.random() * 0.5;
        p.maxLife = p.life;
        if (hot) { p.r = 255; p.g = 100 + Math.floor(Math.random() * 80); p.b = 50; }
        else { p.r = 100; p.g = 180; p.b = 255; }
        p.size = 2 + Math.random() * 3;
        p.type = Math.random() > 0.5 ? 'dot' : 'line';
        spawned++;
      }
    }
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') { if (phase === 'ready') setPhase('playing'); return; }
    const s = state.current;
    s.temperature = Math.max(TEMP_MIN, s.temperature - TAP_COOL);
    s.beakCoolFlash = 0.5;
    s.tapCoolTimer = 0.3;
    sounds.pop();
    haptics.tapFeedback();
    juice.shake(3, 0.15);
    juice.flash('#FF6B35', 0.15);
    const canvas = canvasRef.current;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas ? canvas.width / dpr : 400;
    const h = canvas ? canvas.height / dpr : 700;
    spawnParticles(w * 0.5 + 50, h * 0.4 - 10, 6, true);
  }, [phase, sounds, haptics, juice, spawnParticles]);

  const handleHoldStart = useCallback(() => { if (phase === 'playing') state.current.isHolding = true; }, [phase]);
  const handleHoldEnd = useCallback(() => { state.current.isHolding = false; }, []);

  useTouch(canvasRef, { onTap: handleTap, onHoldStart: handleHoldStart, onHoldEnd: handleHoldEnd });

  const drawToucan = useCallback((ctx, x, y, temp, bob, glw, coolF) => {
    ctx.save();
    ctx.translate(x, y);
    const bb = Math.sin(bob) * 2;
    // Body
    ctx.beginPath(); ctx.ellipse(0, 0, 32, 24, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e'; ctx.fill();
    // White chest
    ctx.beginPath(); ctx.ellipse(12, 4, 16, 14, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f0e8'; ctx.fill();
    // Head
    ctx.beginPath(); ctx.arc(30, -12, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e'; ctx.fill();
    // Eye
    ctx.beginPath(); ctx.arc(36, -16, 7, 0, Math.PI * 2); ctx.fillStyle = '#2ecc71'; ctx.fill();
    ctx.beginPath(); ctx.arc(37, -16, 4, 0, Math.PI * 2); ctx.fillStyle = '#111'; ctx.fill();
    ctx.beginPath(); ctx.arc(38, -17, 1.5, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    // Beak with glow
    ctx.save();
    if (glw > 0.05 || coolF > 0.05) {
      ctx.shadowBlur = 15 + glw * 15;
      ctx.shadowColor = temp > SAFE_HIGH ? `rgba(255,60,30,${glw * 0.8})`
        : temp < SAFE_LOW ? `rgba(50,120,255,${glw * 0.8})` : `rgba(255,180,50,${glw * 0.4})`;
    }
    if (coolF > 0.05) { ctx.shadowBlur = 20; ctx.shadowColor = `rgba(255,100,50,${coolF})`; }
    // Upper beak
    ctx.beginPath(); ctx.moveTo(44, -14 + bb);
    ctx.quadraticCurveTo(70, -20 + bb, 88, -10 + bb);
    ctx.quadraticCurveTo(72, -6 + bb, 44, -8 + bb); ctx.closePath();
    const ug = ctx.createLinearGradient(44, -20, 88, -5);
    ug.addColorStop(0, '#ff6b35'); ug.addColorStop(0.4, '#ffd700');
    ug.addColorStop(0.7, '#ff4500'); ug.addColorStop(1, '#cc0000');
    ctx.fillStyle = ug; ctx.fill();
    // Lower beak
    ctx.beginPath(); ctx.moveTo(44, -6 + bb);
    ctx.quadraticCurveTo(68, bb, 85, -6 + bb);
    ctx.quadraticCurveTo(68, 4 + bb, 44, -2 + bb); ctx.closePath();
    ctx.fillStyle = '#222'; ctx.fill();
    // Temperature tint
    if (temp > SAFE_HIGH || temp < SAFE_LOW) {
      const ext = temp > SAFE_HIGH ? Math.min(1, (temp - SAFE_HIGH) / 4) : Math.min(1, (SAFE_LOW - temp) / 4);
      ctx.globalAlpha = ext * 0.4;
      ctx.beginPath(); ctx.moveTo(44, -14 + bb);
      ctx.quadraticCurveTo(70, -20 + bb, 88, -10 + bb);
      ctx.quadraticCurveTo(72, -6 + bb, 44, -8 + bb); ctx.closePath();
      ctx.fillStyle = temp > SAFE_HIGH ? '#ff0000' : '#3388ff'; ctx.fill();
      ctx.globalAlpha = 1;
    }
    ctx.shadowBlur = 0; ctx.restore();
    // Tail
    ctx.beginPath(); ctx.moveTo(-30, -4); ctx.lineTo(-52, -14);
    ctx.lineTo(-48, 0); ctx.lineTo(-52, 12); ctx.closePath();
    ctx.fillStyle = '#cc2200'; ctx.fill();
    // Wing
    ctx.beginPath(); ctx.ellipse(-10, 2, 20, 14, -0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e'; ctx.fill();
    // Feet
    ctx.strokeStyle = '#555'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(-4, 22); ctx.lineTo(-6, 34);
    ctx.moveTo(-6, 34); ctx.lineTo(-12, 37); ctx.moveTo(-6, 34); ctx.lineTo(-1, 37); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 22); ctx.lineTo(8, 34);
    ctx.moveTo(8, 34); ctx.lineTo(2, 37); ctx.moveTo(8, 34); ctx.lineTo(13, 37); ctx.stroke();
    ctx.restore();
  }, []);

  const drawGauge = useCallback((ctx, x, y, gW, gH, temp) => {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.roundRect(-2, -2, gW + 4, gH + 4, 6); ctx.fill();
    const range = TEMP_MAX - TEMP_MIN;
    const coldEnd = (SAFE_LOW - TEMP_MIN) / range;
    const safeEnd = (SAFE_HIGH - TEMP_MIN) / range;
    ctx.fillStyle = '#3388ff'; ctx.fillRect(0, 0, gW * coldEnd, gH);
    ctx.fillStyle = '#22c55e'; ctx.fillRect(gW * coldEnd, 0, gW * (safeEnd - coldEnd), gH);
    ctx.fillStyle = '#ef4444'; ctx.fillRect(gW * safeEnd, 0, gW * (1 - safeEnd), gH);
    const frac = Math.max(0, Math.min(1, (temp - TEMP_MIN) / range));
    const mx = gW * frac;
    ctx.fillStyle = COLORS.white;
    ctx.beginPath(); ctx.moveTo(mx, -6); ctx.lineTo(mx - 5, -12); ctx.lineTo(mx + 5, -12); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.roundRect(mx - 2, -1, 4, gH + 2, 1); ctx.fill();
    ctx.font = `11px ${FONT_FAMILY}`; ctx.textAlign = 'center';
    ctx.fillStyle = '#88bbff'; ctx.fillText(`${TEMP_MIN}\u00B0`, 0, gH + 14);
    ctx.fillStyle = '#22c55e'; ctx.fillText(`${SAFE_LOW}\u00B0`, gW * coldEnd, gH + 14);
    ctx.fillText(`${SAFE_HIGH}\u00B0`, gW * safeEnd, gH + 14);
    ctx.fillStyle = '#ff6666'; ctx.fillText(`${TEMP_MAX}\u00B0`, gW, gH + 14);
    ctx.font = `bold 18px ${FONT_FAMILY}`;
    const inS = temp >= SAFE_LOW && temp <= SAFE_HIGH;
    ctx.fillStyle = inS ? COLORS.green : (temp > SAFE_HIGH ? COLORS.red : '#5599ff');
    ctx.fillText(`${temp.toFixed(1)}\u00B0C`, gW / 2, -18);
    ctx.restore();
  }, []);

  const gameLoop = useGameLoop(useCallback(({ elapsed, delta }) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
      canvas.width = w * dpr; canvas.height = h * dpr;
      canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    }
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.scale(dpr, dpr);
    const s = state.current;
    const cx = w / 2;

    // Update juice system
    juice.update(delta);

    if (phase === 'ready') {
      const sg = ctx.createLinearGradient(0, 0, 0, h);
      sg.addColorStop(0, '#0f2b1a'); sg.addColorStop(0.6, '#1a4a2a'); sg.addColorStop(1, '#2d6b3f');
      ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['23']), cx, h * 0.25, '#22c55e', 26);

      // Glow behind toucan on ready screen
      juice.drawGlow(ctx, cx, h * 0.15, 80, '#ff6b35', 0.2);

      ctx.font = `17px ${FONT_FAMILY}`; ctx.textAlign = 'center'; ctx.fillStyle = COLORS.cyan;
      ctx.fillText('The toucan\'s beak is nature\'s', cx, h * 0.33);
      ctx.fillText('radiator \u2014 regulate body temperature!', cx, h * 0.37);
      ctx.font = `15px ${FONT_FAMILY}`; ctx.fillStyle = COLORS.gold;
      ctx.fillText('TAP beak = radiate heat (-2\u00B0C)', cx, h * 0.45);
      ctx.fillText('HOLD in sun = absorb heat (+1\u00B0C/s)', cx, h * 0.49);
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('Keep temp between 36\u00B0-40\u00B0C \u2022 45s', cx, h * 0.55);

      // Pulsing neon "TAP TO START"
      const pulse = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.globalAlpha = pulse;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, h * 0.68, '#00e5ff', 20);
      ctx.globalAlpha = 1;

      drawToucan(ctx, cx, h * 0.15, 38, elapsed * 2, 0, 0);
      ctx.restore(); return;
    }

    // --- UPDATE ---
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.toucanBob += delta * 2.5;
    s.sunAngle += delta;
    s.weatherTimer += delta;
    if (s.weatherTimer >= s.weatherDuration) nextWeather();

    // Environment temp changes
    if (s.weather === 'sun') s.temperature += 1.5 * delta;
    else if (s.weather === 'rain') s.temperature -= 1.8 * delta;
    else s.temperature += Math.sin(elapsed * 3) * 1.2 * delta;

    // Hold absorb heat in sun
    if (s.isHolding && s.weather === 'sun') s.temperature += HOLD_HEAT_RATE * delta;
    s.temperature = Math.max(TEMP_MIN, Math.min(TEMP_MAX, s.temperature));

    const inSafe = s.temperature >= SAFE_LOW && s.temperature <= SAFE_HIGH;

    // Juice: detect leaving/entering safe zone
    if (s.wasInSafe && !inSafe) {
      // Left safe zone
      juice.shake(5, 0.25);
      juice.flash('#ef4444', 0.25);
      sounds.fail();
      haptics.warningFeedback();
    } else if (!s.wasInSafe && inSafe) {
      // Entered safe zone
      juice.flash('#22c55e', 0.2);
      sounds.chime();
      haptics.successFeedback();
    }
    s.wasInSafe = inSafe;

    // Warning haptics when temperature is extreme
    if (!inSafe && s.timeLeft > 0) {
      const extremity = s.temperature > SAFE_HIGH
        ? (s.temperature - SAFE_HIGH) / (TEMP_MAX - SAFE_HIGH)
        : (SAFE_LOW - s.temperature) / (SAFE_LOW - TEMP_MIN);
      if (extremity > 0.7 && elapsed - s.lastWarningTime > 1.5) {
        haptics.warningFeedback();
        s.lastWarningTime = elapsed;
      }
    }

    s.beakGlow = (s.temperature > SAFE_HIGH) ? Math.min(1, (s.temperature - SAFE_HIGH) / 4)
      : (s.temperature < SAFE_LOW) ? Math.min(1, (SAFE_LOW - s.temperature) / 4) : s.beakGlow * 0.9;
    s.beakCoolFlash *= Math.pow(0.01, delta);
    s.tapCoolTimer = Math.max(0, s.tapCoolTimer - delta);
    if (inSafe) s.safeTime += delta;
    s.stabilitySum += 1; s.stabilitySamples++;
    const stab = s.stabilitySamples > 0 ? s.stabilitySum / s.stabilitySamples : 0;
    s.score = Math.floor(s.safeTime * 10 * (1 + Math.min(1, stab / s.stabilitySamples * 0.5)));
    s.score = Math.floor(s.safeTime * 10 * (1 + (inSafe ? 0.5 : 0)));
    s.gaugeShake = inSafe ? s.gaugeShake * 0.8 : (Math.random() - 0.5) * 4;

    // Weather particles
    if (s.weather === 'rain') {
      for (const rd of s.raindrops) {
        if (rd.active) { rd.y += rd.speed * delta; if (rd.y > h) rd.active = false; }
        else if (Math.random() < 0.35) {
          rd.active = true; rd.x = Math.random() * w; rd.y = -10;
          rd.speed = 300 + Math.random() * 200; rd.len = 8 + Math.random() * 12;
        }
      }
    }
    if (s.weather === 'wind') {
      for (const wl of s.windLines) {
        if (wl.active) { wl.x += wl.speed * delta; if (wl.x > w + 50) wl.active = false; }
        else if (Math.random() < 0.2) {
          wl.active = true; wl.x = -30; wl.y = Math.random() * h;
          wl.speed = 200 + Math.random() * 300; wl.len = 30 + Math.random() * 50;
        }
      }
    }

    // Auto heat particles when hot
    if (s.temperature > SAFE_HIGH && Math.random() < 0.12)
      spawnParticles(cx + 50, h * 0.4 - 10, 2, true);

    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta; p.y += p.vy * delta;
      p.life -= delta; if (p.life <= 0) p.active = false;
    }

    // Low time warning sound
    if (s.timeLeft <= 5 && s.timeLeft > 0 && Math.floor(s.timeLeft) !== Math.floor(s.timeLeft + delta)) {
      sounds.countdown(s.timeLeft <= 1);
      haptics.warningFeedback();
      juice.flash('#ef4444', 0.1);
    }

    if (s.timeLeft <= 0 && phase === 'playing' && !s.endTriggered) {
      s.endTriggered = true;
      const finalScore = s.score;
      if (finalScore > 200) {
        sounds.success();
        haptics.successFeedback();
        juice.flash('#22c55e', 0.4);
      } else {
        sounds.fail();
        haptics.failFeedback();
        juice.flash('#ef4444', 0.4);
      }
      juice.shake(6, 0.3);
      setPhase('ended'); setDisplayScore(finalScore); ctx.restore(); return;
    }

    // --- RENDER ---
    // Apply shake transform
    juice.applyShake(ctx);

    const bgColors = s.weather === 'sun' ? ['#1a4a2a','#2d6b3f','#4a8a55']
      : s.weather === 'rain' ? ['#1a2a3a','#2a3a4a','#3a4a5a'] : ['#1a3a3a','#2a5a4a','#3a6a5a'];
    const sg = ctx.createLinearGradient(0, 0, 0, h);
    sg.addColorStop(0, bgColors[0]); sg.addColorStop(0.5, bgColors[1]); sg.addColorStop(1, bgColors[2]);
    ctx.fillStyle = sg; ctx.fillRect(0, 0, w, h);

    // Ground + grass
    ctx.fillStyle = '#2a4a25'; ctx.fillRect(0, h * 0.78, w, h * 0.22);
    for (let gx = 0; gx < w; gx += 20) {
      const gh = 6 + Math.sin(gx * 0.5 + elapsed) * 3;
      ctx.strokeStyle = '#3a6a30'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(gx, h * 0.78); ctx.lineTo(gx - 3, h * 0.78 - gh); ctx.stroke();
    }

    // Branch
    ctx.strokeStyle = '#5a3a1a'; ctx.lineWidth = 8;
    ctx.beginPath(); ctx.moveTo(-10, h * 0.42);
    ctx.quadraticCurveTo(w * 0.2, h * 0.38, w * 0.55, h * 0.42); ctx.stroke();
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(w * 0.55, h * 0.42);
    ctx.quadraticCurveTo(w * 0.65, h * 0.40, w * 0.75, h * 0.44); ctx.stroke();

    // Leaves
    for (let lx = w * 0.05; lx < w * 0.7; lx += 24) {
      const ly = h * 0.38 + Math.sin(lx * 0.08) * 15 - 15;
      ctx.beginPath(); ctx.ellipse(lx, ly, 12, 7, Math.sin(lx) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(30,${110 + (lx * 7 % 40)},40,0.7)`; ctx.fill();
    }

    // Weather effects
    if (s.weather === 'sun') {
      const sunX = w * 0.82, sunY = h * 0.1;
      const pulse = 0.8 + Math.sin(s.sunAngle * 2) * 0.2;
      // Sun glow effect
      juice.drawGlow(ctx, sunX, sunY, 70 * pulse, '#ffdc50', 0.3);
      ctx.beginPath(); ctx.arc(sunX, sunY, 40 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,220,80,0.3)'; ctx.fill();
      ctx.beginPath(); ctx.arc(sunX, sunY, 28, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,230,100,0.8)'; ctx.fill();
      for (let r = 0; r < 8; r++) {
        const ra = s.sunAngle + r * Math.PI / 4;
        ctx.beginPath(); ctx.moveTo(sunX + Math.cos(ra) * 32, sunY + Math.sin(ra) * 32);
        ctx.lineTo(sunX + Math.cos(ra) * 50 * pulse, sunY + Math.sin(ra) * 50 * pulse);
        ctx.strokeStyle = 'rgba(255,230,100,0.5)'; ctx.lineWidth = 3; ctx.stroke();
      }
    } else if (s.weather === 'rain') {
      for (let ci = 0; ci < 4; ci++) {
        ctx.beginPath(); ctx.ellipse(w * 0.15 + ci * w * 0.22, h * 0.06 + Math.sin(ci * 2) * 15, 60, 25, 0, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(60,70,80,0.7)'; ctx.fill();
      }
      for (const rd of s.raindrops) {
        if (!rd.active) continue;
        ctx.beginPath(); ctx.moveTo(rd.x, rd.y); ctx.lineTo(rd.x - 1, rd.y - rd.len);
        ctx.strokeStyle = 'rgba(150,180,220,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    } else {
      for (const wl of s.windLines) {
        if (!wl.active) continue;
        ctx.beginPath(); ctx.moveTo(wl.x, wl.y);
        ctx.lineTo(wl.x + wl.len, wl.y + Math.sin(wl.x * 0.02) * 5);
        ctx.strokeStyle = 'rgba(200,220,200,0.3)'; ctx.lineWidth = 1.5; ctx.stroke();
      }
    }

    // Toucan glow based on temperature state
    const tx = cx - 20, ty = h * 0.42 + Math.sin(s.toucanBob) * 4 - 26;
    if (!inSafe) {
      const glowColor = s.temperature > SAFE_HIGH ? '#ff4444' : '#4488ff';
      const glowIntensity = s.temperature > SAFE_HIGH
        ? Math.min(1, (s.temperature - SAFE_HIGH) / 4)
        : Math.min(1, (SAFE_LOW - s.temperature) / 4);
      juice.drawGlow(ctx, tx + 60, ty - 10, 50 + glowIntensity * 30, glowColor, glowIntensity * 0.35);
    } else {
      juice.drawGlow(ctx, tx + 60, ty - 10, 30, '#22c55e', 0.15);
    }

    // Toucan
    drawToucan(ctx, tx, ty, s.temperature, s.toucanBob, s.beakGlow, s.beakCoolFlash);

    // Particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.particles) {
      if (!p.active) continue;
      const a = p.life / p.maxLife;
      if (p.type === 'line') {
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
        ctx.strokeStyle = `rgba(${p.r},${p.g},${p.b},${a})`; ctx.lineWidth = p.size * 0.8; ctx.stroke();
      } else {
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${a})`; ctx.fill();
      }
    }
    ctx.restore();

    // Gauge
    const gW = w * 0.7, gH = 14, gX = (w - gW) / 2, gY = h * 0.62;
    drawGauge(ctx, gX + s.gaugeShake, gY, gW, gH, s.temperature);

    // Weather indicator with neon text
    const wLabel = s.weather === 'sun' ? '\u2600\uFE0F Sunny' : s.weather === 'rain' ? '\uD83C\uDF27\uFE0F Rain' : '\uD83C\uDF2C\uFE0F Wind';
    const wColor = s.weather === 'sun' ? '#ffd700' : s.weather === 'rain' ? '#88bbff' : '#aaddaa';
    juice.drawNeonText(ctx, wLabel, cx, h * 0.72, wColor, 16);

    const wtW = 80, wtF = 1 - s.weatherTimer / s.weatherDuration;
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(cx - wtW / 2, h * 0.74, wtW, 4);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.fillRect(cx - wtW / 2, h * 0.74, wtW * wtF, 4);

    // Status text
    ctx.font = `13px ${FONT_FAMILY}`; ctx.textAlign = 'center';
    if (s.isHolding && s.weather === 'sun') { ctx.fillStyle = COLORS.gold; ctx.fillText('Absorbing heat from sun...', cx, h * 0.86); }
    else if (s.tapCoolTimer > 0) { ctx.fillStyle = COLORS.mint; ctx.fillText('Radiating heat! -2\u00B0C', cx, h * 0.86); }
    else { ctx.fillStyle = COLORS.gray; ctx.fillText('TAP = cool \u2022 HOLD in sun = warm', cx, h * 0.86); }

    ctx.font = `bold 14px ${FONT_FAMILY}`;
    if (inSafe) { ctx.fillStyle = COLORS.green; ctx.fillText('\u2713 Safe Zone', cx, h * 0.90); }
    else if (s.temperature > SAFE_HIGH) { ctx.fillStyle = COLORS.red; ctx.fillText('\u26A0 Too Hot! Tap to cool!', cx, h * 0.90); }
    else { ctx.fillStyle = '#5599ff'; ctx.fillText('\u26A0 Too Cold! Hold in sun!', cx, h * 0.90); }

    // HUD
    ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(0, 0, w, 4);
    const tf = s.timeLeft / GAME_DURATION;
    ctx.fillStyle = s.timeLeft < 5 ? COLORS.red : COLORS.cyan; ctx.fillRect(0, 0, w * tf, 4);

    // Neon timer
    const timerColor = s.timeLeft < 5 ? '#ef4444' : '#00e5ff';
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 36, 36, timerColor, 22);

    // Neon score
    juice.drawNeonText(ctx, t(UI_STRINGS.score) + ': ' + s.score, 90, 36, '#ffffff', 18);

    ctx.font = `14px ${FONT_FAMILY}`; ctx.textAlign = 'left'; ctx.fillStyle = COLORS.green;
    ctx.fillText(`Safe: ${s.safeTime.toFixed(1)}s`, 60, 56);

    // Draw screen flash overlay
    juice.drawFlash(ctx, w, h);

    ctx.restore();
  }, [phase, nextWeather, drawToucan, drawGauge, spawnParticles, juice, sounds, haptics, t]));

  useEffect(() => { if (phase === 'ready') gameLoop.start(); }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.timeLeft = GAME_DURATION; s.temperature = 38; s.score = 0;
      s.safeTime = 0; s.stabilitySum = 0; s.stabilitySamples = 0;
      s.weather = 'sun'; s.weatherTimer = 0; s.weatherDuration = 7;
      s.isHolding = false; s.beakGlow = 0; s.beakCoolFlash = 0; s.gaugeShake = 0;
      s.wasInSafe = true; s.lastWarningTime = 0; s.endTriggered = false;
      for (const p of s.particles) p.active = false;
      for (const rd of s.raindrops) rd.active = false;
      for (const wl of s.windLines) wl.active = false;
      sounds.countdown(true);
      haptics.tapFeedback();
      gameLoop.reset(); gameLoop.start();
    }
  }, [phase, gameLoop, sounds, haptics]);

  useEffect(() => { if (phase === 'ended') gameLoop.stop(); }, [phase, gameLoop]);
  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const safePercent = state.current.safeTime > 0
    ? Math.round((state.current.safeTime / GAME_DURATION) * 100) : 0;
  const isGoodScore = displayScore > 200;

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
            color: isGoodScore ? '#22c55e' : '#ef4444',
            fontSize: 28,
            fontWeight: 'bold',
            marginBottom: 16,
            textShadow: isGoodScore
              ? '0 0 20px rgba(34,197,94,0.6), 0 0 40px rgba(34,197,94,0.3)'
              : '0 0 20px rgba(239,68,68,0.6), 0 0 40px rgba(239,68,68,0.3)',
          }}>
            {t(UI_STRINGS.timesUp)}
          </div>
          <div style={{
            color: COLORS.green,
            fontSize: 18,
            marginBottom: 8,
            textShadow: '0 0 10px rgba(34,197,94,0.4)',
          }}>
            Safe zone: {state.current.safeTime.toFixed(1)}s / {GAME_DURATION}s ({safePercent}%)
          </div>
          <div style={{
            color: COLORS.white,
            fontSize: 48,
            fontWeight: 'bold',
            marginBottom: 4,
            textShadow: '0 0 30px rgba(0,229,255,0.6), 0 0 60px rgba(0,229,255,0.3)',
          }}>{displayScore}</div>
          <div style={{
            color: COLORS.gray,
            fontSize: 14,
            marginBottom: 24,
            textShadow: '0 0 8px rgba(255,255,255,0.2)',
          }}>{t(UI_STRINGS.points)}</div>
          <button onClick={() => {
            sounds.success();
            haptics.tapFeedback();
            onComplete(state.current.score);
          }} style={{
            background: 'linear-gradient(135deg, #00e5ff, #00b8d4)',
            color: '#0a1628',
            border: 'none',
            padding: '14px 40px',
            borderRadius: 12,
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: '0 0 20px rgba(0,229,255,0.4), 0 4px 15px rgba(0,0,0,0.3)',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={() => {
            sounds.tick();
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'transparent',
            color: COLORS.gray,
            border: `1px solid rgba(255,255,255,0.2)`,
            padding: '10px 30px',
            borderRadius: 12,
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            boxShadow: '0 0 10px rgba(255,255,255,0.05)',
            textShadow: '0 0 8px rgba(255,255,255,0.15)',
          }}>{t(UI_STRINGS.back)}</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => {
          sounds.tick();
          haptics.tapFeedback();
          onBack();
        }} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
          color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 14, cursor: 'pointer', zIndex: 10, fontFamily: FONT_FAMILY,
          backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        }}>{t(UI_STRINGS.back)}</button>
      )}
    </div>
  );
}
