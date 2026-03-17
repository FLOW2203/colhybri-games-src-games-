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

const GAME_STRINGS = {
  courtshipDesc1: {
    fr: 'Les toucans se lancent des fruits', en: 'Toucans toss fruit as',
    es: 'Los tucanes lanzan fruta como', de: 'Tukane werfen Früchte als',
    el: 'Οι τουκάν ρίχνουν φρούτα ως', zh: '巨嘴鸟互扔水果作为',
    ja: 'オオハシは求愛の', hi: 'टूकन फल फेंकते हैं',
    pt: 'Os tucanos lançam frutas como', ru: 'Туканы бросают фрукты как',
  },
  courtshipDesc2: {
    fr: 'comme rituel de séduction !', en: 'a courtship ritual!',
    es: 'un ritual de cortejo!', de: 'Balzritual!',
    el: 'τελετή ερωτοτροπίας!', zh: '求偶仪式！',
    ja: '儀式として果物を投げます！', hi: 'प्रणय अनुष्ठान के रूप में!',
    pt: 'um ritual de acasalamento!', ru: 'брачный ритуал!',
  },
  swipeInstruction: {
    fr: 'Glissez pour lancer, tapez pour attraper !', en: 'Swipe to throw, tap to catch!',
    es: '¡Desliza para lanzar, toca para atrapar!', de: 'Wische zum Werfen, tippe zum Fangen!',
    el: 'Σύρετε για να ρίξετε, πατήστε για να πιάσετε!', zh: '滑动投掷，点击接住！',
    ja: 'スワイプで投げて、タップでキャッチ！', hi: 'फेंकने के लिए स्वाइप करें, पकड़ने के लिए टैप करें!',
    pt: 'Deslize para lançar, toque para apanhar!', ru: 'Свайпните, чтобы бросить, нажмите, чтобы поймать!',
  },
  tap: {
    fr: 'TAP !', en: 'TAP!',
    es: '¡TOCA!', de: 'TIPP!',
    el: 'ΠΑΤ!', zh: '点击！',
    ja: 'タップ！', hi: 'टैप!',
    pt: 'TOQUE!', ru: 'ЖМИ!',
  },
  catch: {
    fr: 'Attrapé !', en: 'Catch!',
    es: '¡Atrapado!', de: 'Gefangen!',
    el: 'Πιάστηκε!', zh: '接住了！',
    ja: 'キャッチ！', hi: 'पकड़ा!',
    pt: 'Apanhado!', ru: 'Поймано!',
  },
  exchangesCompleted: {
    fr: 'échanges réussis', en: 'exchanges completed',
    es: 'intercambios completados', de: 'Austausche abgeschlossen',
    el: 'ανταλλαγές ολοκληρώθηκαν', zh: '次交换完成',
    ja: '回の交換成功', hi: 'आदान-प्रदान पूरे',
    pt: 'trocas concluídas', ru: 'обменов завершено',
  },
  tossLoveFact: {
    fr: 'Les toucans se lancent des fruits par amour !', en: 'Toucans toss fruit to show love!',
    es: '¡Los tucanes lanzan fruta por amor!', de: 'Tukane werfen Früchte aus Liebe!',
    el: 'Οι τουκάν ρίχνουν φρούτα για αγάπη!', zh: '巨嘴鸟通过抛水果来表达爱意！',
    ja: 'オオハシは愛を示すためにフルーツを投げます！', hi: 'टूकन प्यार दिखाने के लिए फल फेंकते हैं!',
    pt: 'Os tucanos lançam frutas para mostrar amor!', ru: 'Туканы бросают фрукты, чтобы показать любовь!',
  },
  speed: {
    fr: 'Vitesse', en: 'Speed',
    es: 'Velocidad', de: 'Geschwindigkeit',
    el: 'Ταχύτητα', zh: '速度',
    ja: 'スピード', hi: 'गति',
    pt: 'Velocidade', ru: 'Скорость',
  },
};
const GAME_DURATION = 15;
const POOL_SIZE = 100;
const FRUIT_COLORS = [
  { fill: '#FF6B35', stroke: '#CC4400', name: 'orange' },
  { fill: '#FFD700', stroke: '#B8960F', name: 'banana' },
  { fill: '#FF4757', stroke: '#C0392B', name: 'berry' },
  { fill: '#7BED9F', stroke: '#2ECC71', name: 'lime' },
  { fill: '#E056A0', stroke: '#A0306A', name: 'dragonfruit' },
];

