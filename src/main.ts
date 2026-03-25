/**
 * main.ts — Point d'entrée COLHYBRI GAMES.
 * Configure Phaser avec Scale.FIT, CENTER_BOTH, pixelDensity.
 * Importe toutes les scènes et lance BootScene.
 */
import Phaser from 'phaser';

// Shared scenes
import { BootScene } from './scenes/BootScene';
import { HubScene } from './scenes/HubScene';
import { MenuScene } from './scenes/MenuScene';
import { UIScene } from './scenes/UIScene';
import { GameOverScene } from './scenes/GameOverScene';

// Game scenes — register on import
import './scenes/games/la-course-du-colibriScene';
import './scenes/games/le-jardin-partageScene';
import './scenes/games/la-ruche-cooperativeScene';
import './scenes/games/le-tri-expressScene';
import './scenes/games/leau-est-precieuseScene';
import './scenes/games/le-marche-solidaireScene';
import './scenes/games/la-foret-enchanteeScene';
import './scenes/games/le-velo-cargoScene';
import './scenes/games/le-cafe-suspenduScene';
import './scenes/games/le-potager-verticalScene';
import './scenes/games/lenergie-solaireScene';
import './scenes/games/la-banque-du-tempsScene';
import './scenes/games/le-covoiturage-solidaireScene';
import './scenes/games/le-repair-cafeScene';
import './scenes/games/la-monnaie-localeScene';
import './scenes/games/le-compost-magiqueScene';
import './scenes/games/les-abeilles-messageresScene';
import './scenes/games/le-frigo-partageScene';
import './scenes/games/la-clean-walkScene';
import './scenes/games/le-toit-vegetalScene';
import './scenes/games/la-bibliotheque-vivanteScene';
import './scenes/games/le-reseau-dentraideScene';
import './scenes/games/le-moulin-a-ventScene';
import './scenes/games/la-grainothequeScene';
import './scenes/games/le-bus-solidaireScene';
import './scenes/games/zone-de-convergenceScene';

import { getSceneClass } from './GameRouter';

// Build the scene list dynamically from the registry
function buildSceneList(): Phaser.Types.Scenes.SceneType[] {
  const scenes: Phaser.Types.Scenes.SceneType[] = [
    BootScene,
    HubScene,
    MenuScene,
    UIScene,
    GameOverScene,
  ];

  // All 26 game scenes are registered via registerScene() on import
  // We need to add them to the Phaser config
  const allJeux = [
    'la-course-du-colibri', 'le-jardin-partage', 'la-ruche-cooperative',
    'le-tri-express', 'leau-est-precieuse', 'le-marche-solidaire',
    'la-foret-enchantee', 'le-velo-cargo', 'le-cafe-suspendu',
    'le-potager-vertical', 'lenergie-solaire', 'la-banque-du-temps',
    'le-covoiturage-solidaire', 'le-repair-cafe', 'la-monnaie-locale',
    'le-compost-magique', 'les-abeilles-messageres', 'le-frigo-partage',
    'la-clean-walk', 'le-toit-vegetal', 'la-bibliotheque-vivante',
    'le-reseau-dentraide', 'le-moulin-a-vent', 'la-grainoteque',
    'le-bus-solidaire', 'zone-de-convergence',
  ];

  for (const slug of allJeux) {
    const SceneClass = getSceneClass(slug);
    if (SceneClass) {
      scenes.push(SceneClass);
    } else {
      console.warn(`[main] Scene for "${slug}" not registered`);
    }
  }

  return scenes;
}

// Phaser config — Scale.FIT + CENTER_BOTH + pixelDensity
const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 1080,
  height: 1920,
  parent: 'game-container',
  backgroundColor: '#0a0a0a',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: 1080,
    height: 1920,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false,
    },
  },
  render: {
    pixelArt: false,
    antialias: true,
    roundPixels: false,
  },
  input: {
    activePointers: 3,
    touch: {
      capture: true,
    },
  },
  scene: buildSceneList(),
};

// Launch
new Phaser.Game(config);
