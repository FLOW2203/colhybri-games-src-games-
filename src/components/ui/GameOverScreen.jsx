// ---------------------------------------------------------------------------
// COLHYBRI GAMES — GameOverScreen: premium game over overlay
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../../hooks/useLocale';
import { UI_STRINGS } from '../../i18n/index';

const confettiKeyframesId = 'game-over-confetti-keyframes';

// Inject confetti + star keyframes once
if (typeof document !== 'undefined' && !document.getElementById(confettiKeyframesId)) {
  const style = document.createElement('style');
  style.id = confettiKeyframesId;
  style.textContent = `
    @keyframes confettiFall {
      0% { transform: translateY(-10vh) rotate(0deg); opacity: 1; }
      100% { transform: translateY(110vh) rotate(720deg); opacity: 0; }
    }
    @keyframes pulseGlow {
      0%, 100% { text-shadow: 0 0 10px rgba(245,158,11,0.6), 0 0 20px rgba(245,158,11,0.3); }
      50% { text-shadow: 0 0 20px rgba(245,158,11,0.9), 0 0 40px rgba(245,158,11,0.5), 0 0 60px rgba(245,158,11,0.2); }
    }
    @keyframes starPop {
      0% { transform: scale(0) rotate(-30deg); }
      60% { transform: scale(1.2) rotate(5deg); }
      100% { transform: scale(1) rotate(0deg); }
    }
  `;
  document.head.appendChild(style);
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
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) frameId = requestAnimationFrame(tick);
    }
    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, [target, duration]);

  return value;
}

/* ---------- CSS-only Star ---------- */
function Star({ filled, delay }) {
  return (
    <div
      style={{
        width: 48,
        height: 48,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        animation: `starPop 0.5s ${delay}ms ease-out both`,
      }}
    >
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none">
        <path
          d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z"
          fill={filled ? '#F59E0B' : 'rgba(255,255,255,0.15)'}
          stroke={filled ? '#F59E0B' : 'rgba(255,255,255,0.2)'}
          strokeWidth="1"
        />
        {filled && (
          <path
            d="M12 2l2.9 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14l-5-4.87 7.1-1.01L12 2z"
            fill="none"
            stroke="#FFD700"
            strokeWidth="0.5"
            style={{ filter: 'blur(3px)' }}
          />
        )}
      </svg>
    </div>
  );
}

/* ---------- CSS Confetti ---------- */
function CSSConfetti() {
  const colors = ['#0D9488', '#F59E0B', '#0EA5E9', '#10B981', '#FFD700', '#F472B6', '#A78BFA'];
  const pieces = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    left: `${Math.random() * 100}%`,
    color: colors[i % colors.length],
    size: 6 + Math.random() * 6,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
  }));

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 1 }}>
      {pieces.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.left,
            top: 0,
            width: p.size,
            height: p.size * 0.6,
            background: p.color,
            borderRadius: 1,
            animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
            opacity: 0.9,
          }}
        />
      ))}
    </div>
  );
}

/* ---------- Main component ---------- */
export default function GameOverScreen({
  score,
  highScore,
  isNewRecord,
  stars = 0,
  onReplay,
  onMenu,
  onNext,
  gameName,
}) {
  const { t } = useLocale();
  const clampedStars = Math.max(0, Math.min(3, stars));

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 60,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(10,15,28,0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          fontFamily: "'Outfit', sans-serif",
        }}
      >
        {clampedStars >= 2 && <CSSConfetti />}

        <motion.div
          initial={{ scale: 0.8, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.1 }}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* Game name */}
          {gameName && (
            <div style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 14,
              color: 'rgba(255,255,255,0.5)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginBottom: 4,
            }}>
              {gameName}
            </div>
          )}

          {/* Game Over title */}
          <div style={{
            fontFamily: "'Outfit', sans-serif",
            fontWeight: 800,
            fontSize: 32,
            color: '#fff',
            marginBottom: 8,
          }}>
            {t(UI_STRINGS.gameOver)}
          </div>

          {/* Stars */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {[0, 1, 2].map((i) => (
              <Star key={i} filled={i < clampedStars} delay={200 + i * 200} />
            ))}
          </div>

          {/* Score */}
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: 'rgba(255,255,255,0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}>
            {t(UI_STRINGS.score)}
          </div>
          <div style={{
            fontFamily: "'Space Mono', monospace",
            fontWeight: 700,
            fontSize: 56,
            color: '#fff',
            textShadow: '0 0 30px rgba(46,234,163,0.4)',
            lineHeight: 1,
            marginBottom: 4,
          }}>
            <AnimatedCounter target={score} />
          </div>

          {/* High Score */}
          <div style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 13,
            color: 'rgba(255,255,255,0.35)',
          }}>
            {t(UI_STRINGS.highScore)}: {highScore}
          </div>

          {/* New Record badge */}
          {isNewRecord && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.8, type: 'spring', stiffness: 300 }}
              style={{
                marginTop: 8,
                padding: '6px 20px',
                borderRadius: 20,
                background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                color: '#fff',
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                fontSize: 14,
                animation: 'pulseGlow 2s ease-in-out infinite',
              }}
            >
              {t(UI_STRINGS.newRecord)}
            </motion.div>
          )}

          {/* Buttons */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            marginTop: 32,
            width: 260,
          }}>
            {/* Replay */}
            <button
              onClick={onReplay}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 14,
                border: 'none',
                background: 'linear-gradient(135deg, #0D9488, #10B981)',
                color: '#fff',
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                transition: 'transform 0.15s, filter 0.15s',
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {t(UI_STRINGS.replay)}
            </button>

            {/* Menu */}
            <button
              onClick={onMenu}
              style={{
                width: '100%',
                padding: '14px 0',
                borderRadius: 14,
                border: '2px solid rgba(255,255,255,0.2)',
                background: 'transparent',
                color: '#fff',
                fontFamily: "'Outfit', sans-serif",
                fontWeight: 700,
                fontSize: 16,
                cursor: 'pointer',
                transition: 'transform 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)')}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {t(UI_STRINGS.menu)}
            </button>

            {/* Next */}
            {onNext && (
              <button
                onClick={onNext}
                style={{
                  width: '100%',
                  padding: '14px 0',
                  borderRadius: 14,
                  border: 'none',
                  background: 'linear-gradient(135deg, #F59E0B, #EF4444)',
                  color: '#fff',
                  fontFamily: "'Outfit', sans-serif",
                  fontWeight: 700,
                  fontSize: 16,
                  cursor: 'pointer',
                  transition: 'transform 0.15s, filter 0.15s',
                }}
                onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.96)')}
                onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              >
                Next
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
