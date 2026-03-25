/**
 * LaRucheCooperativeScene — Tower defense: protéger la ruche des frelons.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

const GRID_COLS = 7;
const GRID_ROWS = 7;

interface Bee {
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  row: number;
  col: number;
  range: number;
  damage: number;
}

interface Hornet {
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  x: number;
  y: number;
  targetX: number;
  targetY: number;
  hp: number;
  speed: number;
}

interface Flower {
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  x: number;
  y: number;
}

export class LaRucheCooperativeScene extends BaseGameScene {
  private bees: Bee[] = [];
  private hornets: Hornet[] = [];
  private flowers: Flower[] = [];
  private honeyTokens: number = 30;
  private honeyText!: Phaser.GameObjects.Text;
  private waveNumber: number = 0;
  private hornetsInWave: number = 0;
  private hornetsSpawned: number = 0;
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private centerRow: number = 3;
  private centerCol: number = 3;
  private waveTimer: Phaser.Time.TimerEvent | null = null;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private gameLoopTimer: Phaser.Time.TimerEvent | null = null;
  private flowerTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('GameScene_la-ruche-cooperative');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    this.cellSize = Math.min(width / (GRID_COLS + 2), (height * 0.6) / (GRID_ROWS + 2));
    this.gridOffsetX = (width - GRID_COLS * this.cellSize) / 2;
    this.gridOffsetY = height * 0.2;

    // Draw grid
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
        const color = (r === this.centerRow && c === this.centerCol) ? 0xffaa00 : 0x334433;
        this.add.rectangle(x, y, this.cellSize - 2, this.cellSize - 2, color, 0.3)
          .setStrokeStyle(1, 0x556655);
      }
    }

    // Règle: La ruche est au centre
    const cx = this.gridOffsetX + this.centerCol * this.cellSize + this.cellSize / 2;
    const cy = this.gridOffsetY + this.centerRow * this.cellSize + this.cellSize / 2;
    this.add.text(cx, cy, '🐝', { fontSize: '32px' }).setOrigin(0.5).setDepth(5);

    // Honey tokens UI
    this.honeyText = this.add.text(width / 2, height * 0.08, `Miel: ${this.honeyTokens}`, {
      fontSize: '26px', color: '#ffcc00', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Placer des abeilles gardiennes sur les cases de défense
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Check if tapping a flower first
      for (let i = this.flowers.length - 1; i >= 0; i--) {
        const f = this.flowers[i];
        if (Math.abs(pointer.x - f.x) < this.cellSize / 2 && Math.abs(pointer.y - f.y) < this.cellSize / 2) {
          // Règle: Récolter du miel en tapant sur les fleurs (+5 jetons)
          this.honeyTokens += 5;
          this.honeyText.setText(`Miel: ${this.honeyTokens}`);
          GameState.addScore(this.jeu.scoring.miel_recolte || 5);
          f.sprite.destroy();
          f.label.destroy();
          this.flowers.splice(i, 1);
          return;
        }
      }

      // Place bee on grid cell
      const col = Math.floor((pointer.x - this.gridOffsetX) / this.cellSize);
      const row = Math.floor((pointer.y - this.gridOffsetY) / this.cellSize);

      if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;
      if (row === this.centerRow && col === this.centerCol) return;

      // Check if cell already has a bee
      if (this.bees.some(b => b.row === row && b.col === col)) return;

      // Règle: Chaque abeille coûte 10 jetons de miel
      if (this.honeyTokens < 10) return;
      this.honeyTokens -= 10;
      this.honeyText.setText(`Miel: ${this.honeyTokens}`);

      const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2;
      const sprite = this.add.rectangle(x, y, this.cellSize - 8, this.cellSize - 8, 0xffdd44);
      const label = this.add.text(x, y, '🐝', { fontSize: '22px' }).setOrigin(0.5);
      this.bees.push({ sprite, label, row, col, range: this.cellSize * 2, damage: 1 });
    });

    // Spawn flowers periodically
    // Règle: Récolter du miel en tapant sur les fleurs (+5 jetons)
    this.flowerTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => this.spawnFlower(),
    });

    // Règle: Vagues de difficulté croissante
    this.startWave();

    // Main loop
    this.gameLoopTimer = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => this.gameLoop(),
    });
  }

  private startWave(): void {
    this.waveNumber++;
    this.hornetsInWave = 3 + this.waveNumber * 2;
    this.hornetsSpawned = 0;

    // Règle: Les frelons arrivent par les bords
    this.spawnTimer = this.time.addEvent({
      delay: Math.max(500, 2000 - this.waveNumber * 200),
      repeat: this.hornetsInWave - 1,
      callback: () => this.spawnHornet(),
    });
  }

  private spawnHornet(): void {
    const { width, height } = this.scale;
    const side = Phaser.Math.Between(0, 3);
    let x: number, y: number;

    // Règle: Les frelons arrivent par les bords
    switch (side) {
      case 0: x = 0; y = Phaser.Math.Between(this.gridOffsetY, this.gridOffsetY + GRID_ROWS * this.cellSize); break;
      case 1: x = width; y = Phaser.Math.Between(this.gridOffsetY, this.gridOffsetY + GRID_ROWS * this.cellSize); break;
      case 2: x = Phaser.Math.Between(this.gridOffsetX, this.gridOffsetX + GRID_COLS * this.cellSize); y = this.gridOffsetY - 20; break;
      default: x = Phaser.Math.Between(this.gridOffsetX, this.gridOffsetX + GRID_COLS * this.cellSize); y = this.gridOffsetY + GRID_ROWS * this.cellSize + 20; break;
    }

    const targetX = this.gridOffsetX + this.centerCol * this.cellSize + this.cellSize / 2;
    const targetY = this.gridOffsetY + this.centerRow * this.cellSize + this.cellSize / 2;

    const sprite = this.add.rectangle(x, y, 30, 30, 0xff2222);
    const label = this.add.text(x, y, '🐝', { fontSize: '20px', color: '#ff0000' }).setOrigin(0.5);

    this.hornets.push({
      sprite, label, x, y, targetX, targetY,
      hp: 1 + Math.floor(this.waveNumber / 3),
      speed: 0.5 + this.waveNumber * 0.1,
    });
    this.hornetsSpawned++;
  }

  private spawnFlower(): void {
    const { width, height } = this.scale;
    const x = Phaser.Math.Between(50, width - 50);
    const y = Phaser.Math.Between(this.gridOffsetY + GRID_ROWS * this.cellSize + 30, height - 80);

    const sprite = this.add.rectangle(x, y, 40, 40, 0xff88cc);
    const label = this.add.text(x, y, '🌸', { fontSize: '28px' }).setOrigin(0.5);
    this.flowers.push({ sprite, label, x, y });

    // Auto-remove after 6s
    this.time.delayedCall(6000, () => {
      const idx = this.flowers.findIndex(f => f.sprite === sprite);
      if (idx !== -1) {
        sprite.destroy();
        label.destroy();
        this.flowers.splice(idx, 1);
      }
    });
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;
    const scoring = this.jeu.scoring;

    const centerX = this.gridOffsetX + this.centerCol * this.cellSize + this.cellSize / 2;
    const centerY = this.gridOffsetY + this.centerRow * this.cellSize + this.cellSize / 2;

    // Move hornets toward center
    for (let i = this.hornets.length - 1; i >= 0; i--) {
      const h = this.hornets[i];
      const dx = h.targetX - h.x;
      const dy = h.targetY - h.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 15) {
        // Règle: Si un frelon atteint la ruche, -1 vie
        GameState.loseLife();
        h.sprite.destroy();
        h.label.destroy();
        this.hornets.splice(i, 1);
        continue;
      }

      h.x += (dx / dist) * h.speed;
      h.y += (dy / dist) * h.speed;
      h.sprite.setPosition(h.x, h.y);
      h.label.setPosition(h.x, h.y);

      // Check bee attacks
      for (const bee of this.bees) {
        const bx = this.gridOffsetX + bee.col * this.cellSize + this.cellSize / 2;
        const by = this.gridOffsetY + bee.row * this.cellSize + this.cellSize / 2;
        const bdist = Math.sqrt((bx - h.x) ** 2 + (by - h.y) ** 2);
        if (bdist < bee.range) {
          h.hp -= bee.damage * 0.05; // gradual damage per tick
          if (h.hp <= 0) {
            // Règle: frelon_elimine
            GameState.addScore(scoring.frelon_elimine || 15);
            h.sprite.destroy();
            h.label.destroy();
            this.hornets.splice(i, 1);
            break;
          }
        }
      }
    }

    // Check wave complete
    if (this.hornetsSpawned >= this.hornetsInWave && this.hornets.length === 0) {
      // Règle: Vague complète
      GameState.addScore(scoring.vague_complete || 100);
      this.time.delayedCall(1500, () => this.startWave());
    }
  }

  shutdown(): void {
    super.shutdown();
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.gameLoopTimer) this.gameLoopTimer.destroy();
    if (this.flowerTimer) this.flowerTimer.destroy();
  }
}

registerScene('la-ruche-cooperative', LaRucheCooperativeScene);
