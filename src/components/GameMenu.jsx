import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocale } from '../hooks/useLocale';
import { GAMES, CHAPTERS, COLORS } from '../games/engine/constants';
import { UI_STRINGS, CHAPTER_TITLES, GAME_NAMES } from '../i18n/index';
import LanguagePicker from './LanguagePicker';
import SubscribeCTA from './SubscribeCTA';

const CHAPTER_EMOJIS = {
  'Ch.1': '🐦', 'Ch.2': '🦜', 'Ch.3': '🦜',
  'Ch.4': '🦅', 'Ch.5': '🕊️', 'Bonus': '⭐',
};

export default function GameMenu({ onSelectGame, points, streak }) {
  const { locale, t } = useLocale();
  const [activeChapter, setActiveChapter] = useState(null);

  const filteredGames = useMemo(() => {
    if (!activeChapter) return GAMES;
    return GAMES.filter(g => g.chapter === activeChapter);
  }, [activeChapter]);

  const availableCount = GAMES.filter(g => g.priority === 'P1').length;
  const totalCount = GAMES.length;

  const gameOfTheDay = useMemo(() => {
    const today = new Date();
    const dayIndex = (today.getFullYear() * 366 + today.getMonth() * 31 + today.getDate()) % GAMES.length;
    return GAMES[dayIndex];
  }, []);

  const getHighScore = (id) => {
    try {
      return JSON.parse(localStorage.getItem(`colhybri_hs_${String(id).padStart(2, '0')}`)) || 0;
    } catch { return 0; }
  };

  return (
    <div className="h-full w-full bg-primary overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 pb-32">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">COLHYBRI</h1>
            <p className="text-xs text-gray-400">GAMES</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-full">
              <span className="text-sm">💧</span>
              <span className="text-mint font-bold text-sm">{points || 0}</span>
            </div>
            {streak > 0 && (
              <div className="flex items-center gap-1 bg-surface px-3 py-1.5 rounded-full">
                <span className="text-sm">🔥</span>
                <span className="text-gold font-bold text-sm">{streak}</span>
              </div>
            )}
          </div>
        </div>

        {/* Chapter Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-none">
          <button
            onClick={() => setActiveChapter(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              !activeChapter ? 'bg-mint text-primary' : 'bg-surface text-gray-400'
            }`}
          >
            {t(UI_STRINGS.all)}
          </button>
          {CHAPTERS.map(ch => (
            <button
              key={ch}
              onClick={() => setActiveChapter(ch)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
                activeChapter === ch ? 'bg-mint text-primary' : 'bg-surface text-gray-400'
              }`}
            >
              {CHAPTER_EMOJIS[ch]} {t(CHAPTER_TITLES[ch])}
            </button>
          ))}
        </div>

        {/* Progress */}
        <div className="text-center text-xs text-gray-500 mb-4">
          {availableCount}/{totalCount} {t(UI_STRINGS.gamesAvailable)}
        </div>

        {/* Game of the Day */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => gameOfTheDay.priority === 'P1' && onSelectGame(gameOfTheDay.id)}
          className="w-full mb-6 p-5 rounded-2xl bg-gradient-to-br from-mint/20 to-cyan/10 border border-mint/30 text-left relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-mint/5 animate-pulse" />
          <p className="text-[10px] uppercase tracking-widest text-mint/70 mb-1 relative">
            {t(UI_STRINGS.gameOfTheDay)}
          </p>
          <p className="text-2xl mb-1 relative">{gameOfTheDay.emoji}</p>
          <p className="text-lg font-bold text-white relative">
            {t(GAME_NAMES[String(gameOfTheDay.id).padStart(2, '0')])}
          </p>
          <div className="flex gap-2 mt-2 relative">
            <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-gray-300">
              {gameOfTheDay.genre}
            </span>
            <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-gray-300">
              {gameOfTheDay.duration}s
            </span>
          </div>
        </motion.button>

        {/* Game Cards */}
        <div className="grid grid-cols-2 gap-3">
          <AnimatePresence mode="popLayout">
            {filteredGames.map((game, i) => {
              const isAvailable = game.priority === 'P1';
              const hs = getHighScore(game.id);
              return (
                <motion.button
                  key={game.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: i * 0.03 }}
                  whileTap={isAvailable ? { scale: 0.95 } : {}}
                  onClick={() => isAvailable && onSelectGame(game.id)}
                  className={`p-4 rounded-xl text-left transition-all ${
                    isAvailable
                      ? 'bg-surface border border-white/5 active:border-mint/30'
                      : 'bg-surface/50 border border-white/5 opacity-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-2xl">{game.emoji}</span>
                    <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                      game.priority === 'P1' ? 'bg-mint/20 text-mint' :
                      game.priority === 'P2' ? 'bg-gold/20 text-gold' :
                      'bg-magenta/20 text-magenta'
                    }`}>
                      {game.priority}
                    </span>
                  </div>
                  <p className="text-sm font-semibold text-white mb-1 leading-tight">
                    {t(GAME_NAMES[String(game.id).padStart(2, '0')])}
                  </p>
                  <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                    <span>{game.genre}</span>
                    <span>·</span>
                    <span>{game.duration}s</span>
                  </div>
                  {isAvailable && hs > 0 && (
                    <div className="mt-2 text-[10px] text-gold">
                      ⭐ {hs}
                    </div>
                  )}
                  {!isAvailable && (
                    <div className="mt-2 text-[10px] text-gray-600">
                      🔒 {t(UI_STRINGS.comingSoon)}
                    </div>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Subscribe CTA */}
        <div className="mt-8">
          <SubscribeCTA points={points || 0} />
        </div>

        {/* Language Picker */}
        <div className="mt-6">
          <LanguagePicker />
        </div>
      </div>
    </div>
  );
}
