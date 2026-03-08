import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS } from '../i18n/index';

/* ---------- Simple confetti ---------- */
function Confetti() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#2EEAA3', '#FFD700', '#FF6B6B', '#60A5FA', '#A78BFA', '#F472B6'];
    const pieces = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      w: 6 + Math.random() * 6,
      h: 4 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: (Math.random() - 0.5) * 4,
      vy: 2 + Math.random() * 4,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.2,
    }));

    let frameId;
    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      for (const p of pieces) {
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vr;
        p.vy += 0.05;
        if (p.y < canvas.height + 20) alive = true;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      if (alive) frameId = requestAnimationFrame(draw);
    }
    frameId = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[70]"
    />
  );
}

/* ---------- Animated counter ---------- */
function AnimatedCounter({ target, duration = 1200 }) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let frameId;
    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      setValue(Math.round(progress * target));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

/* ---------- Main component ---------- */
export default function GamePostScreen({
  score,
  highScore,
  isNewRecord,
  points,
  lesson,
  fact,
  factSource,
  onReplay,
  onChallenge,
  onMenu,
}) {
  const { t } = useLocale();

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0A0F1C] overflow-y-auto py-8 px-4">
      {isNewRecord && <Confetti />}

      {/* Score */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 12 }}
        className="text-center mb-4"
      >
        <p className="text-white/60 text-sm uppercase tracking-widest mb-1">
          {t(UI_STRINGS.score)}
        </p>
        <p className="text-6xl font-bold text-white">{score}</p>
        {isNewRecord && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="text-[#FFD700] font-bold mt-1 text-lg"
          >
            {t(UI_STRINGS.newRecord)}
          </motion.p>
        )}
        <p className="text-white/40 text-sm mt-1">
          {t(UI_STRINGS.highScore)}: {highScore}
        </p>
      </motion.div>

      {/* Points earned */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="flex items-center gap-2 mb-6 text-[#2EEAA3] text-2xl font-bold"
      >
        <span>💧</span>
        <span>+<AnimatedCounter target={points} /></span>
      </motion.div>

      {/* Lesson */}
      {lesson && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-white/70 italic text-center max-w-sm mb-6 text-sm leading-relaxed"
        >
          &ldquo;{lesson}&rdquo;
        </motion.p>
      )}

      {/* Did you know? */}
      {fact && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 max-w-sm w-full mb-8"
        >
          <p className="text-[#2EEAA3] font-bold text-xs uppercase tracking-widest mb-2">
            {t(UI_STRINGS.didYouKnow)}
          </p>
          <p className="text-white/80 text-sm leading-relaxed">{fact}</p>
          {factSource && (
            <p className="text-white/30 text-xs italic mt-2">— {factSource}</p>
          )}
        </motion.div>
      )}

      {/* Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9 }}
        className="flex flex-col gap-3 w-full max-w-xs"
      >
        <button
          onClick={onReplay}
          className="w-full py-3 rounded-xl font-bold text-[#0A0F1C] bg-[#2EEAA3] hover:brightness-110 transition-all active:scale-95"
        >
          {t(UI_STRINGS.replay)}
        </button>
        <button
          onClick={onChallenge}
          className="w-full py-3 rounded-xl font-bold text-[#0A0F1C] bg-[#FFD700] hover:brightness-110 transition-all active:scale-95"
        >
          {t(UI_STRINGS.challenge)}
        </button>
        <button
          onClick={onMenu}
          className="w-full py-3 rounded-xl font-bold text-white bg-white/10 hover:bg-white/20 transition-all active:scale-95"
        >
          {t(UI_STRINGS.menu)}
        </button>
      </motion.div>
    </div>
  );
}
