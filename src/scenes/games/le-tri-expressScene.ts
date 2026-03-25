/**
 * LeTriExpressScene — Sorting game: trier les déchets dans les bonnes poubelles.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Waste {
  container: Phaser.GameObjects.Container;
  type: number; // 0=verre, 1=plastique, 2=compost
  isSpecial: boolean;
  speed: number;
}

const WASTE_TYPES = [
  { name: 'Verre', color: 0x44ff88, emoji: '🍾' },
  { name: 'Plastique', color: 0xff8844, emoji: '🧴' },
  { name: 'Compost', color: 0x886633, emoji: '🍌' },
];

export class LeTriExpressScene extends BaseGameScene {
  private wastes: Waste[] = [];
  private bins: Phaser.GameObjects.Container[] = [];
  private binPositions: number[] = [];
  private draggedWaste: Waste | null = null;
  private dragOffsetX: number = 0;
  private dragOffsetY: number = 0;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private specialTimer: Phaser.Time.TimerEvent | null = null;
  private gameLoopTimer: Phaser.Time.TimerEvent | null = null;
  private fallSpeed: number = 1.5;

  constructor() {
    super('GameScene_le-tri-express');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Règle: 3 poubelles en bas : verre, plastique, compost
    const binWidth = width / 3 - 20;
    for (let i = 0; i < 3; i++) {
      const x = width / 6 + i * (width / 3);
      const y = height - 80;
      this.binPositions.push(x);

      const rect = this.add.rectangle(0, 0, binWidth, 80, WASTE_TYPES[i].color, 0.6)
        .setStrokeStyle(2, WASTE_TYPES[i].color);
      const label = this.add.text(0, 0, WASTE_TYPES[i].name, {
        fontSize: '18px', color: '#ffffff', fontFamily: 'Arial',
      }).setOrigin(0.5);
      const emoji = this.add.text(0, -25, WASTE_TYPES[i].emoji, {
        fontSize: '28px',
      }).setOrigin(0.5);

      const container = this.add.container(x, y, [rect, label, emoji]);
      this.bins.push(container);
    }

    // Règle: Des déchets tombent du haut de l'écran
    this.spawnTimer = this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => this.spawnWaste(false),
    });

    // Règle: Bonus : objet recyclé spécial toutes les 15s (+scoring.objet_special pts)
    this.specialTimer = this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => this.spawnWaste(true),
    });

    // Règle: Swipe le déchet vers la bonne poubelle
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      for (const w of this.wastes) {
        const bounds = w.container.getBounds();
        if (bounds.contains(pointer.x, pointer.y)) {
          this.draggedWaste = w;
          this.dragOffsetX = pointer.x - w.container.x;
          this.dragOffsetY = pointer.y - w.container.y;
          break;
        }
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.draggedWaste) {
        this.draggedWaste.container.x = pointer.x - this.dragOffsetX;
        this.draggedWaste.container.y = pointer.y - this.dragOffsetY;
      }
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.draggedWaste) return;
      this.checkBinDrop(this.draggedWaste, pointer);
      this.draggedWaste = null;
    });

    // Game loop for falling wastes
    this.gameLoopTimer = this.time.addEvent({
      delay: 30,
      loop: true,
      callback: () => this.gameLoop(),
    });

    // Increase speed over time
    this.time.addEvent({
      delay: 10000,
      loop: true,
      callback: () => { this.fallSpeed += 0.3; },
    });
  }

  private spawnWaste(isSpecial: boolean): void {
    const { width } = this.scale;
    const type = Phaser.Math.Between(0, 2);
    const x = Phaser.Math.Between(60, width - 60);

    const color = isSpecial ? 0xffd700 : WASTE_TYPES[type].color;
    const rect = this.add.rectangle(0, 0, 50, 50, color)
      .setStrokeStyle(isSpecial ? 3 : 1, 0xffffff);
    const emoji = this.add.text(0, 0, isSpecial ? '♻️' : WASTE_TYPES[type].emoji, {
      fontSize: '28px',
    }).setOrigin(0.5);

    const container = this.add.container(x, -40, [rect, emoji]);
    this.wastes.push({ container, type, isSpecial, speed: this.fallSpeed });
  }

  private checkBinDrop(waste: Waste, pointer: Phaser.Input.Pointer): void {
    const { height } = this.scale;
    const scoring = this.jeu.scoring;

    // Check if dropped near a bin
    for (let i = 0; i < this.bins.length; i++) {
      const bin = this.bins[i];
      const dist = Math.abs(waste.container.x - bin.x);
      const yClose = waste.container.y > height - 160;

      if (dist < 80 && yClose) {
        if (waste.isSpecial) {
          // Règle: Bonus : objet recyclé spécial toutes les 15s (+scoring.objet_special pts)
          GameState.addScore(scoring.objet_special || 30);
        } else if (i === waste.type) {
          // Règle: Bon tri = +scoring.bon_tri pts, +scoring.solidarite_bon solidarité
          GameState.addScore(scoring.bon_tri || 10);
          GameState.addSolidarite(scoring.solidarite_bon || 2);
        } else {
          // Règle: Mauvais tri = scoring.mauvais_tri pts, scoring.solidarite_mauvais solidarité
          GameState.addScore(scoring.mauvais_tri || -5);
          GameState.addSolidarite(scoring.solidarite_mauvais || -1);
        }

        // Remove waste
        this.removeWaste(waste);
        return;
      }
    }
    // Not dropped in a bin — let it continue falling
  }

  private removeWaste(waste: Waste): void {
    const idx = this.wastes.indexOf(waste);
    if (idx !== -1) {
      waste.container.destroy();
      this.wastes.splice(idx, 1);
    }
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;
    const { height } = this.scale;

    for (let i = this.wastes.length - 1; i >= 0; i--) {
      const w = this.wastes[i];
      if (w === this.draggedWaste) continue; // Don't move dragged item

      w.container.y += w.speed;

      // Règle: Déchet non trié qui touche le sol = -1 vie
      if (w.container.y > height - 20) {
        GameState.loseLife();
        w.container.destroy();
        this.wastes.splice(i, 1);
      }
    }
  }

  shutdown(): void {
    super.shutdown();
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.specialTimer) this.specialTimer.destroy();
    if (this.gameLoopTimer) this.gameLoopTimer.destroy();
  }
}

registerScene('le-tri-express', LeTriExpressScene);
