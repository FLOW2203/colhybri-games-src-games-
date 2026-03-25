/**
 * ZoneDeConvergenceScene — Multiplayer coop: jauge collective solidaire.
 * Tap, swipe, shake pour contribuer. Paliers = projets réels.
 * SPECIAL: social="Zone_de_Convergence" — logs convergence events to Supabase.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';
import { logConvergenceEvent } from '../../core/SupabaseClient';

interface Palier {
  percent: number;
  label: string;
  emoji: string;
  reached: boolean;
  bonus: number;
}

export class ZoneDeConvergenceScene extends BaseGameScene {
  private jaugeBarBg!: Phaser.GameObjects.Rectangle;
  private jaugeBar!: Phaser.GameObjects.Rectangle;
  private jaugeMax: number = 500;
  private jaugeValue: number = 0;
  private paliers: Palier[] = [];
  private palierMarkers: Phaser.GameObjects.Container[] = [];
  private eventTimer: number = 60; // Règle: Événement limité dans le temps (60s for single player)
  private timerText!: Phaser.GameObjects.Text;
  private convergenceTimerEvent: Phaser.Time.TimerEvent | null = null;
  private contributionText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private lastTapTime: number = 0;
  private syncCount: number = 0;
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private shakeThreshold: number = 20;
  private lastPointerX: number = 0;
  private lastPointerY: number = 0;
  private comboMultiplier: number = 1;
  private comboTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('GameScene_zone-de-convergence');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    this.add.text(width / 2, height * 0.04, 'Zone de Convergence', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width / 2, height * 0.1, 'Tapez, swipez, secouez pour contribuer !', {
      fontSize: '15px', color: '#aaaaaa', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Tous les joueurs contribuent à une jauge collective
    // Collective gauge
    this.jaugeBarBg = this.add.rectangle(width / 2, height * 0.5, width * 0.15, height * 0.55, 0x333333);
    this.jaugeBarBg.setStrokeStyle(2, 0x555555);
    this.jaugeBar = this.add.rectangle(
      width / 2, height * 0.5 + height * 0.275, width * 0.13, 0, 0x44cc44
    ).setOrigin(0.5, 1);

    // Règle: La jauge représente un projet solidaire réel
    // Paliers: 25%, 50%, 75%, 100%
    this.paliers = [
      { percent: 25, label: 'Arbre planté', emoji: '🌳', reached: false, bonus: scoring.palier_25 },
      { percent: 50, label: 'Repas offerts', emoji: '🍽️', reached: false, bonus: scoring.palier_50 },
      { percent: 75, label: 'Kit scolaire', emoji: '📚', reached: false, bonus: scoring.palier_75 },
      { percent: 100, label: 'Projet financé', emoji: '🏗️', reached: false, bonus: scoring.palier_100 },
    ];

    // Draw palier markers
    for (const palier of this.paliers) {
      const py = height * 0.5 + height * 0.275 - (palier.percent / 100) * height * 0.55;

      const marker = this.add.rectangle(width / 2 + width * 0.12, py, 20, 3, 0x888888);
      const label = this.add.text(width / 2 + width * 0.18, py, `${palier.percent}% ${palier.emoji}`, {
        fontSize: '13px', color: '#888888',
      }).setOrigin(0, 0.5);
      const nameLabel = this.add.text(width / 2 + width * 0.18, py + 15, palier.label, {
        fontSize: '11px', color: '#666666',
      }).setOrigin(0, 0.5);

      const container = this.add.container(0, 0, [marker, label, nameLabel]);
      this.palierMarkers.push(container);
    }

    // Timer display
    this.timerText = this.add.text(width / 2, height * 0.88, `⏱ ${this.eventTimer}s`, {
      fontSize: '22px', color: '#ffcc44', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Contribution feedback
    this.contributionText = this.add.text(width / 2, height * 0.15, '', {
      fontSize: '16px', color: '#88ff88',
    }).setOrigin(0.5);

    this.feedbackText = this.add.text(width / 2, height * 0.82, '', {
      fontSize: '20px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Règle: Chaque action (tap, swipe, shake) ajoute à la jauge
    // Tap input
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
      this.handleTap();
    });

    // Swipe detection
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 60) {
        this.handleSwipe();
      }
    });

    // Shake detection (rapid pointer movement)
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown) return;
      const dx = Math.abs(pointer.x - this.lastPointerX);
      const dy = Math.abs(pointer.y - this.lastPointerY);
      if (dx + dy > this.shakeThreshold) {
        this.handleShake();
      }
      this.lastPointerX = pointer.x;
      this.lastPointerY = pointer.y;
    });

    // Règle: Événement limité dans le temps (simulated 60s for single player)
    this.convergenceTimerEvent = this.time.addEvent({
      delay: 1000,
      repeat: this.eventTimer - 1,
      callback: () => {
        this.eventTimer--;
        this.timerText.setText(`⏱ ${this.eventTimer}s`);
        if (this.eventTimer <= 0) {
          this.endEvent();
        }
      },
    });
  }

  private addContribution(amount: number, source: string): void {
    if (GameState.isGameOver) return;
    const scoring = this.jeu.scoring;

    // Règle: Bonus : actions synchronisées entre joueurs = x3 contribution
    // Simulate sync: rapid actions within 500ms count as "synchronized"
    const now = this.time.now;
    if (now - this.lastTapTime < 500) {
      this.syncCount++;
      if (this.syncCount >= 3) {
        this.comboMultiplier = scoring.sync_multiplier;
        this.contributionText.setText(`x${this.comboMultiplier} SYNC !`).setColor('#ffd700');
        this.syncCount = 0;

        // Reset multiplier after 2s
        if (this.comboTimer) this.comboTimer.destroy();
        this.comboTimer = this.time.delayedCall(2000, () => {
          this.comboMultiplier = 1;
          this.contributionText.setText('');
        });
      }
    } else {
      this.syncCount = 0;
    }
    this.lastTapTime = now;

    const contribution = amount * scoring.contribution * this.comboMultiplier;
    this.jaugeValue = Math.min(this.jaugeMax, this.jaugeValue + contribution);
    GameState.addScore(contribution);

    // Update gauge visual
    const { height } = this.scale;
    const barH = (this.jaugeValue / this.jaugeMax) * height * 0.55;
    this.jaugeBar.setSize(this.scale.width * 0.13, barH);

    // Color gradient based on progress
    const progress = this.jaugeValue / this.jaugeMax;
    if (progress >= 0.75) {
      this.jaugeBar.setFillStyle(0x44ff44);
    } else if (progress >= 0.5) {
      this.jaugeBar.setFillStyle(0x88cc44);
    } else if (progress >= 0.25) {
      this.jaugeBar.setFillStyle(0xaaaa44);
    }

    // Check paliers
    this.checkPaliers();
  }

  private handleTap(): void {
    this.addContribution(1, 'tap');
  }

  private handleSwipe(): void {
    this.addContribution(3, 'swipe');
  }

  private handleShake(): void {
    this.addContribution(0.5, 'shake');
  }

  // Règle: Paliers : 25% = arbre planté, 50% = repas offerts, 75% = kit scolaire, 100% = projet financé
  private checkPaliers(): void {
    const progress = (this.jaugeValue / this.jaugeMax) * 100;

    for (let i = 0; i < this.paliers.length; i++) {
      const palier = this.paliers[i];
      if (!palier.reached && progress >= palier.percent) {
        palier.reached = true;
        GameState.addScore(palier.bonus);
        GameState.addSolidarite(10);

        // Show palier feedback
        this.feedbackText.setText(`${palier.emoji} ${palier.label} !`).setAlpha(1);
        this.tweens.add({
          targets: this.feedbackText,
          alpha: 0,
          duration: 2000,
          ease: 'Power2',
        });

        // Update palier marker color
        const container = this.palierMarkers[i];
        if (container && container.list.length > 1) {
          (container.list[1] as Phaser.GameObjects.Text).setColor('#44ff44');
        }

        // SPECIAL: Log convergence event to Supabase
        const palierLabel = `${palier.percent}%`;
        logConvergenceEvent(this.jaugeValue, palierLabel);

        // Règle: 100% = projet financé
        if (palier.percent === 100) {
          this.completeProject();
        }
      }
    }
  }

  private completeProject(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.4, 'PROJET FINANCÉ !', {
      fontSize: '32px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 4,
    }).setOrigin(0.5).setDepth(10);

    this.time.delayedCall(3000, () => {
      GameState.triggerGameOver();
    });
  }

  private endEvent(): void {
    if (GameState.isGameOver) return;

    const { width, height } = this.scale;
    const progress = Math.floor((this.jaugeValue / this.jaugeMax) * 100);

    this.add.text(width / 2, height * 0.4, `Temps écoulé ! ${progress}%`, {
      fontSize: '26px', color: '#ffcc44', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.time.delayedCall(2000, () => {
      GameState.triggerGameOver();
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.convergenceTimerEvent) this.convergenceTimerEvent.destroy();
    if (this.comboTimer) this.comboTimer.destroy();
  }
}

registerScene('zone-de-convergence', ZoneDeConvergenceScene);
