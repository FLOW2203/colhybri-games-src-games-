/**
 * LeVeloCargoScene — Delivery: le vélo cargo ramasse et livre des colis.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Parcel {
  sprite: Phaser.GameObjects.Container;
  y: number;
  lane: number;
}

interface House {
  sprite: Phaser.GameObjects.Container;
  y: number;
  lane: number;
}

interface Obstacle {
  sprite: Phaser.GameObjects.Container;
  y: number;
  lane: number;
}

export class LeVeloCargoScene extends BaseGameScene {
  private bikeX: number = 0;
  private bikeSprite!: Phaser.GameObjects.Rectangle;
  private bikeLabel!: Phaser.GameObjects.Text;
  private parcels: Parcel[] = [];
  private houses: House[] = [];
  private obstacles: Obstacle[] = [];
  private carriedParcels: number = 0;
  private consecutiveDeliveries: number = 0;
  private cargoText!: Phaser.GameObjects.Text;
  private speed: number = 3;
  private isDragging: boolean = false;
  private dragStartX: number = 0;
  private roadLeft: number = 0;
  private roadRight: number = 0;
  private laneWidth: number = 0;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private gameLoopTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('GameScene_le-velo-cargo');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Road setup - 5 lanes
    this.roadLeft = width * 0.1;
    this.roadRight = width * 0.9;
    this.laneWidth = (this.roadRight - this.roadLeft) / 5;

    // Draw road
    this.add.rectangle(width / 2, height / 2, this.roadRight - this.roadLeft, height, 0x444444)
      .setDepth(0);
    // Lane lines
    for (let i = 1; i < 5; i++) {
      const x = this.roadLeft + i * this.laneWidth;
      for (let y = 0; y < height; y += 40) {
        this.add.rectangle(x, y, 3, 20, 0xaaaaaa, 0.5).setDepth(0);
      }
    }

    // Règle: Le vélo cargo avance automatiquement dans la rue
    this.bikeX = width / 2;
    const bikeY = height * 0.8;
    this.bikeSprite = this.add.rectangle(this.bikeX, bikeY, 50, 70, 0x22aa44)
      .setDepth(3);
    this.bikeLabel = this.add.text(this.bikeX, bikeY, '🚲', {
      fontSize: '36px',
    }).setOrigin(0.5).setDepth(4);

    this.cargoText = this.add.text(width / 2, height * 0.06, `Colis: ${this.carriedParcels}`, {
      fontSize: '24px', color: '#ffcc00', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Tilt du téléphone pour tourner gauche/droite (use touch drag as fallback)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartX = pointer.x;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDragging) {
        const dx = pointer.x - this.dragStartX;
        this.bikeX = Phaser.Math.Clamp(
          this.bikeX + dx * 0.3,
          this.roadLeft + 25,
          this.roadRight - 25
        );
        this.bikeSprite.setX(this.bikeX);
        this.bikeLabel.setX(this.bikeX);
        this.dragStartX = pointer.x;
      }
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Spawn parcels, houses, obstacles
    this.spawnTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.spawnObjects(),
    });

    // Game loop
    this.gameLoopTimer = this.time.addEvent({
      delay: 20,
      loop: true,
      callback: () => this.gameLoop(),
    });

    // Increase speed over time
    this.time.addEvent({
      delay: 15000,
      loop: true,
      callback: () => { this.speed += 0.5; },
    });
  }

  private spawnObjects(): void {
    const { width } = this.scale;
    const roll = Phaser.Math.Between(1, 10);
    const lane = Phaser.Math.Between(0, 4);
    const x = this.roadLeft + lane * this.laneWidth + this.laneWidth / 2;

    if (roll <= 4) {
      // Spawn parcel
      const rect = this.add.rectangle(0, 0, 35, 35, 0xcc8833).setDepth(2);
      const lbl = this.add.text(0, 0, '📦', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
      const container = this.add.container(x, -40, [rect, lbl]);
      this.parcels.push({ sprite: container, y: -40, lane });
    } else if (roll <= 7) {
      // Spawn house (delivery point)
      if (this.carriedParcels > 0) {
        const rect = this.add.rectangle(0, 0, 50, 40, 0x6644aa).setDepth(2);
        const lbl = this.add.text(0, 0, '🏠', { fontSize: '24px' }).setOrigin(0.5).setDepth(2);
        const container = this.add.container(x, -40, [rect, lbl]);
        this.houses.push({ sprite: container, y: -40, lane });
      }
    } else {
      // Règle: Éviter les voitures et obstacles (-1 vie)
      const rect = this.add.rectangle(0, 0, 45, 60, 0xcc2222).setDepth(2);
      const lbl = this.add.text(0, 0, '🚗', { fontSize: '28px' }).setOrigin(0.5).setDepth(2);
      const container = this.add.container(x, -40, [rect, lbl]);
      this.obstacles.push({ sprite: container, y: -40, lane });
    }
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;

    const { height } = this.scale;
    const scoring = this.jeu.scoring;
    const bikeY = height * 0.8;
    const bikeX = this.bikeX;

    // Move parcels
    for (let i = this.parcels.length - 1; i >= 0; i--) {
      const p = this.parcels[i];
      p.y += this.speed;
      p.sprite.setY(p.y);

      // Règle: Ramasser les colis sur le trajet (+scoring.colis_ramasse pts chaque)
      if (Math.abs(p.sprite.x - bikeX) < 40 && Math.abs(p.y - bikeY) < 50) {
        GameState.addScore(scoring.colis_ramasse || 10);
        this.carriedParcels++;
        this.cargoText.setText(`Colis: ${this.carriedParcels}`);
        p.sprite.destroy();
        this.parcels.splice(i, 1);
        continue;
      }

      if (p.y > height + 50) {
        p.sprite.destroy();
        this.parcels.splice(i, 1);
      }
    }

    // Move houses
    for (let i = this.houses.length - 1; i >= 0; i--) {
      const h = this.houses[i];
      h.y += this.speed;
      h.sprite.setY(h.y);

      // Règle: Livrer les colis aux maisons marquées (+scoring.colis_livre pts)
      if (Math.abs(h.sprite.x - bikeX) < 45 && Math.abs(h.y - bikeY) < 50 && this.carriedParcels > 0) {
        this.carriedParcels--;
        this.consecutiveDeliveries++;
        this.cargoText.setText(`Colis: ${this.carriedParcels}`);

        let points = scoring.colis_livre || 20;
        // Règle: Bonus : livraison groupée (3+ colis d'affilée) = x scoring.livraison_groupee_multiplier points
        if (this.consecutiveDeliveries >= 3) {
          points *= (scoring.livraison_groupee_multiplier || 2);
        }
        GameState.addScore(points);

        h.sprite.destroy();
        this.houses.splice(i, 1);
        continue;
      }

      if (h.y > height + 50) {
        // Missed a delivery resets consecutive counter
        this.consecutiveDeliveries = 0;
        h.sprite.destroy();
        this.houses.splice(i, 1);
      }
    }

    // Move obstacles
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const o = this.obstacles[i];
      o.y += this.speed;
      o.sprite.setY(o.y);

      // Règle: Éviter les voitures et obstacles (-1 vie)
      if (Math.abs(o.sprite.x - bikeX) < 40 && Math.abs(o.y - bikeY) < 55) {
        GameState.addScore(scoring.obstacle_malus || -10);
        GameState.loseLife();
        this.consecutiveDeliveries = 0;
        o.sprite.destroy();
        this.obstacles.splice(i, 1);
        continue;
      }

      if (o.y > height + 50) {
        o.sprite.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  shutdown(): void {
    super.shutdown();
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.gameLoopTimer) this.gameLoopTimer.destroy();
  }
}

registerScene('le-velo-cargo', LeVeloCargoScene);
