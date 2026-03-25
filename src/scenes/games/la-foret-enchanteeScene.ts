/**
 * LaForetEnchanteeScene — Clicker: planter des arbres et éteindre les incendies.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

const GRID_COLS = 6;
const GRID_ROWS = 8;

interface TreeCell {
  state: 'empty' | 'growing1' | 'growing2' | 'mature' | 'fire';
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  row: number;
  col: number;
  growTimer: Phaser.Time.TimerEvent | null;
  fireTimer: Phaser.Time.TimerEvent | null;
}

const TREE_VISUALS: { [key: string]: { color: number; text: string } } = {
  empty: { color: 0x2a3a1a, text: '' },
  growing1: { color: 0x3a5a2a, text: '🌱' },
  growing2: { color: 0x4a7a3a, text: '🌿' },
  mature: { color: 0x228833, text: '🌳' },
  fire: { color: 0xff4400, text: '🔥' },
};

export class LaForetEnchanteeScene extends BaseGameScene {
  private grid: TreeCell[][] = [];
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private treeCount: number = 0;
  private treeCountText!: Phaser.GameObjects.Text;
  private fireSpawnTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('GameScene_la-foret-enchantee');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    this.cellSize = Math.min((width - 20) / GRID_COLS, (height * 0.7) / GRID_ROWS);
    this.gridOffsetX = (width - GRID_COLS * this.cellSize) / 2;
    this.gridOffsetY = height * 0.15;

    // Règle: Atteindre 50 arbres pour compléter le niveau
    this.treeCountText = this.add.text(width / 2, height * 0.07, `Arbres: ${this.treeCount}/50`, {
      fontSize: '26px', color: '#44ff44', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Create grid
    for (let r = 0; r < GRID_ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;

        const sprite = this.add.rectangle(x, y, this.cellSize - 4, this.cellSize - 4, TREE_VISUALS.empty.color)
          .setStrokeStyle(1, 0x334422).setInteractive();
        const label = this.add.text(x, y, '', {
          fontSize: `${Math.floor(this.cellSize * 0.5)}px`,
        }).setOrigin(0.5);

        this.grid[r][c] = {
          state: 'empty', sprite, label, row: r, col: c,
          growTimer: null, fireTimer: null,
        };
      }
    }

    // Règle: Tap sur les zones vides pour planter un arbre / tap rapide pour éteindre incendie
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const col = Math.floor((pointer.x - this.gridOffsetX) / this.cellSize);
      const row = Math.floor((pointer.y - this.gridOffsetY) / this.cellSize);

      if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;

      const cell = this.grid[row][col];

      if (cell.state === 'empty') {
        // Règle: Tap sur les zones vides pour planter un arbre
        this.plantTree(cell);
      } else if (cell.state === 'fire') {
        // Règle: Les incendies apparaissent aléatoirement, tap rapide pour éteindre
        this.extinguishFire(cell);
      }
    });

    // Règle: Les incendies apparaissent aléatoirement
    this.fireSpawnTimer = this.time.addEvent({
      delay: 6000,
      loop: true,
      callback: () => this.spawnFire(),
    });
  }

  private plantTree(cell: TreeCell): void {
    // Règle: Chaque arbre pousse en 5 secondes (3 stades)
    this.setCellState(cell, 'growing1');

    cell.growTimer = this.time.delayedCall(2500, () => {
      if (cell.state === 'growing1') {
        this.setCellState(cell, 'growing2');
        cell.growTimer = this.time.delayedCall(2500, () => {
          if (cell.state === 'growing2') {
            // Règle: Arbre mature = +scoring.arbre_plante pts et produit de l'oxygène
            this.setCellState(cell, 'mature');
            this.treeCount++;
            this.treeCountText.setText(`Arbres: ${this.treeCount}/50`);
            GameState.addScore(this.jeu.scoring.arbre_plante || 10);

            // Règle: Atteindre 50 arbres pour compléter le niveau
            if (this.treeCount >= 50) {
              GameState.addScore(this.jeu.scoring.foret_complete || 200);
              this.time.delayedCall(1000, () => GameState.triggerGameOver());
            }
          }
        });
      }
    });
  }

  private spawnFire(): void {
    // Find a tree to set on fire (growing or mature)
    const treeCells: TreeCell[] = [];
    for (let r = 0; r < GRID_ROWS; r++) {
      for (let c = 0; c < GRID_COLS; c++) {
        const cell = this.grid[r][c];
        if (cell.state === 'mature' || cell.state === 'growing1' || cell.state === 'growing2') {
          treeCells.push(cell);
        }
      }
    }

    if (treeCells.length === 0) return;

    const target = treeCells[Phaser.Math.Between(0, treeCells.length - 1)];
    if (target.growTimer) target.growTimer.destroy();

    this.setCellState(target, 'fire');

    // Règle: Ignorer un incendie détruit 3 arbres adjacents (after 4 seconds)
    target.fireTimer = this.time.delayedCall(4000, () => {
      if (target.state === 'fire') {
        this.destroyTree(target);
        // Destroy up to 3 adjacent trees
        const adjacents = this.getAdjacentCells(target.row, target.col);
        let destroyed = 0;
        for (const adj of adjacents) {
          if (destroyed >= 3) break;
          if (adj.state === 'mature' || adj.state === 'growing1' || adj.state === 'growing2') {
            this.destroyTree(adj);
            destroyed++;
          }
        }
      }
    });
  }

  private extinguishFire(cell: TreeCell): void {
    // Règle: Les incendies apparaissent aléatoirement, tap rapide pour éteindre
    if (cell.fireTimer) cell.fireTimer.destroy();
    GameState.addScore(this.jeu.scoring.incendie_eteint || 25);
    this.setCellState(cell, 'empty');
  }

  private destroyTree(cell: TreeCell): void {
    if (cell.state === 'mature') {
      this.treeCount = Math.max(0, this.treeCount - 1);
      this.treeCountText.setText(`Arbres: ${this.treeCount}/50`);
    }
    // Règle: Arbre perdu
    GameState.addScore(this.jeu.scoring.arbre_perdu || -15);
    if (cell.growTimer) cell.growTimer.destroy();
    if (cell.fireTimer) cell.fireTimer.destroy();
    this.setCellState(cell, 'empty');
  }

  private getAdjacentCells(row: number, col: number): TreeCell[] {
    const cells: TreeCell[] = [];
    const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
    for (const [dr, dc] of dirs) {
      const r = row + dr, c = col + dc;
      if (r >= 0 && r < GRID_ROWS && c >= 0 && c < GRID_COLS) {
        cells.push(this.grid[r][c]);
      }
    }
    return cells;
  }

  private setCellState(cell: TreeCell, state: TreeCell['state']): void {
    cell.state = state;
    const visual = TREE_VISUALS[state];
    cell.sprite.setFillStyle(visual.color);
    cell.label.setText(visual.text);
  }

  shutdown(): void {
    super.shutdown();
    if (this.fireSpawnTimer) this.fireSpawnTimer.destroy();
    for (const row of this.grid) {
      for (const cell of row) {
        if (cell.growTimer) cell.growTimer.destroy();
        if (cell.fireTimer) cell.fireTimer.destroy();
      }
    }
  }
}

registerScene('la-foret-enchantee', LaForetEnchanteeScene);
