/**
 * LeMoulinAVentScene — Rhythm: tap en rythme pour faire tourner les pales.
 * Le vent souffle avec un rythme variable, tap au bon moment = énergie.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

export class LeMoulinAVentScene extends BaseGameScene {
  private pales!: Phaser.GameObjects.Rectangle[];
  private paleContainer!: Phaser.GameObjects.Container;
  private windIndicator!: Phaser.GameObjects.Rectangle;
  private windMarker!: Phaser.GameObjects.Rectangle;
  private energyBarBg!: Phaser.GameObjects.Rectangle;
  private energyBar!: Phaser.GameObjects.Rectangle;
  private energy: number = 0;
  private energyMax: number = 100;
  private beatPhase: number = 0;
  private beatSpeed: number = 0.03; // radians per frame
  private perfectZoneMin: number = 0.8;
  private perfectZoneMax: number = 1.0;
  private goodZoneMin: number = 0.6;
  private consecutivePerfect: number = 0;
  private rotationSpeed: number = 0;
  private villageIcons: Phaser.GameObjects.Text[] = [];
  private villageLights: Phaser.GameObjects.Rectangle[] = [];
  private gameLoopTimer: Phaser.Time.TimerEvent | null = null;
  private feedbackText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene_le-moulin-a-vent');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Moulin base
    this.add.rectangle(width / 2, height * 0.55, 20, 120, 0x8B4513);

    // Pales (4 rectangles in a container)
    this.pales = [];
    this.paleContainer = this.add.container(width / 2, height * 0.42);
    const paleColors = [0xcccccc, 0xbbbbbb, 0xaaaaaa, 0x999999];
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI) / 2;
      const px = Math.cos(angle) * 50;
      const py = Math.sin(angle) * 50;
      const pale = this.add.rectangle(px, py, 15, 80, paleColors[i]);
      pale.setRotation(angle);
      this.pales.push(pale);
      this.paleContainer.add(pale);
    }

    // Règle: Le vent souffle avec un rythme variable (indicateur visuel)
    const indicatorW = width * 0.7;
    this.add.rectangle(width / 2, height * 0.78, indicatorW, 30, 0x333333);

    // Perfect zone highlight
    const pzX = width / 2 - indicatorW / 2 + indicatorW * this.perfectZoneMin;
    const pzW = indicatorW * (this.perfectZoneMax - this.perfectZoneMin);
    this.add.rectangle(pzX + pzW / 2, height * 0.78, pzW, 30, 0x44aa44, 0.4);

    // Good zone highlight
    const gzX = width / 2 - indicatorW / 2 + indicatorW * this.goodZoneMin;
    const gzW = indicatorW * (this.perfectZoneMin - this.goodZoneMin);
    this.add.rectangle(gzX + gzW / 2, height * 0.78, gzW, 30, 0xaaaa44, 0.3);

    // Moving wind marker (oscillates)
    this.windMarker = this.add.rectangle(width / 2, height * 0.78, 6, 35, 0xffffff);

    // Energy gauge
    this.add.text(width - 50, height * 0.15, 'Énergie', {
      fontSize: '14px', color: '#ffcc44',
    }).setOrigin(0.5);
    this.energyBarBg = this.add.rectangle(width - 50, height * 0.45, 25, height * 0.45, 0x333333);
    this.energyBar = this.add.rectangle(
      width - 50, height * 0.45 + height * 0.225, 25, 0, 0x44cc44
    ).setOrigin(0.5, 1);

    // Feedback text
    this.feedbackText = this.add.text(width / 2, height * 0.68, '', {
      fontSize: '22px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Règle: Remplir la jauge d'énergie pour alimenter le village
    // Village houses at bottom
    for (let i = 0; i < 5; i++) {
      const hx = width * 0.15 + i * (width * 0.15);
      const icon = this.add.text(hx, height * 0.92, '🏠', { fontSize: '24px' }).setOrigin(0.5);
      this.villageIcons.push(icon);
      const light = this.add.rectangle(hx, height * 0.88, 12, 12, 0x555555);
      this.villageLights.push(light);
    }

    // Règle: Tap en rythme pour faire tourner les pales du moulin
    this.input.on('pointerdown', () => {
      this.handleTap();
    });

    // Game loop
    this.gameLoopTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.gameLoop(),
    });
  }

  private handleTap(): void {
    if (GameState.isGameOver) return;
    const scoring = this.jeu.scoring;

    // Calculate where the wind marker is (0..1 range)
    const markerPos = (Math.sin(this.beatPhase) + 1) / 2;

    if (markerPos >= this.perfectZoneMin && markerPos <= this.perfectZoneMax) {
      // Règle: Tap au bon moment = production d'énergie (+scoring.tap_parfait pts)
      GameState.addScore(scoring.tap_parfait);
      this.energy = Math.min(this.energyMax, this.energy + 5);
      this.rotationSpeed = Math.min(0.15, this.rotationSpeed + 0.02);
      this.consecutivePerfect++;
      this.showFeedback('Parfait !', '#44ff44');

      // Règle: Bonus : série de 10 taps parfaits = tempête d'énergie (+scoring.serie_10 pts)
      if (this.consecutivePerfect >= 10) {
        GameState.addScore(scoring.serie_10);
        this.energy = Math.min(this.energyMax, this.energy + 20);
        this.consecutivePerfect = 0;
        this.showFeedback('TEMPÊTE D\'ÉNERGIE !', '#ffd700');
      }
    } else if (markerPos >= this.goodZoneMin) {
      // Règle: Tap bon mais pas parfait
      GameState.addScore(scoring.tap_bon);
      this.energy = Math.min(this.energyMax, this.energy + 2);
      this.rotationSpeed = Math.min(0.15, this.rotationSpeed + 0.01);
      this.consecutivePerfect = 0;
      this.showFeedback('Bon !', '#aaaa44');
    } else {
      // Règle: Tap hors rythme = perte d'élan (+scoring.tap_rate pts — it's negative)
      GameState.addScore(scoring.tap_rate);
      this.rotationSpeed = Math.max(0, this.rotationSpeed - 0.03);
      this.consecutivePerfect = 0;
      this.showFeedback('Raté !', '#ff4444');
    }

    // Update energy bar
    const barH = (this.energy / this.energyMax) * this.scale.height * 0.45;
    this.energyBar.setSize(25, barH);

    // Update village lights based on energy
    const litCount = Math.floor((this.energy / this.energyMax) * this.villageLights.length);
    for (let i = 0; i < this.villageLights.length; i++) {
      this.villageLights[i].setFillStyle(i < litCount ? 0xffdd44 : 0x555555);
    }

    // Règle: Remplir la jauge d'énergie pour alimenter le village
    if (this.energy >= this.energyMax) {
      GameState.addScore(scoring.village_alimente);
      this.completeLevel();
    }
  }

  private showFeedback(msg: string, color: string): void {
    this.feedbackText.setText(msg).setColor(color).setAlpha(1);
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
    });
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;

    const { width } = this.scale;
    const indicatorW = width * 0.7;

    // Oscillate wind marker
    this.beatPhase += this.beatSpeed;
    // Règle: Le vent souffle avec un rythme variable
    // Gradually increase speed for difficulty
    this.beatSpeed = 0.03 + GameState.score * 0.00002;

    const markerPos = (Math.sin(this.beatPhase) + 1) / 2;
    this.windMarker.setX(width / 2 - indicatorW / 2 + markerPos * indicatorW);

    // Rotate pales
    this.paleContainer.setRotation(this.paleContainer.rotation + this.rotationSpeed);

    // Natural slowdown
    this.rotationSpeed = Math.max(0, this.rotationSpeed - 0.0005);
  }

  private completeLevel(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.5, 'Village alimenté !', {
      fontSize: '30px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.time.delayedCall(2000, () => {
      GameState.triggerGameOver();
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.gameLoopTimer) this.gameLoopTimer.destroy();
  }
}

registerScene('le-moulin-a-vent', LeMoulinAVentScene);
