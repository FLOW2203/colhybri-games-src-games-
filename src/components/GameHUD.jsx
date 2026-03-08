import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';

function formatTime(seconds) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function GameHUD({ score, timer, lives, maxLives, muted, onMute, onBack }) {
  const { t } = useLocale();
  const prevScore = useRef(score);

  useEffect(() => {
    prevScore.current = score;
  }, [score]);

  const scoreChanged = score !== prevScore.current;
  const timerCritical = typeof timer === 'number' && timer < 3;

  return (
    <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-[#0A0F1C]/80 backdrop-blur-sm">
      {/* Left: Back button */}
      <button
        onClick={onBack}
        className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-white text-xl"
        aria-label="Back"
      >
        ←
      </button>

      {/* Center: Score + Timer */}
      <div className="flex flex-col items-center gap-0.5">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={score}
            initial={scoreChanged ? { scale: 1.5, color: '#2EEAA3' } : false}
            animate={{ scale: 1, color: '#FFFFFF' }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            className="text-2xl font-bold text-white tabular-nums"
          >
            {score}
          </motion.span>
        </AnimatePresence>

        {typeof timer === 'number' && (
          <motion.span
            animate={
              timerCritical
                ? { color: ['#ef4444', '#ffffff', '#ef4444'], scale: [1, 1.1, 1] }
                : { color: '#9ca3af', scale: 1 }
            }
            transition={
              timerCritical
                ? { duration: 0.6, repeat: Infinity, ease: 'easeInOut' }
                : { duration: 0.3 }
            }
            className="text-sm font-mono tabular-nums"
          >
            {formatTime(timer)}
          </motion.span>
        )}
      </div>

      {/* Right: Lives + Mute */}
      <div className="flex items-center gap-3">
        {typeof lives === 'number' && typeof maxLives === 'number' && (
          <div className="flex gap-0.5 text-lg" aria-label={`${lives} of ${maxLives} lives`}>
            {Array.from({ length: maxLives }, (_, i) => (
              <span key={i}>{i < lives ? '❤️' : '🖤'}</span>
            ))}
          </div>
        )}

        <button
          onClick={onMute}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 transition-colors text-xl"
          aria-label={muted ? 'Unmute' : 'Mute'}
        >
          {muted ? '🔇' : '🔊'}
        </button>
      </div>
    </div>
  );
}
