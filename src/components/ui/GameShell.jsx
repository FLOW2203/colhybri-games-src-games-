// ---------------------------------------------------------------------------
// COLHYBRI GAMES — GameShell: overlay HUD wrapper for all games
// ---------------------------------------------------------------------------

import { useState, useMemo } from 'react';

const styles = {
  container: {
    position: 'fixed',
    inset: 0,
    zIndex: 50,
    pointerEvents: 'none',
    fontFamily: "'Outfit', sans-serif",
  },
  header: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    pointerEvents: 'auto',
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    transition: 'background 0.2s',
  },
  gameName: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 700,
    fontSize: 16,
    color: '#fff',
    textShadow: '0 1px 4px rgba(0,0,0,0.5)',
    textAlign: 'center',
    flex: 1,
  },
  muteBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    border: 'none',
    background: 'rgba(255,255,255,0.12)',
    color: '#fff',
    fontSize: 20,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'auto',
    transition: 'background 0.2s',
  },
  scoreArea: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  scoreValue: {
    fontFamily: "'Outfit', sans-serif",
    fontWeight: 800,
    fontSize: 48,
    color: '#fff',
    textShadow: '0 0 20px rgba(46,234,163,0.5), 0 0 40px rgba(46,234,163,0.25)',
    lineHeight: 1,
  },
  timerContainer: {
    position: 'absolute',
    top: 68,
    right: 20,
    pointerEvents: 'none',
  },
  energyContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 4,
    background: 'rgba(255,255,255,0.1)',
    pointerEvents: 'none',
  },
};

function TimerRing({ timeLeft, maxTime }) {
  const size = 44;
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const ratio = maxTime > 0 ? Math.max(0, Math.min(1, timeLeft / maxTime)) : 1;
  const offset = circumference * (1 - ratio);

  // Color: teal > orange > red
  let color = '#0D9488';
  if (ratio < 0.25) color = '#EF4444';
  else if (ratio < 0.5) color = '#F59E0B';

  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);
  const display = `${minutes}:${String(seconds).padStart(2, '0')}`;

  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="rgba(255,255,255,0.1)"
        strokeWidth={stroke}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.3s ease, stroke 0.3s ease' }}
      />
      <text
        x={size / 2}
        y={size / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#fff"
        fontSize={11}
        fontFamily="'Outfit', sans-serif"
        fontWeight="600"
        style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}
      >
        {display}
      </text>
    </svg>
  );
}

function EnergyBar({ energy }) {
  const clampedEnergy = Math.max(0, Math.min(100, energy));

  // Gradient from green to orange to red based on energy
  let barColor;
  if (clampedEnergy > 60) barColor = '#10B981';
  else if (clampedEnergy > 30) barColor = '#F59E0B';
  else barColor = '#EF4444';

  return (
    <div style={styles.energyContainer}>
      <div
        style={{
          height: '100%',
          width: `${clampedEnergy}%`,
          background: `linear-gradient(90deg, ${barColor}, ${barColor}dd)`,
          transition: 'width 0.3s ease, background 0.3s ease',
          borderRadius: '0 2px 2px 0',
        }}
      />
    </div>
  );
}

export default function GameShell({
  gameName,
  score,
  timeLeft,
  maxTime,
  energy,
  onBack,
  onMute,
  children,
}) {
  const [muted, setMuted] = useState(false);

  const handleMute = () => {
    setMuted((prev) => !prev);
    if (onMute) onMute(!muted);
  };

  return (
    <>
      {children}
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <button
            style={styles.backBtn}
            onClick={onBack}
            aria-label="Back"
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M13 4L7 10L13 16" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <span style={styles.gameName}>{gameName}</span>
          <button
            style={styles.muteBtn}
            onClick={handleMute}
            aria-label={muted ? 'Unmute' : 'Mute'}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.2)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.12)')}
          >
            {muted ? '\u{1F507}' : '\u{1F50A}'}
          </button>
        </div>

        {/* Score */}
        <div style={styles.scoreArea}>
          <div style={styles.scoreValue}>{score ?? 0}</div>
        </div>

        {/* Timer ring */}
        {typeof timeLeft === 'number' && typeof maxTime === 'number' && (
          <div style={styles.timerContainer}>
            <TimerRing timeLeft={timeLeft} maxTime={maxTime} />
          </div>
        )}

        {/* Energy bar */}
        {typeof energy === 'number' && <EnergyBar energy={energy} />}
      </div>
    </>
  );
}
