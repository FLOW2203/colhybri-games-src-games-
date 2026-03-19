// ---------------------------------------------------------------------------
// COLHYBRI GAMES — Leaderboard page
// Premium podium + scrollable ranking, mobile-first
// ---------------------------------------------------------------------------

import { useState, useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';
import { GAMES } from '../games/engine/constants';
import useGameScore from '../hooks/useGameScore';

const MEDAL = ['🥇', '🥈', '🥉'];
const PODIUM_COLORS = ['#F59E0B', '#9CA3AF', '#CD7F32'];

export default function Leaderboard({ onBack }) {
  const { t } = useLocale();
  const { getLeaderboard } = useGameScore();
  const [selectedGame, setSelectedGame] = useState('all');
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);

  const gameOptions = useMemo(() => {
    const opts = [{ value: 'all', label: t(UI_STRINGS.all) }];
    GAMES.forEach((g) => {
      const key = String(g.id).padStart(2, '0');
      opts.push({
        value: key,
        label: GAME_NAMES[key] ? t(GAME_NAMES[key]) : g.name,
      });
    });
    return opts;
  }, [t]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchLeaderboard() {
      const data = await getLeaderboard(
        selectedGame === 'all' ? null : selectedGame,
        100,
      );
      if (!cancelled) {
        setEntries(data);
        setLoading(false);
      }
    }

    fetchLeaderboard();
    return () => { cancelled = true; };
  }, [selectedGame, getLeaderboard]);

  const podium = entries.slice(0, 3);
  const rest = entries.slice(3);

  return (
    <div className="h-full w-full bg-primary overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 pb-32">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={onBack}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-surface text-white text-lg"
            aria-label="Back"
          >
            ←
          </button>
          <h1 className="text-xl font-bold text-white">
            🏆 {t(UI_STRINGS.leaderboard)}
          </h1>
        </div>

        {/* Game filter */}
        <select
          value={selectedGame}
          onChange={(e) => setSelectedGame(e.target.value)}
          className="w-full mb-6 px-4 py-3 rounded-xl bg-surface text-white border border-white/10 text-sm"
          aria-label={t(UI_STRINGS.leaderboard)}
        >
          {gameOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {loading && (
          <div className="text-center text-white/40 py-16">Loading...</div>
        )}

        {!loading && entries.length === 0 && (
          <div className="text-center text-white/40 py-16">
            {t(UI_STRINGS.play)} 🎮
          </div>
        )}

        {/* Podium */}
        {!loading && podium.length > 0 && (
          <div className="flex items-end justify-center gap-3 mb-8">
            {[1, 0, 2].map((idx) => {
              const entry = podium[idx];
              if (!entry) return <div key={idx} className="w-20" />;
              const isFirst = idx === 0;
              return (
                <motion.div
                  key={entry.user_id || idx}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ delay: idx * 0.15 }}
                  className="flex flex-col items-center"
                >
                  <div
                    className="text-3xl mb-1"
                    style={{ filter: isFirst ? 'drop-shadow(0 0 8px rgba(245,158,11,0.6))' : undefined }}
                  >
                    {MEDAL[idx] || ''}
                  </div>
                  <div
                    className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold"
                    style={{
                      background: `linear-gradient(135deg, ${PODIUM_COLORS[idx]}, ${PODIUM_COLORS[idx]}88)`,
                      boxShadow: isFirst ? '0 0 20px rgba(245,158,11,0.4)' : undefined,
                    }}
                  >
                    {entry.rank}
                  </div>
                  <div className="text-white font-bold text-sm mt-2 truncate max-w-[80px] text-center">
                    {entry.user_id?.slice(0, 6) || '???'}
                  </div>
                  <div className="text-mint font-bold text-lg">
                    {entry.score}
                  </div>
                  <div
                    className="rounded-full mt-1"
                    style={{
                      width: 80,
                      height: isFirst ? 80 : idx === 1 ? 60 : 44,
                      background: `linear-gradient(to top, ${PODIUM_COLORS[idx]}33, transparent)`,
                      borderTop: `3px solid ${PODIUM_COLORS[idx]}`,
                    }}
                  />
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Rest of leaderboard */}
        <div className="flex flex-col gap-2">
          {rest.map((entry, i) => (
            <motion.div
              key={entry.user_id || i}
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-3 bg-surface rounded-xl px-4 py-3"
            >
              <div className="text-white/40 font-bold text-sm w-8 text-center">
                #{entry.rank}
              </div>
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-white text-xs font-bold">
                {entry.user_id?.slice(0, 2)?.toUpperCase() || '??'}
              </div>
              <div className="flex-1 text-white text-sm font-medium truncate">
                {entry.user_id?.slice(0, 8) || 'Player'}
              </div>
              <div className="text-mint font-bold text-sm">
                {entry.score}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
