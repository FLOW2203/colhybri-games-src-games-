/**
 * GameOverScene — Score final + leçon du jeu + CTA.
 * Données lues depuis gdd.jeux[N].
 */
import Phaser from 'phaser';
import { getActiveJeu } from '../GameRouter';
import { GameState } from '../core/GameState';
import { saveScore, syncSolidarite } from '../core/SupabaseClient';
import type { GDDJeu } from '../types';

export class GameOverScene extends Phaser.Scene {
  constructor() {
    super({ key: 'GameOverScene' });
  }

  create(): void {
    const { width, height } = this.scale;
    const jeu: GDDJeu = getActiveJeu();
    const score = GameState.score;
    const solidarite = GameState.solidarite;

    // Save to Supabase
    saveScore(jeu.id, score, jeu.slug);
    if (solidarite > 0) {
      syncSolidarite(jeu.id, solidarite, jeu.slug);
    }

    // Dark overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.8);

    // Game Over title
    this.add.text(width / 2, height * 0.15, 'PARTIE TERMINÉE', {
      fontSize: '52px',
      color: '#ff6666',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 4,
    }).setOrigin(0.5);

    // Score
    this.add.text(width / 2, height * 0.28, `Score : ${score}`, {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Solidarité
    this.add.text(width / 2, height * 0.35, `Solidarité : ${solidarite}`, {
      fontSize: '32px',
      color: '#44cc88',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Leçon du jeu (depuis gdd.jeux[N].lecon)
    this.add.text(width / 2, height * 0.50, jeu.lecon, {
      fontSize: '30px',
      color: '#ffcc44',
      fontFamily: 'Arial',
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: width * 0.8 },
    }).setOrigin(0.5);

    // CTA (depuis gdd.jeux[N].cta_game_over)
    const ctaY = height * 0.65;
    const ctaBtn = this.add.rectangle(width / 2, ctaY, width * 0.7, 70, 0x44cc88)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, ctaY, jeu.cta_game_over, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width * 0.65 },
    }).setOrigin(0.5);

    ctaBtn.on('pointerdown', () => {
      window.open('https://colhybri.com', '_blank');
    });

    // Replay button
    const replayY = height * 0.80;
    const replayBtn = this.add.rectangle(width / 2, replayY, 280, 70, 0x4488cc)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, replayY, 'REJOUER', {
      fontSize: '36px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    replayBtn.on('pointerdown', () => {
      this.scene.start('MenuScene');
    });

    // Bouton retour vers le Hub
    const hubY = height * 0.90;
    const hubBtn = this.add.rectangle(width / 2, hubY, 280, 60, 0x0D9488)
      .setInteractive({ useHandCursor: true });

    this.add.text(width / 2, hubY, '← Hub', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    hubBtn.on('pointerover', () => hubBtn.setFillStyle(0xF59E0B));
    hubBtn.on('pointerout', () => hubBtn.setFillStyle(0x0D9488));
    hubBtn.on('pointerdown', () => {
      this.scene.start('HubScene');
    });
  }
}
