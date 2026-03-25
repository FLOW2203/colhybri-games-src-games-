/**
 * GameRouter — Lit ?game=N depuis window.location.
 * Mappe N → gdd.jeux[N-1] (slug, genre, assets, regles_jeu).
 * Instancie dynamiquement la GameScene correspondante.
 * Fallback game=1 si N invalide.
 */
import { Constants } from './core/Constants';
import type { GDDJeu } from './types';

// Scene class registry — populated by scene modules
const sceneRegistry: Map<string, typeof Phaser.Scene> = new Map();

export function registerScene(slug: string, sceneClass: typeof Phaser.Scene): void {
  sceneRegistry.set(slug, sceneClass);
}

export function getSceneClass(slug: string): typeof Phaser.Scene | undefined {
  return sceneRegistry.get(slug);
}

export function getActiveGameId(): number {
  const params = new URLSearchParams(window.location.search);
  const raw = params.get(Constants.routeParam);
  const id = raw ? parseInt(raw, 10) : 1;

  if (isNaN(id) || id < 1 || id > Constants.totalGames) {
    return 1; // Fallback game=1 si N invalide
  }
  return id;
}

export function getActiveJeu(): GDDJeu {
  const id = getActiveGameId();
  const jeu = Constants.getJeu(id);
  if (!jeu) {
    // Fallback to game 1
    return Constants.getJeu(1)!;
  }
  return jeu;
}

export function getGameSceneKey(slug: string): string {
  return `GameScene_${slug}`;
}
