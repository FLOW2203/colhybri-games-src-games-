import { useState, useCallback, useRef, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GameMenu from './components/GameMenu';
import NarrativeIntro from './components/NarrativeIntro';
import GamePostScreen from './components/GamePostScreen';
import BottomNav from './components/BottomNav';
import LoadingScreenUI from './components/ui/LoadingScreen';
import Leaderboard from './pages/Leaderboard';
import Profile from './pages/Profile';
import { useLocale } from './hooks/useLocale';
import useGamePoints from './hooks/useGamePoints';
import useGameScore from './hooks/useGameScore';
import useAnalytics from './hooks/useAnalytics';
import { GAMES } from './games/engine/constants';
import { SCIENCE_FACTS } from './data/scienceFacts';
import { LEGENDS, GAME_NAMES, UI_STRINGS } from './i18n/index';
import { LESSONS } from './data/gameConfig';

// Convert numeric game ID (1-26) to zero-padded string key ('01'-'26')
const toKey = (id) => String(id).padStart(2, '0');

const gameComponents = {
  '01': lazy(() => import('./games/GameHeartbeatRush')),
  '02': lazy(() => import('./games/GameTorpeur')),
  '04': lazy(() => import('./games/Game800km')),
  '05': lazy(() => import('./games/GameWingBeat')),
  '09': lazy(() => import('./games/GameDonBecABec')),
  '10': lazy(() => import('./games/GameTransformationArcEnCiel')),
  '13': lazy(() => import('./games/Game10sur10')),
  '14': lazy(() => import('./games/GamePlongeonSacre')),
  '15': lazy(() => import('./games/GameSemiCercle')),
  '16': lazy(() => import('./games/GameSignalDomino')),
  '19': lazy(() => import('./games/GameLancerFruits')),
  '24': lazy(() => import('./games/GameNidDukdukdiya')),
  '25': lazy(() => import('./games/GameBouclierHeigig')),
  '26': lazy(() => import('./games/GameEveilleur')),
  // P2 games
  '03': lazy(() => import('./games/GameReverseFlight')),
  '06': lazy(() => import('./games/Game300Cheeseburgers')),
  '11': lazy(() => import('./games/GameZeroJalousie')),
  '12': lazy(() => import('./games/GamePerroquetComprend')),
  '17': lazy(() => import('./games/Game11Litres')),
  '20': lazy(() => import('./games/GameDortoirA6')),
  '21': lazy(() => import('./games/GameHelpersNest')),
  '22': lazy(() => import('./games/GameSuperDisperseur')),
  // P3 games
  '07': lazy(() => import('./games/GameSuperBrain')),
  '08': lazy(() => import('./games/GameTimbreExpress')),
  '18': lazy(() => import('./games/GameEcolePelicans')),
  '23': lazy(() => import('./games/GameRadiateurNaturel')),
};

// Screens where the bottom nav should be visible
const NAV_SCREENS = new Set(['menu', 'leaderboard', 'profile']);

function LoadingScreen() {
  return <LoadingScreenUI />;
}

export default function App() {
  const { locale, t } = useLocale();
  const { points, streak, addPoints } = useGamePoints();
  const { submitScore, updateStreak, lastResult: scoreResult } = useGameScore();
  const { trackGameStart, trackGameComplete, trackGameAbandon } = useAnalytics();
  const [screen, setScreen] = useState('menu');
  const [currentGameId, setCurrentGameId] = useState(null);
  const [lastScore, setLastScore] = useState(0);
  const [lastHighScore, setLastHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [playCount, setPlayCount] = useState(0);
  const gameStartTime = useRef(null);

  const handleSelectGame = useCallback((gameId) => {
    setCurrentGameId(gameId);
    gameStartTime.current = Date.now();
    const game = GAMES.find(g => g.id === gameId);
    if (game) {
      trackGameStart(toKey(gameId), locale);
      const legend = LEGENDS[game.chapter];
      if (legend && playCount % 3 === 0) {
        setScreen('intro');
      } else {
        setScreen('game');
      }
    }
  }, [playCount, locale, trackGameStart]);

  const handleIntroComplete = useCallback(() => {
    setScreen('game');
  }, []);

  const handleGameComplete = useCallback((score) => {
    const slug = toKey(currentGameId);
    const hsKey = `colhybri_hs_${slug}`;
    const prevHs = JSON.parse(localStorage.getItem(hsKey) || '0');
    const newRecord = score > prevHs;
    if (newRecord) {
      localStorage.setItem(hsKey, JSON.stringify(score));
    }
    const game = GAMES.find(g => g.id === currentGameId);
    const earned = game ? game.pointsBase + (newRecord ? game.pointsBonus : 0) : 10;
    addPoints(earned);

    // Compute actual play duration
    const elapsed = gameStartTime.current
      ? Math.round((Date.now() - gameStartTime.current) / 1000)
      : (game ? game.duration : null);

    // Persist to Supabase (fire-and-forget, never blocks UI)
    submitScore(slug, score, elapsed, { newRecord, gameId: currentGameId });

    // Sync streak to Supabase
    updateStreak(streak);

    // Analytics
    trackGameComplete(slug, score, elapsed);

    setLastScore(score);
    setLastHighScore(newRecord ? score : prevHs);
    setIsNewRecord(newRecord);
    setPlayCount(c => c + 1);
    setScreen('post');
  }, [currentGameId, addPoints, submitScore, updateStreak, streak, trackGameComplete]);

  const handleBack = useCallback(() => {
    // Track abandonment if leaving mid-game
    if (screen === 'game' && currentGameId && gameStartTime.current) {
      const elapsed = Math.round((Date.now() - gameStartTime.current) / 1000);
      trackGameAbandon(toKey(currentGameId), elapsed);
    }
    setCurrentGameId(null);
    setScreen('menu');
  }, [screen, currentGameId, trackGameAbandon]);

  const handleReplay = useCallback(() => {
    setScreen('game');
  }, []);

  const handleNavChange = useCallback((tab) => {
    setCurrentGameId(null);
    setScreen(tab);
  }, []);

  const currentGame = currentGameId ? GAMES.find(g => g.id === currentGameId) : null;
  const gameKey = currentGameId ? toKey(currentGameId) : null;
  const currentFact = gameKey ? SCIENCE_FACTS.find(f => f.gameId === gameKey) : null;
  const GameComponent = gameKey ? gameComponents[gameKey] : null;

  const showNav = NAV_SCREENS.has(screen);

  return (
    <div className="h-screen w-screen overflow-hidden bg-primary">
      <AnimatePresence mode="wait">
        {screen === 'menu' && (
          <motion.div
            key="menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <GameMenu
              onSelectGame={handleSelectGame}
              points={points}
              streak={streak}
            />
          </motion.div>
        )}

        {screen === 'leaderboard' && (
          <motion.div
            key="leaderboard"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <Leaderboard onBack={handleBack} />
          </motion.div>
        )}

        {screen === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <Profile
              onBack={handleBack}
              points={points}
              streak={streak}
            />
          </motion.div>
        )}

        {screen === 'intro' && currentGame && (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <NarrativeIntro
              text={LEGENDS[currentGame.chapter] ? t(LEGENDS[currentGame.chapter].intro) : ''}
              onComplete={handleIntroComplete}
            />
          </motion.div>
        )}

        {screen === 'game' && GameComponent && (
          <motion.div
            key="game"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <Suspense fallback={<LoadingScreen />}>
              <GameComponent
                onComplete={handleGameComplete}
                onBack={handleBack}
              />
            </Suspense>
          </motion.div>
        )}

        {screen === 'post' && (
          <motion.div
            key="post"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-full"
          >
            <GamePostScreen
              score={lastScore}
              highScore={lastHighScore}
              isNewRecord={isNewRecord}
              points={currentGame ? currentGame.pointsBase : 10}
              lesson={gameKey && LESSONS[gameKey] ? t(LESSONS[gameKey]) : ''}
              fact={currentFact ? t(currentFact.fact) : ''}
              factSource={currentFact ? currentFact.source : ''}
              gameName={gameKey && GAME_NAMES[gameKey] ? t(GAME_NAMES[gameKey]) : ''}
              rank={scoreResult?.rank ?? null}
              onReplay={handleReplay}
              onChallenge={() => {}}
              onMenu={handleBack}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom navigation — visible on menu, leaderboard, profile */}
      {showNav && (
        <BottomNav active={screen} onChange={handleNavChange} />
      )}
    </div>
  );
}
