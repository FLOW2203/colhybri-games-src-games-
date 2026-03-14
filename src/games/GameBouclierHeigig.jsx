import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';

const FONT_FAMILY = '-apple-system, BlinkMacSystemFont, sans-serif';
const GAME_DURATION = 40;
const POOL_SIZE = 120;
const NUM_DEFENDERS = 5;
const TREE_HP = 3;
const ORBIT_RADIUS_RATIO = 0.22;

export default function GameBouclierHeigig({ onComplete, onBack }) {
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
    hp: TREE_HP,
    treeDepth: 5,
    treeBuds: [],
    flames: [],
    flameSpawnTimer: 0,
    flameSpawnInterval: 2.5,
    defenders: Array(NUM_DEFENDERS).fill(null).map((_, i) => ({
      angle: (i / NUM_DEFENDERS) * Math.PI * 2,
      x: 0, y: 0,
      state: 'orbiting',
      targetX: 0, targetY: 0,
      returnX: 0, returnY: 0,
      speed: 300,
      targetFlameIdx: -1,
    })),
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    treeGrowTimer: 0,
    coreGlow: 0,
    damageFlash: 0,
    lastWarningTime: -1,
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
        const speed = 60 + Math.random() * 150;
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

  const handleTap = useCallback(({ x, y }) => {
    if (phase === 'ready') {
      setPhase('playing');
      haptics.tapFeedback();
      sounds.countdown(true);
      return;
    }
    if (phase !== 'playing') return;
    const s = state.current;

    // Find nearest flame to tap position
    let nearestFlame = -1;
    let nearestDist = Infinity;
    for (let i = 0; i < s.flames.length; i++) {
      const f = s.flames[i];
      const d = Math.hypot(f.x - x, f.y - y);
      if (d < nearestDist && d < 150) {
        nearestDist = d;
        nearestFlame = i;
      }
    }
    if (nearestFlame === -1) return;

    // Find nearest available defender
    let nearestDef = -1;
    let nearestDefDist = Infinity;
    for (let i = 0; i < s.defenders.length; i++) {
      const d = s.defenders[i];
      if (d.state !== 'orbiting') continue;
      const dist = Math.hypot(d.x - s.flames[nearestFlame].x, d.y - s.flames[nearestFlame].y);
      if (dist < nearestDefDist) {
        nearestDefDist = dist;
        nearestDef = i;
      }
    }
    if (nearestDef === -1) return;

    const def = s.defenders[nearestDef];
    def.state = 'attacking';
    def.targetFlameIdx = nearestFlame;
    def.targetX = s.flames[nearestFlame].x;
    def.targetY = s.flames[nearestFlame].y;
    sounds.whoosh();
    haptics.tapFeedback();
  }, [phase, sounds, haptics]);

  useTouch(canvasRef, { onTap: handleTap });

  function drawFractalTree(ctx, x, y, len, angle, depth, maxDepth, buds) {
    if (depth > maxDepth || len < 3) return;
    const endX = x + Math.cos(angle) * len;
    const endY = y + Math.sin(angle) * len;

    const thickness = Math.max(1, (maxDepth - depth) * 2.5);
    const green = Math.floor(80 + (depth / maxDepth) * 100);
    ctx.strokeStyle = depth < 2 ? '#5C3D1E' : `rgb(${60 - depth * 5},${green},${30})`;
    ctx.lineWidth = thickness;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(endX, endY);
    ctx.stroke();

    // Draw buds at branch ends
    if (depth >= maxDepth - 1) {
      for (const bud of buds) {
        if (Math.abs(bud.x - endX) < 10 && Math.abs(bud.y - endY) < 10) {
          ctx.beginPath();
          ctx.arc(endX, endY, 4 + bud.size * 2, 0, Math.PI * 2);
          ctx.fillStyle = bud.color;
          ctx.fill();
        }
      }
    }

    const branchAngle = 0.4 + (depth * 0.05);
    const nextLen = len * 0.68;
    drawFractalTree(ctx, endX, endY, nextLen, angle - branchAngle, depth + 1, maxDepth, buds);
    drawFractalTree(ctx, endX, endY, nextLen, angle + branchAngle, depth + 1, maxDepth, buds);
    if (depth < 3) {
      drawFractalTree(ctx, endX, endY, nextLen * 0.8, angle, depth + 1, maxDepth, buds);
    }
  }

  function drawBird(ctx, x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wings
    ctx.beginPath();
    ctx.moveTo(-5, -2);
    ctx.quadraticCurveTo(-14, -10, -8, -3);
    ctx.moveTo(5, -2);
    ctx.quadraticCurveTo(14, -10, 8, -3);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();
    // Eye
    ctx.beginPath();
    ctx.arc(5, -1, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
  }

  function drawFlame(ctx, x, y, size, time) {
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 5; i++) {
      const flicker = Math.sin(time * 8 + i * 1.5) * 3;
      const s = size * (1 - i * 0.15);
      ctx.beginPath();
      ctx.moveTo(-s, 0);
      ctx.quadraticCurveTo(-s * 0.5, -s * 1.5 + flicker, 0, -s * 2 + flicker);
      ctx.quadraticCurveTo(s * 0.5, -s * 1.5 + flicker, s, 0);
      ctx.closePath();
      const alpha = 0.8 - i * 0.12;
      const r = 255;
      const g = Math.floor(80 + i * 40);
      const b = 0;
      ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
      ctx.fill();
    }
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
    const cy = h / 2;
    const orbitR = Math.min(w, h) * ORBIT_RADIUS_RATIO;

    // Update juice effects every frame
    juice.update(delta);

    if (phase === 'ready') {
      ctx.fillStyle = '#0A0F1C';
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, 'Bouclier de Heigig', w / 2, h / 2 - 70, '#22C55E', 26);

      // Glow behind title
      juice.drawGlow(ctx, w / 2, h / 2 - 70, 120, '#22C55E', 0.15);

      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText('The World-Tree Heigig links', w / 2, h / 2 - 20);
      ctx.fillText('sky and earth. Defend it!', w / 2, h / 2 + 4);
      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText('TAP near flames to send defenders', w / 2, h / 2 + 50);

      // Pulsing "TAP TO START" with neon
      const pulse = 0.7 + 0.3 * Math.sin(elapsed * 3);
      ctx.globalAlpha = pulse;
      juice.drawNeonText(ctx, 'TAP TO START', w / 2, h / 2 + 110, '#FFFFFF', 20);
      ctx.globalAlpha = 1;

      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    // Low time warning haptic
    if (s.timeLeft < 5 && s.timeLeft > 0) {
      const sec = Math.ceil(s.timeLeft);
      if (sec !== s.lastWarningTime) {
        s.lastWarningTime = sec;
        haptics.warningFeedback();
        sounds.tick();
      }
    }

    // Spawn flames
    s.flameSpawnTimer += delta;
    s.flameSpawnInterval = Math.max(0.6, 2.5 - elapsed * 0.04);
    if (s.flameSpawnTimer >= s.flameSpawnInterval) {
      s.flameSpawnTimer = 0;
      const dirIdx = Math.floor(Math.random() * 8);
      const angle = (dirIdx / 8) * Math.PI * 2;
      const dist = Math.max(w, h) * 0.55;
      s.flames.push({
        x: cx + Math.cos(angle) * dist,
        y: cy + Math.sin(angle) * dist,
        angle: angle + Math.PI,
        speed: 50 + elapsed * 1.5,
        size: 10 + Math.random() * 8,
        alive: true,
      });
    }

    // Update flames
    for (let i = s.flames.length - 1; i >= 0; i--) {
      const f = s.flames[i];
      if (!f.alive) { s.flames.splice(i, 1); continue; }
      f.x += Math.cos(f.angle) * f.speed * delta;
      f.y += Math.sin(f.angle) * f.speed * delta;

      // Hit tree?
      const distToCenter = Math.hypot(f.x - cx, f.y - cy);
      if (distToCenter < 30) {
        f.alive = false;
        s.hp--;
        s.damageFlash = 1;
        sounds.firecrackle();
        sounds.impact();
        haptics.heavyFeedback();
        juice.shake(12, 0.4);
        juice.flash('#FF0000', 0.5);
        spawnParticles(cx, cy, 12, 255, 80, 0);
        if (s.hp <= 0) {
          sounds.fail();
          haptics.failFeedback();
          juice.shake(20, 0.6);
          juice.flash('#FF0000', 0.7);
          setPhase('ended');
          return;
        }
      }
    }

    // Update defenders
    const defenderColors = ['#E8D44D', '#87CEEB', '#FF6B6B', '#98FB98', '#DDA0DD'];
    for (let i = 0; i < s.defenders.length; i++) {
      const d = s.defenders[i];
      if (d.state === 'orbiting') {
        d.angle += delta * 0.8;
        d.x = cx + Math.cos(d.angle) * orbitR;
        d.y = cy + Math.sin(d.angle) * orbitR;
      } else if (d.state === 'attacking') {
        // Check if target flame still exists
        if (d.targetFlameIdx >= 0 && d.targetFlameIdx < s.flames.length && s.flames[d.targetFlameIdx].alive) {
          d.targetX = s.flames[d.targetFlameIdx].x;
          d.targetY = s.flames[d.targetFlameIdx].y;
        }
        const dx = d.targetX - d.x;
        const dy = d.targetY - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 15) {
          // Extinguish
          if (d.targetFlameIdx >= 0 && d.targetFlameIdx < s.flames.length) {
            s.flames[d.targetFlameIdx].alive = false;
          }
          s.score += 5;
          setDisplayScore(s.score);
          spawnParticles(d.x, d.y, 15, 34, 197, 94);
          sounds.splash();
          sounds.pop();
          haptics.impactFeedback();
          juice.shake(4, 0.15);
          juice.flash('#22C55E', 0.2);

          // Add bud to tree
          const budAngle = Math.random() * Math.PI * 2;
          const budDist = 20 + Math.random() * 60;
          s.treeBuds.push({
            x: cx + Math.cos(budAngle) * budDist,
            y: cy - 40 + Math.sin(budAngle) * budDist * 0.6,
            size: 0.5 + Math.random() * 1.5,
            color: Math.random() > 0.5 ? '#22C55E' : '#90EE90',
          });

          d.state = 'returning';
          d.returnX = cx + Math.cos(d.angle) * orbitR;
          d.returnY = cy + Math.sin(d.angle) * orbitR;
        } else {
          d.x += (dx / dist) * d.speed * delta;
          d.y += (dy / dist) * d.speed * delta;
        }
      } else if (d.state === 'returning') {
        const dx = d.returnX - d.x;
        const dy = d.returnY - d.y;
        const dist = Math.hypot(dx, dy);
        if (dist < 10) {
          d.state = 'orbiting';
        } else {
          d.x += (dx / dist) * d.speed * delta;
          d.y += (dy / dist) * d.speed * delta;
        }
      }
    }

    // Tree grows over time
    s.treeGrowTimer += delta;
    if (s.treeGrowTimer > 8 && s.treeDepth < 9) {
      s.treeGrowTimer = 0;
      s.treeDepth++;
      sounds.chime();
      haptics.comboFeedback(2);
    }

    // Damage flash decay
    s.damageFlash *= Math.pow(0.05, delta);

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    // Game over by time
    if (s.timeLeft <= 0 && phase === 'playing') {
      if (s.hp > 0) {
        sounds.success();
        haptics.successFeedback();
        juice.flash('#22C55E', 0.4);
      } else {
        sounds.fail();
        haptics.failFeedback();
        juice.flash('#FF0000', 0.5);
      }
      setPhase('ended');
      return;
    }

    // --- RENDER ---
    // Sky background
    const skyGrad = ctx.createLinearGradient(0, 0, 0, h);
    skyGrad.addColorStop(0, '#0A0F1C');
    skyGrad.addColorStop(0.5, '#1A1A3E');
    skyGrad.addColorStop(1, '#0D1B0E');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, h);

    // Apply shake transform
    ctx.save();
    juice.applyShake(ctx);

    // Damage flash overlay
    if (s.damageFlash > 0.01) {
      ctx.fillStyle = `rgba(255,0,0,${s.damageFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Draw tree
    const treeBaseY = cy + 60;
    const treeLen = Math.min(w, h) * 0.12;
    drawFractalTree(ctx, cx, treeBaseY, treeLen, -Math.PI / 2, 0, s.treeDepth, s.treeBuds);

    // Tree trunk base
    ctx.fillStyle = '#5C3D1E';
    ctx.fillRect(cx - 6, treeBaseY, 12, 30);

    // Glowing core with juice glow
    s.coreGlow = 0.5 + 0.5 * Math.sin(elapsed * 2);
    juice.drawGlow(ctx, cx, cy, 40, '#22C55E', 0.2 + s.coreGlow * 0.2);

    const coreGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, 25);
    coreGrad.addColorStop(0, `rgba(100,255,100,${0.3 + s.coreGlow * 0.3})`);
    coreGrad.addColorStop(1, 'rgba(0,100,0,0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.arc(cx, cy, 25, 0, Math.PI * 2);
    ctx.fill();

    // HP hearts
    for (let i = 0; i < TREE_HP; i++) {
      const hx = cx - 25 + i * 25;
      const hy = cy + 90;
      // Glow behind active hearts
      if (i < s.hp) {
        juice.drawGlow(ctx, hx, hy, 15, '#22C55E', 0.3);
      }
      ctx.save();
      ctx.translate(hx, hy);
      ctx.scale(0.8, 0.8);
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.bezierCurveTo(-7, -3, -10, -8, -5, -9);
      ctx.bezierCurveTo(0, -10, 0, -5, 0, -5);
      ctx.bezierCurveTo(0, -5, 0, -10, 5, -9);
      ctx.bezierCurveTo(10, -8, 7, -3, 0, 3);
      ctx.fillStyle = i < s.hp ? '#22C55E' : '#333';
      ctx.fill();
      ctx.restore();
    }

    // Draw flames with glow
    for (const f of s.flames) {
      if (!f.alive) continue;
      juice.drawGlow(ctx, f.x, f.y, f.size * 3, '#FF6600', 0.25);
      drawFlame(ctx, f.x, f.y, f.size, elapsed);
    }

    // Draw orbit ring (subtle)
    ctx.beginPath();
    ctx.arc(cx, cy, orbitR, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Draw defenders with glow
    for (let i = 0; i < s.defenders.length; i++) {
      const d = s.defenders[i];
      juice.drawGlow(ctx, d.x, d.y, 18, defenderColors[i], d.state === 'attacking' ? 0.5 : 0.2);
      drawBird(ctx, d.x, d.y, defenderColors[i]);
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

    // Restore from shake transform
    ctx.restore();

    // Draw juice flash overlay (after shake restore so it covers full screen)
    juice.drawFlash(ctx, w, h);

    // Score with neon text
    juice.drawNeonText(ctx, `Score: ${s.score}`, 80, 40, '#22C55E', 22);

    // Timer with neon text
    const timerColor = s.timeLeft < 5 ? '#FF4444' : '#FFFFFF';
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 40, 40, timerColor, 24);

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0; s.hp = TREE_HP; s.treeDepth = 5; s.treeBuds = [];
      s.flames = []; s.flameSpawnTimer = 0; s.treeGrowTimer = 0;
      s.damageFlash = 0; s.lastWarningTime = -1;
      for (let i = 0; i < s.defenders.length; i++) {
        s.defenders[i].state = 'orbiting';
        s.defenders[i].angle = (i / NUM_DEFENDERS) * Math.PI * 2;
      }
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop]);

  useEffect(() => { if (phase === 'ended') gameLoop.stop(); }, [phase, gameLoop]);
  useEffect(() => () => gameLoop.stop(), [gameLoop]);

  const isVictory = state.current.hp > 0;

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      {phase === 'ended' && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: isVictory ? '#22C55E' : '#FF4444',
            fontSize: 30,
            fontWeight: 'bold',
            marginBottom: 8,
            textShadow: isVictory
              ? '0 0 20px rgba(34,197,94,0.8), 0 0 40px rgba(34,197,94,0.4)'
              : '0 0 20px rgba(255,68,68,0.8), 0 0 40px rgba(255,68,68,0.4)',
            fontFamily: FONT_FAMILY,
          }}>
            {isVictory ? 'Tree Defended!' : 'Tree Fell...'}
          </div>
          <div style={{
            color: COLORS.mint,
            fontSize: 48,
            fontWeight: 'bold',
            marginBottom: 8,
            textShadow: '0 0 20px rgba(34,197,94,0.6), 0 0 40px rgba(34,197,94,0.3)',
            fontFamily: FONT_FAMILY,
          }}>{state.current.score}</div>
          <div style={{
            color: COLORS.gray,
            fontSize: 14,
            marginBottom: 24,
            fontFamily: FONT_FAMILY,
          }}>
            Heigig: sacred link between sky and earth
          </div>
          <button onClick={() => {
            haptics.tapFeedback();
            sounds.pop();
            onComplete(state.current.score);
          }} style={{
            background: 'linear-gradient(135deg, #22C55E, #16A34A)',
            color: '#FFFFFF',
            border: 'none',
            padding: '14px 40px',
            borderRadius: 12,
            fontSize: 18,
            fontWeight: 'bold',
            cursor: 'pointer',
            marginBottom: 12,
            boxShadow: '0 0 20px rgba(34,197,94,0.4), 0 4px 15px rgba(0,0,0,0.3)',
            textShadow: '0 1px 2px rgba(0,0,0,0.3)',
            fontFamily: FONT_FAMILY,
          }}>Continue</button>
          <button onClick={() => {
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
            color: COLORS.gray,
            border: '1px solid rgba(255,255,255,0.2)',
            padding: '10px 30px',
            borderRadius: 12,
            fontSize: 14,
            cursor: 'pointer',
            boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
            fontFamily: FONT_FAMILY,
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
        }}>Back</button>
      )}
    </div>
  );
}
