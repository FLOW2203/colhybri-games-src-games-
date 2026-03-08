import { useState, useCallback, lazy, Suspense } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import GameMenu from './components/GameMenu';
import NarrativeIntro from './components/NarrativeIntro';
import GamePostScreen from './components/GamePostScreen';
import { useLocale } from './hooks/useLocale';
import useGamePoints from './hooks/useGamePoints';
import { GAMES } from './games/engine/constants';
import { SCIENCE_FACTS } from './data/scienceFacts';
import { LEGENDS, GAME_NAMES, UI_STRINGS } from './i18n/index';
import { LESSONS } from './data/gameConfig';

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

function LoadingScreen() {
  return (
    <div className="h-full w-full flex items-center justify-center bg-primary">
      <motion.div
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="text-4xl"
      >
        🐦
      </motion.div>
    </div>
  );
}

export default function App() {
  const { locale, t } = useLocale();
  const { points, streak, addPoints } = useGamePoints();
  const [screen, setScreen] = useState('menu');
  const [currentGameId, setCurrentGameId] = useState(null);
  const [lastScore, setLastScore] = useState(0);
  const [lastHighScore, setLastHighScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  const [playCount, setPlayCount] = useState(0);

  const handleSelectGame = useCallback((gameId) => {
    setCurrentGameId(gameId);
    const game = GAMES.find(g => g.id === gameId);
    if (game) {
      const legend = LEGENDS[game.chapter];
      if (legend && playCount % 3 === 0) {
        setScreen('intro');
      } else {
        setScreen('game');
      }
    }
  }, [playCount]);

  const handleIntroComplete = useCallback(() => {
    setScreen('game');
  }, []);

  const handleGameComplete = useCallback((score) => {
    const hsKey = `colhybri_hs_${currentGameId}`;
    const prevHs = JSON.parse(localStorage.getItem(hsKey) || '0');
    const newRecord = score > prevHs;
    if (newRecord) {
      localStorage.setItem(hsKey, JSON.stringify(score));
    }
    const game = GAMES.find(g => g.id === currentGameId);
    const earned = game ? game.pointsBase + (newRecord ? game.pointsBonus : 0) : 10;
    addPoints(earned);

    setLastScore(score);
    setLastHighScore(newRecord ? score : prevHs);
    setIsNewRecord(newRecord);
    setPlayCount(c => c + 1);
    setScreen('post');
  }, [currentGameId, addPoints]);

  const handleBack = useCallback(() => {
    setCurrentGameId(null);
    setScreen('menu');
  }, []);

  const handleReplay = useCallback(() => {
    setScreen('game');
  }, []);

  const currentGame = currentGameId ? GAMES.find(g => g.id === currentGameId) : null;
  const currentFact = currentGameId ? SCIENCE_FACTS.find(f => f.gameId === currentGameId) : null;
  const GameComponent = currentGameId ? gameComponents[currentGameId] : null;

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
              lesson={currentGameId && LESSONS[currentGameId] ? t(LESSONS[currentGameId]) : ''}
              fact={currentFact ? t(currentFact.fact) : ''}
              factSource={currentFact ? currentFact.source : ''}
              onReplay={handleReplay}
              onChallenge={() => {}}
              onMenu={handleBack}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
