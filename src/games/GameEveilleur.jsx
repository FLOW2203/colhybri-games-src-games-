import React, { useRef, useState, useCallback, useEffect } from 'react';
import useGameLoop from './engine/useGameLoop';
import useTouch from './engine/useTouch';
import useSounds from './engine/useSounds';
import useHaptics from './engine/useHaptics';
import useJuice from './engine/useJuice';
import { COLORS } from './engine/constants';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';

// Game-specific translation objects
const STRINGS_EVEILLEUR = {
  subtitle1: {
    fr: "L'individu déclenche", en: 'The individual triggers', es: 'El individuo desencadena', de: 'Das Individuum löst aus',
    el: 'Το άτομο πυροδοτεί', zh: '个体触发', ja: '個が引き起こす', hi: 'व्यक्ति प्रेरित करता है', pt: 'O indivíduo desencadeia', ru: 'Индивид запускает',
  },
  subtitle2: {
    fr: 'le collectif !', en: 'the collective!', es: '¡lo colectivo!', de: 'das Kollektiv!',
    el: 'το συλλογικό!', zh: '集体！', ja: '集団を！', hi: 'सामूहिक को!', pt: 'o coletivo!', ru: 'коллектив!',
  },
  phase1Hint: {
    fr: 'Phase 1 : Gouttes du colibri solo', en: 'Phase 1: Solo hummingbird drops', es: 'Fase 1: Gotas del colibrí solo', de: 'Phase 1: Solo-Kolibri-Tropfen',
    el: 'Φάση 1: Σταγόνες κολιμπρί σόλο', zh: '第1阶段：蜂鸟独自滴水', ja: 'フェーズ1：ハチドリソロドロップ', hi: 'चरण 1: अकेली हमिंगबर्ड की बूंदें', pt: 'Fase 1: Gotas do beija-flor solo', ru: 'Фаза 1: Капли одинокого колибри',
  },
  phase2Hint: {
    fr: 'Phase 2 : Les oiseaux rejoignent, le multiplicateur grandit', en: 'Phase 2: Birds join, multiplier grows', es: 'Fase 2: Las aves se unen, el multiplicador crece', de: 'Phase 2: Vögel schließen sich an, Multiplikator wächst',
    el: 'Φάση 2: Πουλιά ενώνονται, ο πολλαπλασιαστής αυξάνεται', zh: '第2阶段：鸟群加入，乘数增长', ja: 'フェーズ2：鳥が合流、倍率アップ', hi: 'चरण 2: पक्षी जुड़ते हैं, गुणक बढ़ता है', pt: 'Fase 2: Aves juntam-se, multiplicador cresce', ru: 'Фаза 2: Птицы присоединяются, множитель растёт',
  },
  phase3Hint: {
    fr: 'Phase 3 : Cascade de pélicans !', en: 'Phase 3: Pelican frenzy cascade!', es: 'Fase 3: ¡Cascada de pelícanos!', de: 'Phase 3: Pelikan-Kaskade!',
    el: 'Φάση 3: Καταρράκτης πελεκάνων!', zh: '第3阶段：鹈鹕狂潮级联！', ja: 'フェーズ3：ペリカンカスケード！', hi: 'चरण 3: पेलिकन कैस्केड!', pt: 'Fase 3: Cascata de pelicanos!', ru: 'Фаза 3: Каскад пеликанов!',
  },
  tapToSendDrops: {
    fr: 'TAPEZ pour envoyer des gouttes !', en: 'TAP to send water drops!', es: '¡TOCA para enviar gotas!', de: 'TIPPE um Tropfen zu senden!',
    el: 'ΠΑΤΗΣΤΕ για σταγόνες!', zh: '点击发送水滴！', ja: 'タップして水滴を送れ！', hi: 'बूंदें भेजने के लिए टैप करें!', pt: 'TOQUE para enviar gotas!', ru: 'НАЖМИТЕ, чтобы послать капли!',
  },
  solo: {
    fr: 'SOLO', en: 'SOLO', es: 'SOLO', de: 'SOLO', el: 'ΣΟΛΟ',
    zh: '独奏', ja: 'ソロ', hi: 'सोलो', pt: 'SOLO', ru: 'СОЛО',
  },
  formation: {
    fr: 'FORMATION', en: 'FORMATION', es: 'FORMACIÓN', de: 'FORMATION', el: 'ΣΧΗΜΑΤΙΣΜΟΣ',
    zh: '编队', ja: 'フォーメーション', hi: 'फॉर्मेशन', pt: 'FORMAÇÃO', ru: 'ФОРМАЦИЯ',
  },
  pelicanCascade: {
    fr: 'CASCADE PÉLICAN', en: 'PELICAN CASCADE', es: 'CASCADA PELÍCANO', de: 'PELIKAN-KASKADE', el: 'ΚΑΤΑΡΡΑΚΤΗΣ ΠΕΛΕΚΑΝΩΝ',
    zh: '鹈鹕级联', ja: 'ペリカンカスケード', hi: 'पेलिकन कैस्केड', pt: 'CASCATA PELICANO', ru: 'КАСКАД ПЕЛИКАНОВ',
  },
  drops: {
    fr: 'Gouttes', en: 'Drops', es: 'Gotas', de: 'Tropfen', el: 'Σταγόνες',
    zh: '水滴', ja: 'ドロップ', hi: 'बूंदें', pt: 'Gotas', ru: 'Капли',
  },
  collectiveAwakens: {
    fr: 'Le Collectif S\'Éveille !', en: 'The Collective Awakens!', es: '¡El Colectivo Despierta!', de: 'Das Kollektiv Erwacht!', el: 'Το Συλλογικό Ξυπνά!',
    zh: '集体觉醒！', ja: '集団が目覚める！', hi: 'सामूहिक जाग उठा!', pt: 'O Coletivo Desperta!', ru: 'Коллектив Пробуждается!',
  },
  totalDrops: {
    fr: 'Total de gouttes', en: 'Total drops', es: 'Total de gotas', de: 'Tropfen gesamt', el: 'Σύνολο σταγόνων',
    zh: '总水滴数', ja: '合計ドロップ', hi: 'कुल बूंदें', pt: 'Total de gotas', ru: 'Всего капель',
  },
  fireReduced: {
    fr: 'Feu réduit à', en: 'Fire reduced to', es: 'Fuego reducido a', de: 'Feuer reduziert auf', el: 'Φωτιά μειώθηκε σε',
    zh: '火焰减少到', ja: '火を抑制', hi: 'आग कम हुई', pt: 'Fogo reduzido a', ru: 'Огонь уменьшен до',
  },
  oneSparkIgnites: {
    fr: 'Une étincelle enflamme le collectif !', en: 'One spark ignites the collective!', es: '¡Una chispa enciende lo colectivo!', de: 'Ein Funke entfacht das Kollektiv!', el: 'Ένας σπινθήρας ανάβει το συλλογικό!',
    zh: '一个火花点燃集体！', ja: '一つの火花が集団に火をつける！', hi: 'एक चिंगारी सामूहिक को जगाती है!', pt: 'Uma faísca acende o coletivo!', ru: 'Одна искра зажигает коллектив!',
  },
};

