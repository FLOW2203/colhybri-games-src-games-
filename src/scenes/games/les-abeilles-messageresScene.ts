/**
 * LesAbeillesMessageresScene — Arcade: guide a bee to pollinate flowers.
 * L'abeille suit le doigt du joueur sur l'écran.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Flower {
  x: number;
  y: number;
  container: Phaser.GameObjects.Container;
  pollinated: boolean;
}

interface DangerZone {
  type: 'rain' | 'pesticide';
  rect: Phaser.GameObjects.Rectangle;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class LesAbeillesMessageresScene extends BaseGameScene {
  private bee!: Phaser.GameObjects.Container;
  private beeX: number = 0;
  private beeY: number = 0;
  private targetX: number = 0;
  private targetY: number = 0;
  private flowers: Flower[] = [];
  private dangerZones: DangerZone[] = [];
  private pollinatedCount: number = 0;
  private targetPollinated: number = 30;
  private combo: number = 0;
  private lastPollinateTime: number = 0;
  private comboTimeout: number = 2000; // ms to keep combo alive
  private beeSpeed: number = 4;
  private isSlowed: boolean = false;
  private progressText!: Phaser.GameObjects.Text;
  private comboText!: Phaser.GameObjects.Text;
  private flowerSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private dangerSpawnTimer: Phaser.Time.TimerEvent | null = null;
  private gameLoopTimer: Phaser.Time.TimerEvent | null = null;
  private invulnTime: number = 0;

  constructor() {
    super('GameScene_les-abeilles-messageres');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: L'abeille suit le doigt du joueur sur l'écran
    this.beeX = width / 2;
    this.beeY = height / 2;
    this.targetX = this.beeX;
    this.targetY = this.beeY;

    const beeRect = this.add.rectangle(0, 0, 35, 35, 0xffcc00).setStrokeStyle(2, 0xaa8800);
    const beeEmoji = this.add.text(0, 0, '🐝', { fontSize: '28px' }).setOrigin(0.5);
    this.bee = this.add.container(this.beeX, this.beeY, [beeRect, beeEmoji]).setDepth(20);

    // Touch/pointer tracking
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      this.targetX = pointer.x;
      this.targetY = pointer.y;
    });
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.targetX = pointer.x;
      this.targetY = pointer.y;
    });

    // Règle: Polliniser 30 fleurs pour compléter le niveau
    this.progressText = this.add.text(width / 2, 30, `Fleurs : 0 / ${this.targetPollinated}`, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);

    this.comboText = this.add.text(width / 2, 55, '', {
      fontSize: '16px', color: '#ffd700', fontFamily: 'Arial',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(25);

    // Spawn initial flowers
    for (let i = 0; i < 8; i++) {
      this.spawnFlower();
    }

    // Règle: Fleurs apparaissent régulièrement
    this.flowerSpawnTimer = this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => {
        if (this.flowers.filter(f => !f.pollinated).length < 10) {
          this.spawnFlower();
        }
      },
    });

    // Règle: Éviter la pluie et les pesticides
    this.dangerSpawnTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => this.spawnDangerZone(),
    });

    // Game loop
    this.gameLoopTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.gameLoop(),
    });
  }

  private spawnFlower(): void {
    const { width, height } = this.scale;
    const x = Phaser.Math.Between(40, width - 40);
    const y = Phaser.Math.Between(100, height - 40);

    const flowerColors = [0xff69b4, 0xff6347, 0xffd700, 0x9370db, 0xff4500];
    const flowerEmojis = ['🌸', '🌺', '🌻', '🌷', '🌼'];
    const idx = Phaser.Math.Between(0, flowerColors.length - 1);

    const rect = this.add.rectangle(0, 0, 30, 30, flowerColors[idx], 0.6);
    const emoji = this.add.text(0, 0, flowerEmojis[idx], { fontSize: '24px' }).setOrigin(0.5);
    const container = this.add.container(x, y, [rect, emoji]).setDepth(5);

    // Gentle pulse animation
    this.tweens.add({
      targets: container, scaleX: 1.1, scaleY: 1.1, yoyo: true, repeat: -1, duration: 800,
    });

    this.flowers.push({ x, y, container, pollinated: false });
  }

  private spawnDangerZone(): void {
    const { width, height } = this.scale;
    const isRain = Phaser.Math.Between(0, 1) === 0;
    const zoneW = Phaser.Math.Between(80, 150);
    const zoneH = Phaser.Math.Between(80, 150);
    const x = Phaser.Math.Between(zoneW / 2, width - zoneW / 2);
    const y = Phaser.Math.Between(100 + zoneH / 2, height - zoneH / 2);

    // Règle: Zones bleues = pluie (ralentissement), zones rouges = pesticides (-1 vie)
    const color = isRain ? 0x4444ff : 0xff0000;
    const alpha = 0.25;
    const rect = this.add.rectangle(x, y, zoneW, zoneH, color, alpha).setDepth(3);
    const label = this.add.text(x, y, isRain ? '🌧️' : '☠️', { fontSize: '24px' }).setOrigin(0.5).setDepth(4);

    const zone: DangerZone = {
      type: isRain ? 'rain' : 'pesticide',
      rect, x, y, width: zoneW, height: zoneH,
    };
    this.dangerZones.push(zone);

    // Zone disappears after some time
    this.time.delayedCall(5000, () => {
      const idx = this.dangerZones.indexOf(zone);
      if (idx >= 0) this.dangerZones.splice(idx, 1);
      rect.destroy();
      label.destroy();
    });
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;
    const scoring = this.jeu.scoring;
    const now = this.time.now;

    // Règle: L'abeille suit le doigt du joueur
    const speed = this.isSlowed ? this.beeSpeed * 0.4 : this.beeSpeed;
    const dx = this.targetX - this.beeX;
    const dy = this.targetY - this.beeY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 2) {
      this.beeX += (dx / dist) * speed;
      this.beeY += (dy / dist) * speed;
      this.bee.setPosition(this.beeX, this.beeY);
    }

    this.isSlowed = false;

    // Check danger zones
    if (now > this.invulnTime) {
      for (const zone of this.dangerZones) {
        if (this.beeX > zone.x - zone.width / 2 && this.beeX < zone.x + zone.width / 2 &&
            this.beeY > zone.y - zone.height / 2 && this.beeY < zone.y + zone.height / 2) {
          if (zone.type === 'rain') {
            // Règle: Éviter la pluie (zones bleues) qui ralentit l'abeille
            this.isSlowed = true;
          } else {
            // Règle: Éviter les pesticides (zones rouges) = -1 vie
            GameState.addScore(scoring.pesticide_malus || -20);
            GameState.loseLife();
            this.invulnTime = now + 1500; // Brief invulnerability
            this.bee.setAlpha(0.5);
            this.time.delayedCall(1500, () => this.bee.setAlpha(1));
          }
        }
      }
    }

    // Règle: Survoler une fleur pour la polliniser
    for (const flower of this.flowers) {
      if (flower.pollinated) continue;
      const fDist = Phaser.Math.Distance.Between(this.beeX, this.beeY, flower.x, flower.y);
      if (fDist < 30) {
        flower.pollinated = true;
        this.pollinatedCount++;

        // Règle: +scoring.fleur_pollinisee pts
        GameState.addScore(scoring.fleur_pollinisee || 10);
        GameState.addSolidarite(1);

        // Règle: Enchaîner les fleurs sans pause = combo pollinisation
        if (now - this.lastPollinateTime < this.comboTimeout) {
          this.combo++;
        } else {
          this.combo = 1;
        }
        this.lastPollinateTime = now;

        // Règle: Combo 5 et combo 10 bonus
        if (this.combo === 5) {
          GameState.addScore(scoring.combo_5 || 25);
          this.comboText.setText('Combo x5 !');
        } else if (this.combo === 10) {
          GameState.addScore(scoring.combo_10 || 60);
          this.comboText.setText('Combo x10 !!');
        } else if (this.combo > 1) {
          this.comboText.setText(`Combo x${this.combo}`);
        }

        // Visual feedback
        flower.container.setAlpha(0.3);
        this.tweens.add({
          targets: flower.container, scaleX: 1.5, scaleY: 1.5, alpha: 0, duration: 400,
          onComplete: () => flower.container.destroy(),
        });

        // Update progress
        this.progressText.setText(`Fleurs : ${this.pollinatedCount} / ${this.targetPollinated}`);

        // Règle: Polliniser 30 fleurs pour compléter le niveau
        if (this.pollinatedCount >= this.targetPollinated) {
          this.showBonusText('Niveau terminé !');
          GameState.addSolidarite(15);
          // Could trigger next level or game over with high score
          this.time.delayedCall(2000, () => {
            this.targetPollinated += 10;
            this.progressText.setText(`Fleurs : ${this.pollinatedCount} / ${this.targetPollinated}`);
            // Spawn more flowers for bonus round
            for (let i = 0; i < 5; i++) this.spawnFlower();
          });
        }
      }
    }

    // Clear combo text if timeout
    if (now - this.lastPollinateTime > this.comboTimeout && this.combo > 0) {
      this.combo = 0;
      this.comboText.setText('');
    }
  }

  private showBonusText(msg: string): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, msg, {
      fontSize: '30px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: height / 2 - 80, alpha: 0, duration: 2000,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.flowerSpawnTimer) this.flowerSpawnTimer.destroy();
    if (this.dangerSpawnTimer) this.dangerSpawnTimer.destroy();
    if (this.gameLoopTimer) this.gameLoopTimer.destroy();
  }
}

registerScene('les-abeilles-messageres', LesAbeillesMessageresScene);
