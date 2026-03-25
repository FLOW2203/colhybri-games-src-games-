/**
 * LeJardinPartageScene — Puzzle match-3 avec graines colorées.
 * Grille 6x8, swap adjacents, alignements de 3/4/5.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

const COLS = 6;
const ROWS = 8;
const SEED_COLORS = [0xff4444, 0x44ff44, 0x4444ff, 0xffaa00, 0xff44ff];
const SEED_LABELS = ['🌹', '🌿', '💎', '🌻', '🌸'];

interface Cell {
  colorIdx: number;
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  row: number;
  col: number;
}

export class LeJardinPartageScene extends BaseGameScene {
  private grid: (Cell | null)[][] = [];
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private selectedCell: Cell | null = null;
  private movesLeft: number = 30;
  private movesText!: Phaser.GameObjects.Text;
  private comboCount: number = 0;
  private isProcessing: boolean = false;

  constructor() {
    super('GameScene_le-jardin-partage');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Règle: Grille 6x8 remplie de graines colorées
    this.cellSize = Math.min(width / (COLS + 1), (height * 0.7) / (ROWS + 1));
    this.gridOffsetX = (width - COLS * this.cellSize) / 2;
    this.gridOffsetY = height * 0.15;

    // Règle: Objectif : atteindre le score cible en 30 coups max
    this.movesLeft = 30;
    this.movesText = this.add.text(width / 2, height * 0.07, `Coups: ${this.movesLeft}`, {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.initGrid();
    this.removeInitialMatches();

    this.input.on('gameobjectdown', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.GameObject) => {
      if (this.isProcessing) return;
      const cell = this.findCellBySprite(gameObject);
      if (!cell) return;

      if (this.selectedCell === null) {
        this.selectedCell = cell;
        cell.sprite.setStrokeStyle(3, 0xffffff);
      } else {
        // Règle: Swap adjacents pour aligner 3+ graines identiques
        if (this.areAdjacent(this.selectedCell, cell)) {
          this.selectedCell.sprite.setStrokeStyle(0);
          this.swapCells(this.selectedCell, cell);
        } else {
          this.selectedCell.sprite.setStrokeStyle(0);
          this.selectedCell = cell;
          cell.sprite.setStrokeStyle(3, 0xffffff);
        }
      }
    });
  }

  private initGrid(): void {
    this.grid = [];
    for (let r = 0; r < ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < COLS; c++) {
        this.grid[r][c] = this.createCell(r, c);
      }
    }
  }

  private createCell(row: number, col: number): Cell {
    const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2;
    const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2;
    const colorIdx = Phaser.Math.Between(0, SEED_COLORS.length - 1);

    const sprite = this.add.rectangle(x, y, this.cellSize - 4, this.cellSize - 4, SEED_COLORS[colorIdx]);
    sprite.setInteractive();
    const label = this.add.text(x, y, SEED_LABELS[colorIdx], {
      fontSize: `${Math.floor(this.cellSize * 0.5)}px`,
    }).setOrigin(0.5);

    return { colorIdx, sprite, label, row, col };
  }

  private findCellBySprite(obj: Phaser.GameObjects.GameObject): Cell | null {
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = this.grid[r][c];
        if (cell && (cell.sprite === obj || cell.label === obj)) return cell;
      }
    }
    return null;
  }

  private areAdjacent(a: Cell, b: Cell): boolean {
    return (Math.abs(a.row - b.row) + Math.abs(a.col - b.col)) === 1;
  }

  private swapCells(a: Cell, b: Cell): void {
    // Swap in grid
    this.grid[a.row][a.col] = b;
    this.grid[b.row][b.col] = a;

    const tempR = a.row, tempC = a.col;
    a.row = b.row; a.col = b.col;
    b.row = tempR; b.col = tempC;

    // Animate swap
    this.updateCellPosition(a);
    this.updateCellPosition(b);

    const matches = this.findMatches();
    if (matches.length === 0) {
      // Swap back
      this.grid[a.row][a.col] = b;
      this.grid[b.row][b.col] = a;
      const tr = a.row, tc = a.col;
      a.row = b.row; a.col = b.col;
      b.row = tr; b.col = tc;
      this.updateCellPosition(a);
      this.updateCellPosition(b);
    } else {
      this.movesLeft--;
      this.movesText.setText(`Coups: ${this.movesLeft}`);
      this.comboCount = 0;
      this.isProcessing = true;
      this.processMatches(matches);
    }
    this.selectedCell = null;
  }

  private updateCellPosition(cell: Cell): void {
    const x = this.gridOffsetX + cell.col * this.cellSize + this.cellSize / 2;
    const y = this.gridOffsetY + cell.row * this.cellSize + this.cellSize / 2;
    cell.sprite.setPosition(x, y);
    cell.label.setPosition(x, y);
  }

  private findMatches(): { row: number; col: number }[] {
    const matched = new Set<string>();

    // Horizontal matches
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c <= COLS - 3; c++) {
        const a = this.grid[r][c], b = this.grid[r][c + 1], cc = this.grid[r][c + 2];
        if (a && b && cc && a.colorIdx === b.colorIdx && b.colorIdx === cc.colorIdx) {
          matched.add(`${r},${c}`);
          matched.add(`${r},${c + 1}`);
          matched.add(`${r},${c + 2}`);
          // Extend
          for (let e = c + 3; e < COLS; e++) {
            const ext = this.grid[r][e];
            if (ext && ext.colorIdx === a.colorIdx) matched.add(`${r},${e}`);
            else break;
          }
        }
      }
    }

    // Vertical matches
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r <= ROWS - 3; r++) {
        const a = this.grid[r][c], b = this.grid[r + 1][c], cc = this.grid[r + 2][c];
        if (a && b && cc && a.colorIdx === b.colorIdx && b.colorIdx === cc.colorIdx) {
          matched.add(`${r},${c}`);
          matched.add(`${r + 1},${c}`);
          matched.add(`${r + 2},${c}`);
          for (let e = r + 3; e < ROWS; e++) {
            const ext = this.grid[e][c];
            if (ext && ext.colorIdx === a.colorIdx) matched.add(`${e},${c}`);
            else break;
          }
        }
      }
    }

    return Array.from(matched).map(s => {
      const [row, col] = s.split(',').map(Number);
      return { row, col };
    });
  }

  private processMatches(matches: { row: number; col: number }[]): void {
    const scoring = this.jeu.scoring;
    this.comboCount++;

    // Group matches by connected sets to determine match size
    // Simple approach: count total matched cells per processing step
    const matchSize = matches.length;
    let baseScore: number;

    if (matchSize >= 5) {
      // Règle: Alignement de 5 = légume solidaire (+scoring.match_5 pts, +5 solidarité)
      baseScore = scoring.match_5 || 50;
      GameState.addSolidarite(5);
    } else if (matchSize >= 4) {
      // Règle: Alignement de 4 = fleur bonus (+scoring.match_4 pts)
      baseScore = scoring.match_4 || 30;
    } else {
      // Règle: Alignement de 3 = pousse normale (+scoring.match_3 pts)
      baseScore = scoring.match_3 || 10;
    }

    // Apply combo multiplier
    const multiplier = this.comboCount > 1 ? (scoring.combo_multiplier || 1.5) : 1;
    GameState.addScore(Math.floor(baseScore * multiplier));

    // Remove matched cells
    for (const m of matches) {
      const cell = this.grid[m.row][m.col];
      if (cell) {
        cell.sprite.destroy();
        cell.label.destroy();
        this.grid[m.row][m.col] = null;
      }
    }

    // Drop cells down and refill
    this.time.delayedCall(200, () => {
      this.dropCells();
      this.refillGrid();

      this.time.delayedCall(300, () => {
        const newMatches = this.findMatches();
        if (newMatches.length > 0) {
          this.processMatches(newMatches);
        } else {
          this.isProcessing = false;
          // Règle: Objectif : atteindre le score cible en 30 coups max
          if (this.movesLeft <= 0) {
            GameState.triggerGameOver();
          }
        }
      });
    });
  }

  private dropCells(): void {
    for (let c = 0; c < COLS; c++) {
      let emptyRow = ROWS - 1;
      for (let r = ROWS - 1; r >= 0; r--) {
        if (this.grid[r][c] !== null) {
          if (r !== emptyRow) {
            this.grid[emptyRow][c] = this.grid[r][c];
            this.grid[r][c] = null;
            this.grid[emptyRow][c]!.row = emptyRow;
            this.grid[emptyRow][c]!.col = c;
            this.updateCellPosition(this.grid[emptyRow][c]!);
          }
          emptyRow--;
        }
      }
    }
  }

  private refillGrid(): void {
    for (let c = 0; c < COLS; c++) {
      for (let r = 0; r < ROWS; r++) {
        if (this.grid[r][c] === null) {
          this.grid[r][c] = this.createCell(r, c);
        }
      }
    }
  }

  private removeInitialMatches(): void {
    let matches = this.findMatches();
    let safety = 0;
    while (matches.length > 0 && safety < 50) {
      for (const m of matches) {
        const cell = this.grid[m.row][m.col];
        if (cell) {
          cell.sprite.destroy();
          cell.label.destroy();
          this.grid[m.row][m.col] = this.createCell(m.row, m.col);
        }
      }
      matches = this.findMatches();
      safety++;
    }
  }
}

registerScene('le-jardin-partage', LeJardinPartageScene);
