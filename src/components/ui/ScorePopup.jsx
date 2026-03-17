// ---------------------------------------------------------------------------
// COLHYBRI GAMES — ScorePopup: floating score animation
// ---------------------------------------------------------------------------

import { useEffect } from 'react';

const keyframesId = 'score-popup-keyframes';

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById(keyframesId)) {
  const style = document.createElement('style');
  style.id = keyframesId;
  style.textContent = `
    @keyframes scorePopupAnim {
      0% {
        transform: scale(0.5) translateY(0);
        opacity: 1;
      }
      30% {
        transform: scale(1.2) translateY(-15px);
        opacity: 1;
      }
      50% {
        transform: scale(1) translateY(-30px);
        opacity: 1;
      }
      100% {
        transform: scale(1) translateY(-60px);
        opacity: 0;
      }
    }
  `;
  document.head.appendChild(style);
}

export default function ScorePopup({ value, x, y, onDone }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      if (onDone) onDone();
    }, 800);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      style={{
        position: 'fixed',
        left: x,
        top: y,
        zIndex: 100,
        pointerEvents: 'none',
        fontFamily: "'Space Mono', monospace",
        fontWeight: 700,
        fontSize: 24,
        color: '#D97706',
        textShadow: '0 0 10px rgba(217,119,6,0.6), 0 0 20px rgba(217,119,6,0.3)',
        animation: 'scorePopupAnim 800ms ease-out forwards',
        whiteSpace: 'nowrap',
        transform: 'translate(-50%, -50%)',
      }}
    >
      +{value}
    </div>
  );
}
