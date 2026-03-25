/**
 * LaGrainothequeScene — Collection: collecter des graines pour compléter un catalogue.
 * Tap pour collecter, variétés complètes, graines rares.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Variete {
  name: string;
  color: number;
  emoji: string;
  collected: number;
  target: number;
  complete: boolean;
}

interface FallingGraine {
  container: Phaser.GameObjects.Container;
  varieteIndex: number;
  isRare: boolean;
  speed: number;
}

export class LaGrainothequeScene extends BaseGameScene {
  private varietes: Variete[] = [];
  private fallingGraines: FallingGraine[] = [];
  private catalogueText!: Phaser.GameObjects.Text;
  private completedCount: number = 0;
  private catalogueTarget: number = 8; // 8 variétés to collect for level completion
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private gameLoopTimer: Phaser.Time.TimerEvent | null = null;
  private catalogueCards: Phaser.GameObjects.Rectangle[] = [];
  private catalogueLabels: Phaser.GameObjects.Text[] = [];

  private varietyDefs = [
    { name: 'Tomate', color: 0xff4444, emoji: '🍅' },
    { name: 'Carotte', color: 0xff8844, emoji: '🥕' },
    { name: 'Laitue', color: 0x44cc44, emoji: '🥬' },
    { name: 'Tournesol', color: 0xffdd44, emoji: '🌻' },
    { name: 'Lavande', color: 0x9944cc, emoji: '💜' },
    { name: 'Basilic', color: 0x22aa22, emoji: '🌿' },
    { name: 'Fraise', color: 0xee3355, emoji: '🍓' },
    { name: 'Courgette', color: 0x55aa33, emoji: '🥒' },
  ];

  constructor() {
    super('GameScene_la-grainoteque');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.04, 'Grainothèque', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Règle: Compléter le catalogue de variétés pour finir le niveau
    // Initialize varieties
    this.varietes = this.varietyDefs.map(v => ({
      ...v, collected: 0, target: 3, complete: false,
    }));

    // Catalogue display at top
    const cardW = width / this.varietes.length - 4;
    for (let i = 0; i < this.varietes.length; i++) {
      const cx = cardW / 2 + 2 + i * (cardW + 4);
      const card = this.add.rectangle(cx, height * 0.11, cardW - 2, 30, 0x333333);
      card.setStrokeStyle(1, 0x666666);
      this.catalogueCards.push(card);
      const lbl = this.add.text(cx, height * 0.11, this.varietes[i].emoji, {
        fontSize: '14px',
      }).setOrigin(0.5).setAlpha(0.4);
      this.catalogueLabels.push(lbl);
    }

    this.catalogueText = this.add.text(width / 2, height * 0.16, `0/${this.catalogueTarget} variétés`, {
      fontSize: '16px', color: '#aaaaaa',
    }).setOrigin(0.5);

    // Règle: Des graines de différentes variétés apparaissent sur l'écran
    this.spawnTimer = this.time.addEvent({
      delay: 700,
      loop: true,
      callback: () => this.spawnGraine(),
    });

    // Règle: Tap pour les collecter dans ton sachet
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.tryCollect(pointer.x, pointer.y);
    });

    // Game loop for falling graines
    this.gameLoopTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.gameLoop(),
    });
  }

  private spawnGraine(): void {
    const { width } = this.scale;
    const scoring = this.jeu.scoring;

    const vIdx = Phaser.Math.Between(0, this.varietes.length - 1);
    const v = this.varietes[vIdx];

    // Règle: Les graines rares brillent et valent plus de points (+scoring.graine_rare)
    const isRare = Phaser.Math.Between(1, 12) === 1; // ~8% chance

    const x = Phaser.Math.Between(40, width - 40);
    const size = isRare ? 40 : 28;
    const color = isRare ? 0xffd700 : v.color;

    const rect = this.add.rectangle(0, 0, size, size, color);
    if (isRare) {
      rect.setStrokeStyle(3, 0xffffff);
    }
    const label = this.add.text(0, 0, v.emoji, {
      fontSize: isRare ? '22px' : '16px',
    }).setOrigin(0.5);

    const container = this.add.container(x, -30, [rect, label]);

    this.fallingGraines.push({
      container,
      varieteIndex: vIdx,
      isRare,
      speed: Phaser.Math.Between(15, 25) / 10,
    });
  }

  private tryCollect(px: number, py: number): void {
    const scoring = this.jeu.scoring;

    for (let i = this.fallingGraines.length - 1; i >= 0; i--) {
      const g = this.fallingGraines[i];
      const dx = Math.abs(g.container.x - px);
      const dy = Math.abs(g.container.y - py);

      if (dx < 45 && dy < 45) {
        const v = this.varietes[g.varieteIndex];

        if (g.isRare) {
          // Règle: Les graines rares brillent et valent plus de points
          GameState.addScore(scoring.graine_rare);
        } else {
          // Règle: Tap pour les collecter dans ton sachet
          GameState.addScore(scoring.graine_collectee);
        }

        // Track variety collection
        if (!v.complete) {
          v.collected++;
          // Règle: Chaque variété complète une page du catalogue (+scoring.variete_complete pts)
          if (v.collected >= v.target && !v.complete) {
            v.complete = true;
            this.completedCount++;
            GameState.addScore(scoring.variete_complete);

            // Update catalogue card
            this.catalogueCards[g.varieteIndex].setFillStyle(v.color);
            this.catalogueLabels[g.varieteIndex].setAlpha(1);
            this.catalogueText.setText(`${this.completedCount}/${this.catalogueTarget} variétés`);

            // Règle: Compléter le catalogue pour finir le niveau
            if (this.completedCount >= this.catalogueTarget) {
              GameState.addScore(scoring.catalogue_complet);
              this.completeLevel();
            }
          }
        } else {
          // Règle: Échanger des doublons avec d'autres jardiniers (+solidarité)
          GameState.addScore(scoring.echange);
          GameState.addSolidarite(3);
        }

        // Remove collected graine
        g.container.destroy();
        this.fallingGraines.splice(i, 1);
        return; // Only collect one per tap
      }
    }
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;

    const { height } = this.scale;

    for (let i = this.fallingGraines.length - 1; i >= 0; i--) {
      const g = this.fallingGraines[i];
      g.container.y += g.speed;

      if (g.container.y > height + 50) {
        g.container.destroy();
        this.fallingGraines.splice(i, 1);
      }
    }
  }

  private completeLevel(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.5, 'Catalogue complet !', {
      fontSize: '30px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.time.delayedCall(2000, () => {
      GameState.triggerGameOver();
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.gameLoopTimer) this.gameLoopTimer.destroy();
  }
}

registerScene('la-grainoteque', LaGrainothequeScene);
