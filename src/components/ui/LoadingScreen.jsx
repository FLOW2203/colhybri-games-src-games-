// ---------------------------------------------------------------------------
// COLHYBRI GAMES — LoadingScreen: premium loading screen with colibri
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';

const loadingKeyframesId = 'loading-screen-keyframes';

if (typeof document !== 'undefined' && !document.getElementById(loadingKeyframesId)) {
  const style = document.createElement('style');
  style.id = loadingKeyframesId;
  style.textContent = `
    @keyframes wingBeat {
      0%, 100% { transform: scaleX(1) rotate(0deg); }
      25% { transform: scaleX(0.6) rotate(-8deg); }
      50% { transform: scaleX(1) rotate(0deg); }
      75% { transform: scaleX(0.6) rotate(8deg); }
    }
    @keyframes colibriFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-8px); }
    }
    @keyframes dotPulse {
      0%, 80%, 100% { opacity: 0.3; }
      40% { opacity: 1; }
    }
  `;
  document.head.appendChild(style);
}

function LoadingDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 3, marginLeft: 2 }}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          style={{
            display: 'inline-block',
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: '#fff',
            animation: `dotPulse 1.4s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  );
}

export default function LoadingScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #0A0F1C 0%, #111827 50%, #0A0F1C 100%)',
        fontFamily: "'Outfit', sans-serif",
      }}
    >
      {/* Colibri SVG */}
      <div style={{ animation: 'colibriFloat 2s ease-in-out infinite', marginBottom: 32 }}>
        <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
          {/* Body */}
          <ellipse cx="40" cy="42" rx="10" ry="14" fill="#0D9488" />
          {/* Head */}
          <circle cx="40" cy="26" r="8" fill="#10B981" />
          {/* Eye */}
          <circle cx="42" cy="24" r="1.5" fill="#fff" />
          <circle cx="42.5" cy="24" r="0.8" fill="#0A0F1C" />
          {/* Beak */}
          <path d="M48 25 L60 23 L48 27 Z" fill="#F59E0B" />
          {/* Left wing */}
          <g style={{ transformOrigin: '35px 38px', animation: 'wingBeat 0.15s ease-in-out infinite' }}>
            <path d="M30 38 Q15 30 10 38 Q15 42 30 42 Z" fill="#0EA5E9" opacity="0.8" />
          </g>
          {/* Right wing */}
          <g style={{ transformOrigin: '45px 38px', animation: 'wingBeat 0.15s ease-in-out infinite reverse' }}>
            <path d="M50 38 Q65 30 70 38 Q65 42 50 42 Z" fill="#0EA5E9" opacity="0.8" />
          </g>
          {/* Tail */}
          <path d="M36 55 L32 68 L40 58 L48 68 L44 55 Z" fill="#0D9488" opacity="0.7" />
          {/* Chest shimmer */}
          <ellipse cx="40" cy="40" rx="5" ry="8" fill="url(#shimmer)" opacity="0.3" />
          <defs>
            <linearGradient id="shimmer" x1="35" y1="32" x2="45" y2="48" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#A78BFA" />
              <stop offset="50%" stopColor="#FFD700" />
              <stop offset="100%" stopColor="#0EA5E9" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Loading text */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          color: '#fff',
          fontSize: 18,
          fontWeight: 600,
          letterSpacing: '0.05em',
          opacity: 0.8,
        }}
      >
        Loading
        <LoadingDots />
      </div>
    </div>
  );
}
