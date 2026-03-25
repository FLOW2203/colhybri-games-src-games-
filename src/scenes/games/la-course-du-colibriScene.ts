/**
 * LaCourseDuColibriScene — Runner vertical.
 * Le colibri monte automatiquement, swipe pour changer de couloir.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

export class LaCourseDuColibriScene extends BaseGameScene {
  private colibri!: Phaser.GameObjects.Rectangle;
  private lane: number = 1; // 0=left, 1=center, 2=right
  private lanePositions: number[] = [];
  private drops: Phaser.GameObjects.Container[] = [];
  private braises: Phaser.GameObjects.Container[] = [];
  private goldenDropsCollected: number = 0;
  private isSolidarityMode: boolean = false;
  private solidarityTimer: Phaser.Time.TimerEvent | null = null;
  private speed: number = 2;
  private speedTimer: Phaser.Time.TimerEvent | null = null;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private braiseSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private distanceTraveled: number = 0;
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;

  constructor() {
    super('GameScene_la-course-du-colibri');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: 3 couloirs
    const laneWidth = width / 3;
    this.lanePositions = [
      laneWidth * 0.5,
      laneWidth * 1.5,
      laneWidth * 2.5,
    ];

    // Règle: Le colibri avance automatiquement vers le haut
    this.colibri = this.add.rectangle(
      this.lanePositions[this.lane], height * 0.8, 50, 50, 0x00cc66
    );
    this.add.text(this.lanePositions[this.lane], height * 0.8, '🐦', {
      fontSize: '36px',
    }).setOrigin(0.5).setDepth(1);

    // Règle: Swipe gauche/droite pour changer de couloir
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;
      if (Math.abs(dx) > 30 && Math.abs(dx) > Math.abs(dy)) {
        if (dx < 0 && this.lane > 0) {
          this.lane--;
        } else if (dx > 0 && this.lane < 2) {
          this.lane++;
        }
        this.colibri.setX(this.lanePositions[this.lane]);
      }
    });

    // Règle: Collecter les gouttes d'eau (+scoring.goutte pts)
    this.spawnTimer = this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => this.spawnDrop(),
    });

    // Règle: Éviter les braises volantes (-1 vie)
    this.braiseSpawnTimer = this.time.addEvent({
      delay: 1500,
      loop: true,
      callback: () => this.spawnBraise(),
    });

    // Règle: La vitesse augmente toutes les 30 secondes
    this.speedTimer = this.time.addEvent({
      delay: 30000,
      loop: true,
      callback: () => {
        this.speed += 0.5;
      },
    });

    // Main game loop
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.gameLoop(),
    });
  }

  private spawnDrop(): void {
    const { width } = this.scale;
    const laneIdx = Phaser.Math.Between(0, 2);
    const x = this.lanePositions[laneIdx];
    const isGolden = Phaser.Math.Between(1, 10) === 1; // 10% chance golden

    const color = isGolden ? 0xffd700 : 0x00aaff;
    const rect = this.add.rectangle(0, 0, 30, 30, color);
    const label = this.add.text(0, 0, isGolden ? '✦' : '💧', {
      fontSize: '24px',
    }).setOrigin(0.5);

    const container = this.add.container(x, -30, [rect, label]);
    (container as any).isGolden = isGolden;
    this.drops.push(container);
  }

  private spawnBraise(): void {
    const laneIdx = Phaser.Math.Between(0, 2);
    const x = this.lanePositions[laneIdx];

    const rect = this.add.rectangle(0, 0, 35, 35, 0xff4400);
    const label = this.add.text(0, 0, '🔥', {
      fontSize: '24px',
    }).setOrigin(0.5);

    const container = this.add.container(x, -30, [rect, label]);
    this.braises.push(container);
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;

    const { height } = this.scale;
    const scoring = this.jeu.scoring;
    const colibriY = this.colibri.y;
    const colibriX = this.colibri.x;

    // Règle: Distance bonus
    this.distanceTraveled += this.speed * 0.01;
    if (Math.floor(this.distanceTraveled) > Math.floor(this.distanceTraveled - this.speed * 0.01)) {
      GameState.addScore(scoring.distance_bonus || 1);
    }

    // Move drops down
    for (let i = this.drops.length - 1; i >= 0; i--) {
      const drop = this.drops[i];
      drop.y += this.speed * 2;

      // Check collision with colibri
      if (Math.abs(drop.x - colibriX) < 40 && Math.abs(drop.y - colibriY) < 40) {
        const isGolden = (drop as any).isGolden;
        if (isGolden) {
          // Règle: Collecter 3 gouttes dorées active le mode solidarité (invincible 5s)
          GameState.addScore(scoring.goutte_doree || 50);
          this.goldenDropsCollected++;
          if (this.goldenDropsCollected >= 3) {
            this.activateSolidarityMode();
            this.goldenDropsCollected = 0;
          }
        } else {
          // Règle: Collecter les gouttes d'eau (+scoring.goutte pts)
          GameState.addScore(scoring.goutte || 10);
        }
        drop.destroy();
        this.drops.splice(i, 1);
        continue;
      }

      // Off screen
      if (drop.y > height + 50) {
        drop.destroy();
        this.drops.splice(i, 1);
      }
    }

    // Move braises down
    for (let i = this.braises.length - 1; i >= 0; i--) {
      const braise = this.braises[i];
      braise.y += this.speed * 2.5;

      // Check collision
      if (Math.abs(braise.x - colibriX) < 40 && Math.abs(braise.y - colibriY) < 40) {
        if (!this.isSolidarityMode) {
          // Règle: Éviter les braises volantes (-1 vie)
          GameState.addScore(scoring.braise_malus || -20);
          GameState.loseLife();
        }
        braise.destroy();
        this.braises.splice(i, 1);
        continue;
      }

      if (braise.y > height + 50) {
        braise.destroy();
        this.braises.splice(i, 1);
      }
    }
  }

  // Règle: Collecter 3 gouttes dorées active le mode solidarité (invincible 5s)
  private activateSolidarityMode(): void {
    this.isSolidarityMode = true;
    this.colibri.setFillStyle(0xffd700);

    if (this.solidarityTimer) {
      this.solidarityTimer.destroy();
    }
    this.solidarityTimer = this.time.delayedCall(5000, () => {
      this.isSolidarityMode = false;
      this.colibri.setFillStyle(0x00cc66);
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.braiseSpawnTimer) this.braiseSpawnTimer.destroy();
    if (this.speedTimer) this.speedTimer.destroy();
    if (this.solidarityTimer) this.solidarityTimer.destroy();
  }
}

registerScene('la-course-du-colibri', LaCourseDuColibriScene);
