/**
 * LePotagerVerticalScene — Tetris-style vertical garden.
 * Des bacs de culture tombent du haut, compléter des lignes pour récolter.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Bac {
  container: Phaser.GameObjects.Container;
  gridX: number;
  gridY: number;
  width: number; // in cells
  colorType: number;
  placed: boolean;
}

const PLANT_COLORS = [0x228B22, 0xFF6347, 0xFFD700, 0x8A2BE2, 0xFF69B4];
const PLANT_LABELS = ['🥬', '🍅', '🌻', '🍆', '🌸'];

export class LePotagerVerticalScene extends BaseGameScene {
  private grid: (number | null)[][] = [];
  private cols: number = 8;
  private rows: number = 14;
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private activeBac: Bac | null = null;
  private placedContainers: (Phaser.GameObjects.Container | null)[][] = [];
  private dropTimer: Phaser.Time.TimerEvent | null = null;
  private moveTimer: Phaser.Time.TimerEvent | null = null;
  private harvestCount: number = 0;
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private comboColors: number[] = [];

  constructor() {
    super('GameScene_le-potager-vertical');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: Grille de jeu style Tetris
    this.cellSize = Math.floor(Math.min(width / (this.cols + 2), height / (this.rows + 2)));
    this.gridOffsetX = (width - this.cols * this.cellSize) / 2;
    this.gridOffsetY = (height - this.rows * this.cellSize) / 2 + this.cellSize;

    // Initialize grid
    this.grid = [];
    this.placedContainers = [];
    for (let r = 0; r < this.rows; r++) {
      this.grid[r] = [];
      this.placedContainers[r] = [];
      for (let c = 0; c < this.cols; c++) {
        this.grid[r][c] = null;
        this.placedContainers[r][c] = null;
      }
    }

    // Draw grid background
    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        this.add.rectangle(
          this.gridOffsetX + c * this.cellSize + this.cellSize / 2,
          this.gridOffsetY + r * this.cellSize + this.cellSize / 2,
          this.cellSize - 2, this.cellSize - 2,
          0x3a2a1a, 0.3
        );
      }
    }

    // Règle: Tap pour pivoter, swipe pour déplacer
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!this.activeBac || GameState.isGameOver) return;
      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;

      if (Math.abs(dx) < 20 && Math.abs(dy) < 20) {
        // Règle: Tap pour faire pivoter (toggle width between 1-3)
        this.rotateBac();
      } else if (Math.abs(dx) > Math.abs(dy)) {
        // Règle: Swipe horizontal pour déplacer
        if (dx < -30) this.moveBac(-1);
        else if (dx > 30) this.moveBac(1);
      } else if (dy > 30) {
        // Swipe down = drop fast
        this.hardDrop();
      }
    });

    // Spawn first bac
    this.spawnBac();

    // Règle: Les bacs tombent automatiquement
    this.moveTimer = this.time.addEvent({
      delay: 800,
      loop: true,
      callback: () => this.stepDown(),
    });
  }

  private spawnBac(): void {
    if (GameState.isGameOver) return;

    const bacWidth = Phaser.Math.Between(1, 3);
    const colorIdx = Phaser.Math.Between(0, PLANT_COLORS.length - 1);
    const startX = Math.floor((this.cols - bacWidth) / 2);

    // Règle: Si les bacs dépassent l'écran = game over
    for (let c = startX; c < startX + bacWidth; c++) {
      if (this.grid[0][c] !== null) {
        GameState.triggerGameOver();
        return;
      }
    }

    const container = this.add.container(0, 0);
    for (let i = 0; i < bacWidth; i++) {
      const x = this.gridOffsetX + (startX + i) * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + this.cellSize / 2;
      const rect = this.add.rectangle(0, 0, this.cellSize - 4, this.cellSize - 4, PLANT_COLORS[colorIdx]);
      const label = this.add.text(0, 0, PLANT_LABELS[colorIdx], { fontSize: `${this.cellSize * 0.5}px` }).setOrigin(0.5);
      const cell = this.add.container(x, y, [rect, label]);
      container.add(cell);
    }

    this.activeBac = {
      container,
      gridX: startX,
      gridY: 0,
      width: bacWidth,
      colorType: colorIdx,
      placed: false,
    };
  }

  private moveBac(dir: number): void {
    if (!this.activeBac || this.activeBac.placed) return;
    const newX = this.activeBac.gridX + dir;
    if (newX < 0 || newX + this.activeBac.width > this.cols) return;

    // Check collision
    for (let c = newX; c < newX + this.activeBac.width; c++) {
      if (this.grid[this.activeBac.gridY][c] !== null) return;
    }

    this.activeBac.gridX = newX;
    this.updateBacPosition();
  }

  private rotateBac(): void {
    if (!this.activeBac || this.activeBac.placed) return;
    // Cycle width: 1->2->3->1
    const newWidth = (this.activeBac.width % 3) + 1;
    if (this.activeBac.gridX + newWidth > this.cols) return;

    // Check collision for new shape
    for (let c = this.activeBac.gridX; c < this.activeBac.gridX + newWidth; c++) {
      if (this.grid[this.activeBac.gridY][c] !== null) return;
    }

    // Rebuild container
    this.activeBac.container.destroy();
    const container = this.add.container(0, 0);
    for (let i = 0; i < newWidth; i++) {
      const x = this.gridOffsetX + (this.activeBac.gridX + i) * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + this.activeBac.gridY * this.cellSize + this.cellSize / 2;
      const rect = this.add.rectangle(0, 0, this.cellSize - 4, this.cellSize - 4, PLANT_COLORS[this.activeBac.colorType]);
      const label = this.add.text(0, 0, PLANT_LABELS[this.activeBac.colorType], { fontSize: `${this.cellSize * 0.5}px` }).setOrigin(0.5);
      const cell = this.add.container(x, y, [rect, label]);
      container.add(cell);
    }
    this.activeBac.container = container;
    this.activeBac.width = newWidth;
  }

  private updateBacPosition(): void {
    if (!this.activeBac) return;
    const children = this.activeBac.container.getAll() as Phaser.GameObjects.Container[];
    for (let i = 0; i < children.length; i++) {
      children[i].setPosition(
        this.gridOffsetX + (this.activeBac.gridX + i) * this.cellSize + this.cellSize / 2,
        this.gridOffsetY + this.activeBac.gridY * this.cellSize + this.cellSize / 2
      );
    }
  }

  private stepDown(): void {
    if (!this.activeBac || this.activeBac.placed || GameState.isGameOver) return;

    const newY = this.activeBac.gridY + 1;
    if (newY >= this.rows || this.checkCollisionBelow(newY)) {
      this.placeBac();
      return;
    }

    this.activeBac.gridY = newY;
    this.updateBacPosition();
  }

  private hardDrop(): void {
    if (!this.activeBac || this.activeBac.placed || GameState.isGameOver) return;
    while (this.activeBac.gridY + 1 < this.rows && !this.checkCollisionBelow(this.activeBac.gridY + 1)) {
      this.activeBac.gridY++;
    }
    this.updateBacPosition();
    this.placeBac();
  }

  private checkCollisionBelow(newY: number): boolean {
    if (!this.activeBac) return true;
    for (let c = this.activeBac.gridX; c < this.activeBac.gridX + this.activeBac.width; c++) {
      if (this.grid[newY][c] !== null) return true;
    }
    return false;
  }

  private placeBac(): void {
    if (!this.activeBac) return;
    const scoring = this.jeu.scoring;

    // Règle: Les bacs ont des plantes différentes (combos de couleur)
    for (let c = this.activeBac.gridX; c < this.activeBac.gridX + this.activeBac.width; c++) {
      this.grid[this.activeBac.gridY][c] = this.activeBac.colorType;

      // Create static placed cell
      const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + this.activeBac.gridY * this.cellSize + this.cellSize / 2;
      const rect = this.add.rectangle(x, y, this.cellSize - 4, this.cellSize - 4, PLANT_COLORS[this.activeBac.colorType]);
      const label = this.add.text(x, y, PLANT_LABELS[this.activeBac.colorType], { fontSize: `${this.cellSize * 0.5}px` }).setOrigin(0.5);
      const cont = this.add.container(0, 0, [rect, label]);
      this.placedContainers[this.activeBac.gridY][c] = cont;
    }

    // Destroy active container
    this.activeBac.container.destroy();
    this.activeBac.placed = true;

    // Règle: Si les bacs dépassent l'écran = game over (check top row penalty)
    let topRowUsed = false;
    for (let c = 0; c < this.cols; c++) {
      if (this.grid[0][c] !== null) topRowUsed = true;
    }
    if (topRowUsed) {
      GameState.addScore(scoring.hauteur_malus || -5);
    }

    // Règle: Compléter une ligne = récolte
    this.checkLines();

    // Spawn next
    this.activeBac = null;
    this.time.delayedCall(200, () => this.spawnBac());
  }

  private checkLines(): void {
    const scoring = this.jeu.scoring;

    for (let r = this.rows - 1; r >= 0; r--) {
      let full = true;
      const colorsInLine: number[] = [];
      for (let c = 0; c < this.cols; c++) {
        if (this.grid[r][c] === null) {
          full = false;
          break;
        }
        colorsInLine.push(this.grid[r][c]!);
      }

      if (full) {
        // Règle: Compléter une ligne = récolte (+scoring.ligne_complete pts)
        GameState.addScore(scoring.ligne_complete || 20);
        this.harvestCount++;

        // Règle: Combos de couleur si même couleur sur la ligne
        const uniqueColors = new Set(colorsInLine);
        if (uniqueColors.size <= 2) {
          GameState.addScore(scoring.combo_couleur || 15);
        }

        // Règle: Toutes les 5 récoltes, un bonus solidarité apparaît
        if (this.harvestCount % 5 === 0) {
          GameState.addScore(scoring.bonus_solidarite || 30);
          GameState.addSolidarite(10);
          this.showBonusText('Bonus Solidarité !');
        }

        // Clear line
        for (let c = 0; c < this.cols; c++) {
          if (this.placedContainers[r][c]) {
            this.placedContainers[r][c]!.destroy();
            this.placedContainers[r][c] = null;
          }
          this.grid[r][c] = null;
        }

        // Shift rows down
        for (let rr = r; rr > 0; rr--) {
          for (let c = 0; c < this.cols; c++) {
            this.grid[rr][c] = this.grid[rr - 1][c];
            this.placedContainers[rr][c] = this.placedContainers[rr - 1][c];
            if (this.placedContainers[rr][c]) {
              const children = this.placedContainers[rr][c]!.getAll() as Phaser.GameObjects.Shape[];
              children.forEach((child) => {
                child.y += this.cellSize;
              });
            }
          }
        }
        // Clear top row
        for (let c = 0; c < this.cols; c++) {
          this.grid[0][c] = null;
          this.placedContainers[0][c] = null;
        }
        r++; // recheck same row
      }
    }
  }

  private showBonusText(msg: string): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, msg, {
      fontSize: '32px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: height / 2 - 80, alpha: 0, duration: 1500,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.moveTimer) this.moveTimer.destroy();
    if (this.dropTimer) this.dropTimer.destroy();
  }
}

registerScene('le-potager-vertical', LePotagerVerticalScene);
