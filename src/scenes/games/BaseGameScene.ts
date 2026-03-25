/**
 * BaseGameScene — Classe de base pour les 26 GameScenes.
 * Gère le fait_scientifique overlay, le timer, et le game over.
 * Chaque GameScene hérite de cette classe.
 */
import Phaser from 'phaser';
import { EventBus, EVENTS } from '../../core/EventBus';
import { GameState } from '../../core/GameState';
import { Constants } from '../../core/Constants';
import type { GDDJeu } from '../../types';

export abstract class BaseGameScene extends Phaser.Scene {
  protected jeu!: GDDJeu;
  protected timerEvent: Phaser.Time.TimerEvent | null = null;
  protected remainingTime: number = 0;

  constructor(key: string) {
    super({ key });
  }

  init(): void {
    const id = GameState.activeGameId;
    this.jeu = Constants.getJeu(id)!;
  }

  create(): void {
    const { width, height } = this.scale;

    // Background
    if (this.textures.exists(this.jeu.background)) {
      const bg = this.add.image(width / 2, height / 2, this.jeu.background);
      bg.setDisplaySize(width, height);
      bg.setDepth(-1);
    } else {
      this.cameras.main.setBackgroundColor('#1a1a2e');
    }

    // Bouton retour vers le Hub (coin haut gauche, depth élevé pour rester visible)
    const backBtn = this.add.text(20, 20, '← Hub', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      backgroundColor: '#0D9488',
      padding: { x: 16, y: 10 },
    }).setInteractive({ useHandCursor: true }).setDepth(200).setScrollFactor(0);

    backBtn.on('pointerover', () => backBtn.setStyle({ backgroundColor: '#F59E0B' }));
    backBtn.on('pointerout', () => backBtn.setStyle({ backgroundColor: '#0D9488' }));
    backBtn.on('pointerdown', () => {
      this.scene.stop('UIScene');
      if (this.timerEvent) this.timerEvent.destroy();
      EventBus.removeAll();
      this.scene.start('HubScene');
    });

    // Afficher le fait_scientifique en overlay 3s au démarrage
    this.showFaitScientifique();

    // Timer si durée max
    if (this.jeu.duree_max_seconds) {
      this.remainingTime = this.jeu.duree_max_seconds;
      this.startTimer();
    }

    // Listen for game over
    EventBus.on(EVENTS.GAME_OVER, this.handleGameOver.bind(this));
  }

  /** Override in subclass to implement game logic */
  protected abstract setupGameplay(): void;

  private showFaitScientifique(): void {
    const { width, height } = this.scale;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.85);
    overlay.setDepth(100);

    const text = this.add.text(width / 2, height / 2, this.jeu.fait_scientifique, {
      fontSize: '30px',
      color: '#ffcc44',
      fontFamily: 'Arial',
      fontStyle: 'italic',
      align: 'center',
      wordWrap: { width: width * 0.8 },
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(101);

    const label = this.add.text(width / 2, height * 0.3, 'Le savais-tu ?', {
      fontSize: '40px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(101);

    // Disparaît après 3 secondes puis lance le gameplay
    this.time.delayedCall(3000, () => {
      overlay.destroy();
      text.destroy();
      label.destroy();
      EventBus.emit(EVENTS.FAIT_SCIENTIFIQUE_SHOWN);
      this.setupGameplay();
    });
  }

  private startTimer(): void {
    GameState.setTimer(this.remainingTime);
    this.timerEvent = this.time.addEvent({
      delay: 1000,
      repeat: this.remainingTime - 1,
      callback: () => {
        this.remainingTime--;
        GameState.setTimer(this.remainingTime);
        if (this.remainingTime <= 0) {
          EventBus.emit(EVENTS.TIMER_END);
          GameState.triggerGameOver();
        }
      },
    });
  }

  private handleGameOver(): void {
    if (this.timerEvent) {
      this.timerEvent.destroy();
    }
    this.time.delayedCall(500, () => {
      this.scene.stop('UIScene');
      this.scene.start('GameOverScene');
    });
  }

  shutdown(): void {
    EventBus.off(EVENTS.GAME_OVER, this.handleGameOver.bind(this));
    if (this.timerEvent) {
      this.timerEvent.destroy();
    }
  }
}