const GAME_DURATION = 30;
const POOL_SIZE = 200;
const PELICAN_COUNT = 7;
const FONT_FAMILY = "'Outfit', 'DM Sans', sans-serif";

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
  const haptics = useHaptics();
  const juice = useJuice();
  const { t } = useLocale();

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
    lastWarningTime: 0,
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
    if (phase === 'ready') {
      setPhase('playing');
      sounds.countdown(true);
      haptics.tapFeedback();
      return;
    }
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
      sounds.impact();
      haptics.heavyFeedback();
      juice.shake(12, 0.4);
      juice.flash('#00BFFF', 0.3);
      s.epicShake = 0.3;
    } else if (s.gamePhase <= 2) {
      // Drop from all active birds
      for (let i = 0; i < s.activeBirds; i++) {
        const bp = s.birdPositions[i];
        spawnDrop(bp.x, bp.y + 10);
        spawnParticles(bp.x, bp.y + 10, 2, 0, 191, 255);
      }
      s.totalDrops += s.activeBirds;
      s.score += s.activeBirds;
      sounds.drop();
      haptics.tapFeedback();

      if (s.activeBirds > 1) {
        sounds.combo(s.activeBirds);
        haptics.comboFeedback(s.activeBirds);
      }
    }

    setDisplayScore(s.score);
  }, [phase, sounds, haptics, juice, spawnDrop, spawnParticles]);

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

    // Update juice system
    juice.update(delta);

    if (phase === 'ready') {
      ctx.fillStyle = '#1A0A00';
      ctx.fillRect(0, 0, w, h);

      // Neon title
      juice.drawNeonText(ctx, t(GAME_NAMES['26']), w / 2, h / 2 - 80, COLORS.mint, 28);

      // Glow behind title
      juice.drawGlow(ctx, w / 2, h / 2 - 80, 80, COLORS.mint, 0.15);

      ctx.font = `15px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.mint;
      ctx.fillText(t(STRINGS_EVEILLEUR.subtitle1), w / 2, h / 2 - 30);
      ctx.fillText(t(STRINGS_EVEILLEUR.subtitle2), w / 2, h / 2 - 8);
      ctx.font = `13px ${FONT_FAMILY}`;
      ctx.fillStyle = COLORS.gray;
      ctx.fillText(t(STRINGS_EVEILLEUR.phase1Hint), w / 2, h / 2 + 30);
      ctx.fillText(t(STRINGS_EVEILLEUR.phase2Hint), w / 2, h / 2 + 50);
      ctx.fillText(t(STRINGS_EVEILLEUR.phase3Hint), w / 2, h / 2 + 70);

      // Pulsing TAP TO START with neon
      const pulse = 0.7 + Math.sin(elapsed * 3) * 0.3;
      ctx.globalAlpha = pulse;
      juice.drawNeonText(ctx, t(UI_STRINGS.tapToStart).toUpperCase(), w / 2, h / 2 + 120, COLORS.white, 20);
      ctx.globalAlpha = 1;

      ctx.restore();
      return;
    }

    s.timeLeft = Math.max(0, GAME_DURATION - elapsed);
    setDisplayTime(Math.ceil(s.timeLeft));

    // Low time warning haptic
    if (s.timeLeft < 8 && s.timeLeft > 0) {
      const timeInt = Math.ceil(s.timeLeft);
      if (timeInt !== s.lastWarningTime && timeInt <= 5) {
        s.lastWarningTime = timeInt;
        haptics.warningFeedback();
        sounds.countdown(timeInt === 1);
      }
    }

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
      sounds.powerup();
      haptics.impactFeedback();
      juice.shake(6, 0.2);
      juice.flash(BIRDS[idx].color, 0.25);
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
        sounds.pop();
        haptics.tapFeedback();
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
      sounds.success();
      haptics.successFeedback();
      juice.flash('#22C55E', 0.5);
      return;
    }

    // --- RENDER ---
    // Apply both the original epicShake and juice shake
    ctx.save();
    juice.applyShake(ctx);
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

    // Juice screen flash overlay
    juice.drawFlash(ctx, w, h);

    // Fire zone at bottom
    const fireBaseY = h * (1 - 0.25 * s.fireHeight);
    if (s.fireHeight > 0.05) {
      const fh = h * 0.25 * s.fireHeight;

      // Fire glow effect at bottom
      juice.drawGlow(ctx, cx, h, fh * 1.5, '#FF4500', 0.2 * s.fireHeight);

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

    // Fire embers with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of s.fireEmbers) {
      if (!e.active) continue;
      const alpha = Math.min(1, e.life * 0.8);
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,${Math.floor(100 + Math.random() * 80)},0,${alpha * 0.6})`;
      ctx.fill();
    }
    ctx.restore();

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

        // Glow around pelicans
        juice.drawGlow(ctx, pp.x, pp.y, 25, '#F5F5DC', 0.15);

        drawPelican(ctx, pp.x, pp.y, elapsed, pp.flashTimer > 0);
        if (pp.cascadeTimer > 0) {
          // Cascade ring effect
          const ringSize = (0.4 - pp.cascadeTimer) * 60;
          ctx.beginPath();
          ctx.arc(pp.x, pp.y, ringSize, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(0,191,255,${pp.cascadeTimer})`;
          ctx.lineWidth = 2;
          ctx.stroke();

          // Additional glow on cascade
          juice.drawGlow(ctx, pp.x, pp.y, ringSize + 10, '#00BFFF', pp.cascadeTimer * 0.4);
        }
      }
    }

    // Draw birds with glow
    for (let i = 0; i < s.activeBirds; i++) {
      const bp = s.birdPositions[i];
      const bird = BIRDS[i];
      const entranceScale = bp.entranceTimer > 0 ? 1 + bp.entranceTimer * 2 : 1;

      // Glow around birds
      juice.drawGlow(ctx, bp.x, bp.y, bird.size * 2.5, bird.color, 0.2);

      drawBird(ctx, bp.x, bp.y, bird, elapsed, entranceScale);

      // Extra entrance glow
      if (bp.entranceTimer > 0) {
        juice.drawGlow(ctx, bp.x, bp.y, bird.size * 4, bird.color, bp.entranceTimer * 0.5);
      }
    }

    // Water drops with additive blending
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
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
    ctx.restore();

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

    // Join animations with neon text
    for (const ja of s.joinAnimations) {
      const bird = BIRDS[ja.birdIndex];
      ctx.globalAlpha = Math.min(1, ja.timer);
      const yOff = (1.5 - ja.timer) * 30;
      juice.drawNeonText(ctx, `+ ${bird.name}!`, cx, h * 0.55 - yOff, bird.color, 20);
      ctx.globalAlpha = 1;
    }

    ctx.restore(); // shake

    // Phase indicator with neon text
    const phaseNum = s.gamePhase;
    let phaseLabel, phaseCol;
    if (phaseNum === 1) {
      phaseLabel = t(STRINGS_EVEILLEUR.solo);
      phaseCol = COLORS.mint;
    } else if (phaseNum === 2) {
      phaseLabel = `${t(STRINGS_EVEILLEUR.formation)} x${s.activeBirds}`;
      phaseCol = COLORS.cyan;
    } else {
      phaseLabel = `${t(STRINGS_EVEILLEUR.pelicanCascade)} x${PELICAN_COUNT * 3 + s.activeBirds}`;
      phaseCol = COLORS.gold;
    }
    juice.drawNeonText(ctx, phaseLabel, cx, 72, phaseCol, 14);

    // Total drops with neon
    juice.drawNeonText(ctx, `${t(STRINGS_EVEILLEUR.drops)}: ${s.totalDrops}`, cx, 90, COLORS.water, 13);

    // Score with neon glow
    juice.drawGlow(ctx, cx, 36, 30, COLORS.white, 0.1);
    juice.drawNeonText(ctx, `${s.score}`, cx, 42, COLORS.white, 28);

    // Timer with neon
    ctx.save();
    ctx.textAlign = 'right';
    const timerColor = s.timeLeft < 8 ? COLORS.red : COLORS.white;
    juice.drawNeonText(ctx, `${Math.ceil(s.timeLeft)}s`, w - 20, 40, timerColor, 22);
    // Glow on low time
    if (s.timeLeft < 8) {
      juice.drawGlow(ctx, w - 30, 36, 25, COLORS.red, 0.2 + Math.sin(elapsed * 6) * 0.1);
    }
    ctx.restore();

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

    // Glow dot at current progress position
    const progressX = barX + barW * (elapsed / GAME_DURATION);
    juice.drawGlow(ctx, progressX, barY + 3, 8, phaseCol, 0.4);

    // Hint text in phase 1
    if (s.gamePhase === 1 && elapsed < 3) {
      ctx.font = `14px ${FONT_FAMILY}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = COLORS.gray;
      ctx.fillText(t(STRINGS_EVEILLEUR.tapToSendDrops), cx, h * 0.65);
    }

    ctx.restore();
  }, [phase, sounds, haptics, juice, spawnDrop, spawnParticles, t]));

  useEffect(() => { if (phase === 'ready') gameLoop.start(); }, [phase, gameLoop]);

  useEffect(() => {
    if (phase === 'playing') {
      const s = state.current;
      s.score = 0; s.totalDrops = 0; s.activeBirds = 1; s.gamePhase = 1;
      s.pelicanActive = false; s.fireHeight = 1.0; s.joinAnimations = [];
      s.cascadeQueue = []; s.lastNewBirdCount = 1; s.tapPulse = 0; s.epicShake = 0;
      s.skyColorR = 80; s.skyColorG = 40; s.skyColorB = 10;
      s.lastWarningTime = 0;
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
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          fontFamily: FONT_FAMILY,
        }}>
          <div style={{
            color: COLORS.white, fontSize: 28, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 20px ${COLORS.mint}, 0 0 40px ${COLORS.mint}80`,
          }}>{t(STRINGS_EVEILLEUR.collectiveAwakens)}</div>
          <div style={{
            color: COLORS.cyan, fontSize: 48, fontWeight: 'bold', marginBottom: 8,
            textShadow: `0 0 30px ${COLORS.cyan}, 0 0 60px ${COLORS.cyan}80`,
          }}>{state.current.score}</div>
          <div style={{
            color: COLORS.gray, fontSize: 15, marginBottom: 4,
            textShadow: '0 0 8px rgba(255,255,255,0.3)',
          }}>
            {t(STRINGS_EVEILLEUR.totalDrops)}: {state.current.totalDrops}
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 15, marginBottom: 4,
            textShadow: '0 0 8px rgba(255,255,255,0.3)',
          }}>
            {t(STRINGS_EVEILLEUR.fireReduced)} {Math.floor(state.current.fireHeight * 100)}%
          </div>
          <div style={{
            color: COLORS.gray, fontSize: 13, marginBottom: 24,
            textShadow: '0 0 8px rgba(255,255,255,0.2)',
          }}>
            {t(STRINGS_EVEILLEUR.oneSparkIgnites)}
          </div>
          <button onClick={() => {
            sounds.pop();
            haptics.tapFeedback();
            onComplete(state.current.score);
          }} style={{
            background: `linear-gradient(135deg, ${COLORS.mint}, ${COLORS.cyan})`,
            color: COLORS.primary, border: 'none',
            padding: '14px 40px', borderRadius: 12, fontSize: 18, fontWeight: 'bold',
            cursor: 'pointer', marginBottom: 12,
            fontFamily: FONT_FAMILY,
            boxShadow: `0 0 20px ${COLORS.mint}60, 0 0 40px ${COLORS.mint}30`,
            textShadow: 'none',
          }}>{t(UI_STRINGS.continueBtn)}</button>
          <button onClick={() => {
            sounds.tick();
            haptics.tapFeedback();
            onBack();
          }} style={{
            background: 'rgba(255,255,255,0.05)',
            color: COLORS.gray, border: `1px solid ${COLORS.gray}50`,
            padding: '10px 30px', borderRadius: 12, fontSize: 14, cursor: 'pointer',
            fontFamily: FONT_FAMILY,
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
            boxShadow: '0 0 10px rgba(255,255,255,0.05)',
            textShadow: '0 0 6px rgba(255,255,255,0.2)',
          }}>{t(UI_STRINGS.back)}</button>
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
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        }}>{t(UI_STRINGS.back)}</button>
      )}
    </div>
  );
}