export default function GameLancerFruits({ onComplete, onBack }) {
  const canvasRef = useRef(null);
  const [phase, setPhase] = useState('ready');
  const [displayScore, setDisplayScore] = useState(0);

  const sounds = useSounds();
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

  const state = useRef({
    timeLeft: GAME_DURATION,
    score: 0,
    streak: 0,
    bestStreak: 0,
    fruit: {
      active: false,
      x: 0, y: 0,
      vx: 0, vy: 0,
      flying: false,
      returning: false,
      caught: false,
      waitingCatch: false,
      size: 20,
      colorIdx: 0,
      rotation: 0,
      flyProgress: 0,
      startX: 0, startY: 0, endX: 0, endY: 0,
    },
    speed: 1.0,
    canThrow: true,
    canCatch: false,
    catchWindow: false,
    catchTimer: 0,
    feedbackText: '',
    feedbackTimer: 0,
    particles: Array(POOL_SIZE).fill(null).map(() => ({
      active: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 0,
      r: 0, g: 0, b: 0, size: 0,
    })),
    trailParticles: Array(50).fill(null).map(() => ({
      active: false, x: 0, y: 0, life: 0, maxLife: 0, size: 0, r: 0, g: 0, b: 0,
    })),
    leftToucanBob: 0,
    rightToucanBob: 0,
    bgLeaves: Array(12).fill(null).map(() => ({
      x: Math.random() * 1000,
      y: Math.random() * 800,
      size: 10 + Math.random() * 20,
      angle: Math.random() * Math.PI * 2,
      speed: 5 + Math.random() * 15,
      rotSpeed: 0.5 + Math.random() * 2,
    })),
    missFlash: 0,
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
        const speed = 40 + Math.random() * 160;
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

  const spawnTrail = useCallback((x, y, r, g, b) => {
    const s = state.current;
    for (let i = 0; i < s.trailParticles.length; i++) {
      const p = s.trailParticles[i];
      if (!p.active) {
        p.active = true;
        p.x = x; p.y = y;
        p.life = 0.2 + Math.random() * 0.15;
        p.maxLife = p.life;
        p.size = 3 + Math.random() * 5;
        p.r = r; p.g = g; p.b = b;
        break;
      }
    }
  }, []);

  const setupFruit = useCallback((w, h) => {
    const s = state.current;
    const f = s.fruit;
    f.active = true;
    f.x = w * 0.18;
    f.y = h * 0.42;
    f.flying = false;
    f.returning = false;
    f.waitingCatch = false;
    f.caught = false;
    f.flyProgress = 0;
    f.colorIdx = Math.floor(Math.random() * FRUIT_COLORS.length);
    f.size = 16 + Math.min(8, s.streak * 1.5);
    f.rotation = 0;
    s.canThrow = true;
    s.canCatch = false;
    s.catchWindow = false;
    s.catchTimer = 0;
  }, []);

  const handleTap = useCallback(() => {
    if (phase !== 'playing') {
      if (phase === 'ready') {
        haptics.tapFeedback();
        sounds.pop();
        setPhase('playing');
      }
      return;
    }
    const s = state.current;
    const f = s.fruit;
    const w = window.innerWidth;
    const h = window.innerHeight;

    if (s.canCatch && f.waitingCatch) {
      // Catch the returning fruit
      f.waitingCatch = false;
      f.caught = true;
      s.canCatch = false;
      s.score++;
      s.streak++;
      if (s.streak > s.bestStreak) s.bestStreak = s.streak;
      s.speed = Math.min(3.0, 1.0 + s.streak * 0.15);
      s.feedbackText = s.streak > 3 ? `${t(UI_STRINGS.streak)} ${s.streak}!` : t(GAME_STRINGS.catch);
      s.feedbackTimer = 0.5;
      spawnParticles(f.x, f.y, 10, 46, 234, 163);
      sounds.chime();
      haptics.impactFeedback();
      juice.flash('#2EEAA3', 0.3);
      if (s.streak > 3) {
        sounds.combo(s.streak);
        haptics.comboFeedback(Math.min(s.streak, 5));
      }
      setDisplayScore(s.score);

      // Setup next throw after brief delay
      setTimeout(() => setupFruit(w, h), 250);
      return;
    }

    if (s.canThrow && f.active && !f.flying && !f.returning) {
      // Throw fruit to right toucan
      f.flying = true;
      f.startX = f.x;
      f.startY = f.y;
      f.endX = w * 0.82;
      f.endY = h * 0.42;
      f.flyProgress = 0;
      s.canThrow = false;
      sounds.whoosh();
      haptics.tapFeedback();
    }
  }, [phase, sounds, haptics, juice, spawnParticles, setupFruit]);

  const handleSwipe = useCallback((direction) => {
    if (phase !== 'playing') return;
    if (direction === 'right') {
      const s = state.current;
      const f = s.fruit;
      const w = window.innerWidth;
      const h = window.innerHeight;
      if (s.canThrow && f.active && !f.flying && !f.returning) {
        f.flying = true;
        f.startX = f.x;
        f.startY = f.y;
        f.endX = w * 0.82;
        f.endY = h * 0.42;
        f.flyProgress = 0;
        s.canThrow = false;
        sounds.whoosh();
        haptics.tapFeedback();
      }
    }
  }, [phase, sounds, haptics]);

  useTouch(canvasRef, { onTap: handleTap, onSwipe: handleSwipe });

  const drawToucan = useCallback((ctx, x, y, facing, bob, beakColor) => {
    ctx.save();
    ctx.translate(x, y + Math.sin(bob) * 5);
    const dir = facing === 'right' ? 1 : -1;
    ctx.scale(dir, 1);

    // Body
    ctx.beginPath();
    ctx.ellipse(0, 0, 22, 30, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // White chest
    ctx.beginPath();
    ctx.ellipse(5, 8, 14, 18, 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#f0f0e0';
    ctx.fill();

    // Head
    ctx.beginPath();
    ctx.arc(8, -25, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // Eye ring
    ctx.beginPath();
    ctx.arc(14, -27, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#87ceeb';
    ctx.fill();
    // Eye
    ctx.beginPath();
    ctx.arc(15, -27, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(15.5, -28, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    // Beak
    ctx.beginPath();
    ctx.moveTo(20, -25);
    ctx.quadraticCurveTo(55, -30, 60, -20);
    ctx.quadraticCurveTo(55, -12, 20, -18);
    ctx.closePath();
    const beakGrad = ctx.createLinearGradient(20, -30, 60, -15);
    beakGrad.addColorStop(0, beakColor);
    beakGrad.addColorStop(0.5, '#FFD700');
    beakGrad.addColorStop(1, '#FF6B35');
    ctx.fillStyle = beakGrad;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Beak line
    ctx.beginPath();
    ctx.moveTo(22, -21);
    ctx.lineTo(55, -21);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Tail
    ctx.beginPath();
    ctx.moveTo(-15, 20);
    ctx.lineTo(-28, 40);
    ctx.lineTo(-18, 38);
    ctx.lineTo(-22, 48);
    ctx.lineTo(-10, 35);
    ctx.closePath();
    ctx.fillStyle = '#e74c3c';
    ctx.fill();

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
    const cy = h / 2;

    // Update juice effects each frame
    juice.update(delta);

    if (phase === 'ready') {
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#0b3d0b');
      bgGrad.addColorStop(0.6, '#1a5c1a');
      bgGrad.addColorStop(1, '#0d2a0d');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // Glow behind toucans on ready screen
      juice.drawGlow(ctx, w * 0.2, cy, 80, '#FF6B35', 0.2);
      juice.drawGlow(ctx, w * 0.8, cy, 80, '#e74c3c', 0.2);

      drawToucan(ctx, w * 0.2, cy, 'right', elapsed * 2, '#FF6B35');
      drawToucan(ctx, w * 0.8, cy, 'left', elapsed * 2 + 1, '#e74c3c');

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['19']), cx, cy - 80, COLORS.mint, 28);

      ctx.font = `18px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gold;
      ctx.fillText(t(GAME_STRINGS.courtshipDesc1), cx, cy - 40);
      ctx.fillText(t(GAME_STRINGS.courtshipDesc2), cx, cy - 16);
      ctx.font = `16px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText(t(GAME_STRINGS.swipeInstruction), cx, cy + 80);

      // Pulsing neon "TAP TO START"
      const tapAlpha = 0.5 + Math.sin(elapsed * 4) * 0.5;
      ctx.save();
      ctx.globalAlpha = tapAlpha;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart), cx, cy + 130, COLORS.gold, 20);
      ctx.restore();

      ctx.restore();
      return;
    }

    // Update time
    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    s.leftToucanBob = elapsed * 2.5;
    s.rightToucanBob = elapsed * 2.5 + 1;

    // Low time warning haptic
    if (s.timeLeft <= 3 && s.timeLeft > 0 && Math.floor(s.timeLeft * 2) !== Math.floor((s.timeLeft + delta) * 2)) {
      haptics.warningFeedback();
    }

    const f = s.fruit;

    // Flying to right toucan
    if (f.flying && !f.returning) {
      f.flyProgress += delta * (2.5 * s.speed);
      const p = Math.min(1, f.flyProgress);
      const ease = 1 - Math.pow(1 - p, 3);
      f.x = f.startX + (f.endX - f.startX) * ease;
      const arc = -100 * Math.sin(p * Math.PI);
      f.y = f.startY + (f.endY - f.startY) * ease + arc;
      f.rotation += delta * 8 * s.speed;

      const fc = FRUIT_COLORS[f.colorIdx];
      const rgb = hexToRgb(fc.fill);
      spawnTrail(f.x, f.y, rgb.r, rgb.g, rgb.b);

      if (p >= 1) {
        // Right toucan catches, then throws back
        f.flying = false;
        spawnParticles(f.endX, f.endY, 8, 245, 166, 35);
        sounds.tick();
        haptics.tapFeedback();
        juice.shake(4, 0.15);

        // Auto-return after short delay
        setTimeout(() => {
          if (phase !== 'playing') return;
          f.returning = true;
          f.flyProgress = 0;
          f.startX = w * 0.82;
          f.startY = h * 0.42;
          f.endX = w * 0.18;
          f.endY = h * 0.42;
          s.canCatch = true;
          f.waitingCatch = true;
          s.catchTimer = 0;
          sounds.whoosh();
        }, 300 / s.speed);
      }
    }

    // Returning fruit
    if (f.returning) {
      f.flyProgress += delta * (2.5 * s.speed);
      const p = Math.min(1, f.flyProgress);
      const ease = 1 - Math.pow(1 - p, 3);
      f.x = f.startX + (f.endX - f.startX) * ease;
      const arc = -100 * Math.sin(p * Math.PI);
      f.y = f.startY + (f.endY - f.startY) * ease + arc;
      f.rotation -= delta * 8 * s.speed;

      const fc = FRUIT_COLORS[f.colorIdx];
      const rgb = hexToRgb(fc.fill);
      spawnTrail(f.x, f.y, rgb.r, rgb.g, rgb.b);

      s.catchTimer += delta;

      if (p >= 1 && !f.caught) {
        // Missed catch
        f.returning = false;
        f.active = false;
        s.streak = 0;
        s.speed = Math.max(1.0, s.speed - 0.2);
        s.feedbackText = t(UI_STRINGS.miss);
        s.feedbackTimer = 0.6;
        s.missFlash = 0.3;
        s.canCatch = false;

        // Juice: shake + red flash + fail sound + haptic
        juice.shake(10, 0.3);
        juice.flash('#EF4444', 0.4);
        sounds.fail();
        haptics.failFeedback();

        setTimeout(() => setupFruit(w, h), 400);
      }
    }

    // Miss flash
    if (s.missFlash > 0) s.missFlash -= delta;

    // Update particles
    for (const p of s.particles) {
      if (!p.active) continue;
      p.x += p.vx * delta;
      p.y += p.vy * delta;
      p.vy += 80 * delta;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      p.life -= delta;
      if (p.life <= 0) p.active = false;
    }

    if (s.feedbackTimer > 0) s.feedbackTimer -= delta;

    // Leaves
    for (const leaf of s.bgLeaves) {
      leaf.y += leaf.speed * delta;
      leaf.x += Math.sin(elapsed + leaf.angle) * 10 * delta;
      leaf.angle += leaf.rotSpeed * delta;
      if (leaf.y > h + 30) {
        leaf.y = -30;
        leaf.x = Math.random() * w;
      }
    }

    // Game over
    if (s.timeLeft <= 0 && phase === 'playing') {
      setPhase('ended');
      setDisplayScore(s.score);
      sounds.success();
      haptics.successFeedback();
      juice.shake(6, 0.4);
      juice.flash('#FFD700', 0.5);
      return;
    }

    // --- RENDER ---
    // Apply shake before drawing
    juice.applyShake(ctx);

    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#0b3d0b');
    bgGrad.addColorStop(0.4, '#1a5c1a');
    bgGrad.addColorStop(0.8, '#0d3a0d');
    bgGrad.addColorStop(1, '#0a2a0a');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    // Falling leaves
    for (const leaf of s.bgLeaves) {
      ctx.save();
      ctx.translate(leaf.x, leaf.y);
      ctx.rotate(leaf.angle);
      ctx.beginPath();
      ctx.ellipse(0, 0, leaf.size, leaf.size * 0.4, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34,139,34,0.15)';
      ctx.fill();
      ctx.restore();
    }

    // Miss flash (original)
    if (s.missFlash > 0) {
      ctx.fillStyle = `rgba(239,68,68,${s.missFlash * 0.3})`;
      ctx.fillRect(0, 0, w, h);
    }

    // Juice flash overlay
    juice.drawFlash(ctx, w, h);

    // Branches
    ctx.strokeStyle = '#5a3a1a';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.moveTo(0, cy + 40);
    ctx.quadraticCurveTo(w * 0.15, cy + 30, w * 0.3, cy + 45);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(w, cy + 40);
    ctx.quadraticCurveTo(w * 0.85, cy + 30, w * 0.7, cy + 45);
    ctx.stroke();

    // Glow behind toucans
    juice.drawGlow(ctx, w * 0.15, cy, 60, '#FF6B35', 0.15);
    juice.drawGlow(ctx, w * 0.85, cy, 60, '#e74c3c', 0.15);

    // Toucans
    drawToucan(ctx, w * 0.15, cy, 'right', s.leftToucanBob, '#FF6B35');
    drawToucan(ctx, w * 0.85, cy, 'left', s.rightToucanBob, '#e74c3c');

    // Catch indicator
    if (s.canCatch && f.waitingCatch) {
      const indicatorAlpha = 0.5 + Math.sin(elapsed * 12) * 0.5;
      // Glow pulse around catch zone
      juice.drawGlow(ctx, w * 0.18, h * 0.42, 50, '#2EEAA3', indicatorAlpha * 0.3);
      ctx.beginPath();
      ctx.arc(w * 0.18, h * 0.42, 35, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(46,234,163,${indicatorAlpha})`;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.font = `bold 14px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = `rgba(46,234,163,${indicatorAlpha})`;
      ctx.fillText(t(GAME_STRINGS.tap), w * 0.18, h * 0.42 + 50);
    }

    // Trail particles with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of s.trailParticles) {
      if (!p.active) continue;
      const alpha = (p.life / p.maxLife) * 0.6;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * (p.life / p.maxLife), 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${p.r},${p.g},${p.b},${alpha})`;
      ctx.fill();
    }
    ctx.restore();

    // Draw fruit
    if (f.active) {
      const fc = FRUIT_COLORS[f.colorIdx];
      ctx.save();
      ctx.translate(f.x, f.y);
      ctx.rotate(f.rotation);

      // Glow behind fruit using juice
      juice.drawGlow(ctx, 0, 0, f.size * 2.5, fc.fill, 0.35);

      // Fruit body
      ctx.beginPath();
      ctx.arc(0, 0, f.size, 0, Math.PI * 2);
      const fruitGrad = ctx.createRadialGradient(-f.size * 0.3, -f.size * 0.3, 0, 0, 0, f.size);
      fruitGrad.addColorStop(0, '#fff');
      fruitGrad.addColorStop(0.3, fc.fill);
      fruitGrad.addColorStop(1, fc.stroke);
      ctx.fillStyle = fruitGrad;
      ctx.fill();

      // Stem
      ctx.beginPath();
      ctx.moveTo(0, -f.size);
      ctx.lineTo(2, -f.size - 6);
      ctx.strokeStyle = '#4a2a0a';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Leaf on stem
      ctx.beginPath();
      ctx.ellipse(5, -f.size - 4, 5, 3, 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#228B22';
      ctx.fill();

      ctx.restore();
    }

    // Burst particles with additive blending
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

    // Speed indicator - neon text
    if (s.speed > 1.1) {
      juice.drawNeonText(ctx, `${t(GAME_STRINGS.speed)} x${s.speed.toFixed(1)}`, cx, 80, COLORS.gold, 18);
    }

    // Streak - neon text
    if (s.streak > 1) {
      juice.drawNeonText(ctx, `${t(UI_STRINGS.streak)}: ${s.streak}`, cx, 110, COLORS.mint, 22);
    }

    // Feedback
    if (s.feedbackTimer > 0) {
      const alpha = Math.min(1, s.feedbackTimer * 2);
      ctx.save();
      ctx.globalAlpha = alpha;
      const feedbackColor = s.feedbackText === t(UI_STRINGS.miss) ? COLORS.red : COLORS.mint;
      juice.drawNeonText(ctx, s.feedbackText, cx, cy - 60, feedbackColor, 30);
      ctx.restore();
    }

    // Timer bar
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(0, 0, w, 4);
    const timerFrac = s.timeLeft / GAME_DURATION;
    const timerColor = s.timeLeft < 3 ? COLORS.red : COLORS.green;
    ctx.fillStyle = timerColor;
    ctx.fillRect(0, 0, w * timerFrac, 4);
    // Glow on timer bar edge
    if (timerFrac > 0.01) {
      juice.drawGlow(ctx, w * timerFrac, 2, 15, timerColor, 0.4);
    }

    // Timer + score - neon text
    ctx.save();
    ctx.font = `bold 24px ${FONT_FAMILY}`;
    ctx.textAlign = 'right';
    ctx.shadowColor = s.timeLeft < 3 ? COLORS.red : COLORS.white;
    ctx.shadowBlur = 10;
    ctx.fillStyle = s.timeLeft < 3 ? COLORS.red : COLORS.white;
    ctx.fillText(`${Math.ceil(s.timeLeft)}s`, w - 20, 40);
    ctx.textAlign = 'left';
    ctx.shadowColor = COLORS.mint;
    ctx.fillStyle = COLORS.white;
    ctx.fillText(`${t(UI_STRINGS.score)}: ${s.score}`, 20, 40);
    ctx.restore();

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnParticles, spawnTrail, setupFruit, drawToucan]));

  useEffect(() => {
    if (phase === 'ready') gameLoop.start();
  }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0;
      s.streak = 0;
      s.bestStreak = 0;
      s.speed = 1.0;
      s.timeLeft = GAME_DURATION;
      setupFruit(window.innerWidth, window.innerHeight);
      gameLoop.reset();
      gameLoop.start();
    }
  }, [phase, gameLoop, setupFruit]);

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
          background: 'rgba(0,0,0,0.75)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 12,
            textShadow: `0 0 20px ${COLORS.gold}, 0 0 40px ${COLORS.gold}`,
          }}>Time's Up!</div>
          <div style={{
            color: COLORS.green, fontSize: 48, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 20px ${COLORS.green}, 0 0 40px ${COLORS.green}80`,
          }}>{displayScore}</div>
          <div style={{ color: COLORS.gray, fontSize: 16, marginBottom: 4 }}>exchanges completed</div>
          <div style={{
            color: COLORS.gold, fontSize: 14, marginBottom: 4,
            textShadow: `0 0 10px ${COLORS.gold}80`,
          }}>Best Streak: {state.current.bestStreak}</div>
          <div style={{ color: COLORS.gray, fontSize: 14, marginBottom: 24 }}>
            Toucans toss fruit to show love!
          </div>
          <button onClick={() => {
            sounds.pop();
            haptics.tapFeedback();
            onComplete(state.current.score);
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.green}, ${COLORS.mint})`,
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            boxShadow: `0 0 20px ${COLORS.green}60, 0 4px 15px rgba(0,0,0,0.3)`,
          }}>Continue</button>
          <button onClick={() => {
            sounds.pop();
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.05)',
            color: COLORS.gray,
            border: `1px solid ${COLORS.gray}50`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }}>Back</button>
        </div>
      )}
      {phase !== 'ended' && (
        <button onClick={() => {
          sounds.pop();
          haptics.tapFeedback();
          onBack();
        }} style={{
          position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.1)',
          color: COLORS.white, border: 'none', borderRadius: 8, padding: '8px 16px',
          fontSize: 14, cursor: 'pointer', zIndex: 10,
          fontFamily: FONT_FAMILY,
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>Back</button>
      )}
    </div>
  );
}

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : { r: 255, g: 255, b: 255 };
}
