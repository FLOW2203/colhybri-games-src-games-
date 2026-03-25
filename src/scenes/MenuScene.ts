/**
 * MenuScene — Fond background du jeu actif + titre + bouton play.
 */
import Phaser from 'phaser';
import { getActiveJeu, getGameSceneKey } from '../GameRouter';
import { GameState } from '../core/GameState';
import { EventBus, EVENTS } from '../core/EventBus';
import type { GDDJeu } from '../types';

export class MenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MenuScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const jeu: GDDJeu = getActiveJeu();

    // Background
    if (this.textures.exists(jeu.background)) {
      const bg = this.add.image(width / 2, height / 2, jeu.background);
      bg.setDisplaySize(width, height);
      bg.setAlpha(0.6);
    } else {
      this.cameras.main.setBackgroundColor('#1a1a2e');
    }

    // Title
    this.add.text(width / 2, height * 0.25, jeu.titre, {
      fontSize: '56px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.8 },
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Description
    this.add.text(width / 2, height * 0.38, jeu.description, {
      fontSize: '28px',
      color: '#cccccc',
      fontFamily: 'Arial',
      align: 'center',
      wordWrap: { width: width * 0.8 },
    }).setOrigin(0.5);

    // Genre badge
    this.add.text(width / 2, height * 0.48, jeu.genre.toUpperCase(), {
      fontSize: '22px',
      color: '#44cc88',
      fontFamily: 'Arial',
      backgroundColor: '#1a1a2e',
      padding: { x: 16, y: 8 },
    }).setOrigin(0.5);

    // Play button
    const btnY = height * 0.62;
    const btn = this.add.rectangle(width / 2, btnY, 320, 80, 0x44cc88, 1)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, btnY, 'JOUER', {
      fontSize: '40px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    btn.on('pointerover', () => btn.setFillStyle(0x33bb77));
    btn.on('pointerout', () => btn.setFillStyle(0x44cc88));
    btn.on('pointerdown', () => {
      GameState.reset(jeu.id, jeu.slug);
      EventBus.emit(EVENTS.GAME_START, jeu);

      const gameSceneKey = getGameSceneKey(jeu.slug);
      this.scene.start(gameSceneKey);
      this.scene.launch('UIScene');
    });

    // Slogan
    this.add.text(width / 2, height * 0.85, 'Chaque geste compte. Le v\u00f4tre aussi.', {
      fontSize: '24px',
      color: '#888888',
      fontFamily: 'Arial',
      fontStyle: 'italic',
    }).setOrigin(0.5);
  }
}
