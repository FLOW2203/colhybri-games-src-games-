// ---------------------------------------------------------------------------
// COLHYBRI GAMES — Profile page
// Stats, badges, history — mobile-first
// ---------------------------------------------------------------------------

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';
import { UI_STRINGS, GAME_NAMES } from '../i18n/index';
import useGameScore from '../hooks/useGameScore';

const BADGE_DEFS = [
  { id: 'first_game', emoji: '🎮', threshold: 1, field: 'total_games_played' },
  { id: 'ten_games', emoji: '🔟', threshold: 10, field: 'total_games_played' },
  { id: 'fifty_games', emoji: '🏅', threshold: 50, field: 'total_games_played' },
  { id: 'hundred_games', emoji: '💯', threshold: 100, field: 'total_games_played' },
  { id: 'streak_3', emoji: '🔥', threshold: 3, field: 'streak_days' },
  { id: 'streak_7', emoji: '⚡', threshold: 7, field: 'streak_days' },
  { id: 'streak_30', emoji: '🌟', threshold: 30, field: 'streak_days' },
  { id: 'score_1k', emoji: '🎯', threshold: 1000, field: 'total_score' },
  { id: 'score_10k', emoji: '🏆', threshold: 10000, field: 'total_score' },
];

const BADGE_NAMES = {
  first_game: { fr: 'Premier pas', en: 'First Step' },
  ten_games: { fr: 'Régulier', en: 'Regular' },
  fifty_games: { fr: 'Passionné', en: 'Passionate' },
  hundred_games: { fr: 'Centurion', en: 'Centurion' },
  streak_3: { fr: 'Flamme naissante', en: 'Rising Flame' },
  streak_7: { fr: 'Semaine de feu', en: 'Fire Week' },
  streak_30: { fr: 'Légende', en: 'Legend' },
  score_1k: { fr: 'Millier', en: 'Thousand' },
  score_10k: { fr: 'Titan', en: 'Titan' },
};

function StatCard({ label, value, icon }) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      className="bg-surface rounded-xl p-4 flex flex-col items-center gap-1 flex-1 min-w-[90px]"
    >
      <div className="text-2xl">{icon}</div>
      <div className="text-white font-bold text-lg">{value}</div>
      <div className="text-white/40 text-xs text-center">{label}</div>
    </motion.div>
  );
}

export default function Profile({ onBack, points, streak }) {
  const { t } = useLocale();
  const { getProgress, getRecentScores } = useGameScore();
  const [progress, setProgress] = useState(null);
  const [recentScores, setRecentScores] = useState([]);
  const [loading, setLoading] = useState(true);

  // Read from localStorage as fallback
  const localGamesPlayed = (() => {
    try {
      let count = 0;
      for (let i = 1; i <= 26; i++) {
        const hs = localStorage.getItem(`colhybri_hs_${String(i).padStart(2, '0')}`);
        if (hs && JSON.parse(hs) > 0) count++;
      }
      return count;
    } catch { return 0; }
  })();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    async function fetchProfile() {
      const [progressData, scoresData] = await Promise.all([
        getProgress(),
        getRecentScores(10),
      ]);

      if (!cancelled) {
        setProgress(progressData);
        setRecentScores(scoresData);
        setLoading(false);
      }
    }

    fetchProfile();
    return () => { cancelled = true; };
  }, [getProgress, getRecentScores]);

  const totalGames = progress?.total_games_played || localGamesPlayed;
  const totalScore = progress?.total_score || points || 0;
  const streakDays = progress?.streak_days || streak || 0;

  const earnedBadges = BADGE_DEFS.filter((b) => {
    if (b.field === 'total_games_played') return totalGames >= b.threshold;
    if (b.field === 'streak_days') return streakDays >= b.threshold;
    if (b.field === 'total_score') return totalScore >= b.threshold;
    return false;
  });

  const nextBadge = BADGE_DEFS.find((b) => {
    if (b.field === 'total_games_played') return totalGames < b.threshold;
    if (b.field === 'streak_days') return streakDays < b.threshold;
    if (b.field === 'total_score') return totalScore < b.threshold;
    return false;
  });

  const nextProgress = nextBadge
    ? (() => {
        const current =
          nextBadge.field === 'total_games_played' ? totalGames
          : nextBadge.field === 'streak_days' ? streakDays
          : totalScore;
        return Math.min(1, current / nextBadge.threshold);
      })()
    : 1;

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
            👤 {t(UI_STRINGS.profile)}
          </h1>
        </div>

        {/* Stats row */}
        <div className="flex gap-3 mb-6">
          <StatCard icon="🎮" value={totalGames} label={t(UI_STRINGS.totalGames)} />
          <StatCard icon="💧" value={totalScore} label={t(UI_STRINGS.totalScore)} />
          <StatCard icon="🔥" value={streakDays} label={t(UI_STRINGS.streakDays)} />
        </div>

        {/* Badges */}
        <div className="mb-6">
          <h2 className="text-white font-bold text-sm mb-3 uppercase tracking-widest">
            Badges ({earnedBadges.length}/{BADGE_DEFS.length})
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {BADGE_DEFS.map((b) => {
              const earned = earnedBadges.some((eb) => eb.id === b.id);
              return (
                <motion.div
                  key={b.id}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className={`rounded-xl p-3 flex flex-col items-center gap-1 ${
                    earned ? 'bg-surface' : 'bg-surface/40 opacity-40'
                  }`}
                >
                  <div className="text-2xl">{b.emoji}</div>
                  <div className="text-white text-xs font-medium text-center">
                    {t(BADGE_NAMES[b.id]) || b.id}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>

        {/* Progress to next badge */}
        {nextBadge && (
          <div className="mb-6 bg-surface rounded-xl p-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-white/60">
                → {nextBadge.emoji} {t(BADGE_NAMES[nextBadge.id]) || nextBadge.id}
              </span>
              <span className="text-mint font-bold">
                {Math.round(nextProgress * 100)}%
              </span>
            </div>
            <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${nextProgress * 100}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-teal-500 to-emerald-500 rounded-full"
              />
            </div>
          </div>
        )}

        {/* Recent scores */}
        {recentScores.length > 0 && (
          <div>
            <h2 className="text-white font-bold text-sm mb-3 uppercase tracking-widest">
              {t(UI_STRINGS.highScore)}
            </h2>
            <div className="flex flex-col gap-2">
              {recentScores.map((s, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between bg-surface rounded-xl px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-white/40 text-xs">
                      {GAME_NAMES[s.game_slug]
                        ? t(GAME_NAMES[s.game_slug])
                        : `#${s.game_slug}`}
                    </span>
                  </div>
                  <div className="text-mint font-bold text-sm">{s.score}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
