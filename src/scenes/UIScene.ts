/**
 * UIScene — Lancée en parallèle du jeu.
 * Affiche : score, vies, jauge solidarité, timer.
 */
import Phaser from 'phaser';
import { EventBus, EVENTS } from '../core/EventBus';
import { GameState } from '../core/GameState';
import { Constants } from '../core/Constants';

export class UIScene extends Phaser.Scene {
  private scoreText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private solidariteBar!: Phaser.GameObjects.Rectangle;
  private solidariteBarBg!: Phaser.GameObjects.Rectangle;
  private timerText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: 'UIScene' });
  }

  create(): void {
    const { width } = this.scale;
    const padding = 30;
    const topY = 50;

    // Score
    this.scoreText = this.add.text(padding, topY, 'Score: 0', {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    });

    // Lives
    this.livesText = this.add.text(width - padding, topY, `Vies: ${GameState.lives}`, {
      fontSize: '32px',
      color: '#ff6666',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(1, 0);

    // Timer
    this.timerText = this.add.text(width / 2, topY, '', {
      fontSize: '32px',
      color: '#ffcc44',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5, 0);

    // Solidarité bar
    const barW = width - padding * 2;
    const barH = 20;
    const barY = topY + 50;

    this.solidariteBarBg = this.add.rectangle(
      width / 2, barY, barW, barH, 0x333333
    );

    this.solidariteBar = this.add.rectangle(
      padding, barY, 0, barH - 4, 0x44cc88
    ).setOrigin(0, 0.5);

    this.add.text(padding, barY + 18, 'Solidarité', {
      fontSize: '18px',
      color: '#44cc88',
      fontFamily: 'Arial',
    });

    // Event listeners
    EventBus.on(EVENTS.SCORE_CHANGE, this.onScoreChange.bind(this));
    EventBus.on(EVENTS.LIFE_LOST, this.onLifeChange.bind(this));
    EventBus.on(EVENTS.LIFE_GAINED, this.onLifeChange.bind(this));
    EventBus.on(EVENTS.SOLIDARITE_CHANGE, this.onSolidariteChange.bind(this));
    EventBus.on(EVENTS.TIMER_TICK, this.onTimerTick.bind(this));
    EventBus.on(EVENTS.GAME_OVER, this.onGameOver.bind(this));

    // Set depth so UI is always on top
    this.scene.bringToTop();
  }

  private onScoreChange(score: unknown): void {
    this.scoreText.setText(`Score: ${score}`);
  }

  private onLifeChange(lives: unknown): void {
    this.livesText.setText(`Vies: ${lives}`);
  }

  private onSolidariteChange(value: unknown): void {
    const max = Constants.scoringGlobal.jauge_solidarite_max;
    const { width } = this.scale;
    const padding = 30;
    const barW = width - padding * 2;
    const ratio = (value as number) / max;
    this.solidariteBar.width = barW * ratio;
  }

  private onTimerTick(seconds: unknown): void {
    const s = seconds as number;
    if (s > 0) {
      const min = Math.floor(s / 60);
      const sec = s % 60;
      this.timerText.setText(`${min}:${sec.toString().padStart(2, '0')}`);
    } else {
      this.timerText.setText('');
    }
  }

  private onGameOver(): void {
    this.cleanup();
    this.scene.stop();
  }

  private cleanup(): void {
    EventBus.off(EVENTS.SCORE_CHANGE, this.onScoreChange.bind(this));
    EventBus.off(EVENTS.LIFE_LOST, this.onLifeChange.bind(this));
    EventBus.off(EVENTS.LIFE_GAINED, this.onLifeChange.bind(this));
    EventBus.off(EVENTS.SOLIDARITE_CHANGE, this.onSolidariteChange.bind(this));
    EventBus.off(EVENTS.TIMER_TICK, this.onTimerTick.bind(this));
    EventBus.off(EVENTS.GAME_OVER, this.onGameOver.bind(this));
  }

  shutdown(): void {
    this.cleanup();
  }
}
