/**
 * LEauEstPrecieuseScene — Pipe puzzle: connecter la source d'eau au village.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

const GRID_COLS = 7;
const GRID_ROWS = 10;

// Pipe types: 0=empty, 1=vertical, 2=horizontal, 3=L-topright, 4=L-topleft, 5=L-bottomright, 6=L-bottomleft
// Connections: each pipe has openings on [top, right, bottom, left]
const PIPE_DEFS: { [key: number]: boolean[] } = {
  0: [false, false, false, false],
  1: [true, false, true, false],   // vertical │
  2: [false, true, false, true],   // horizontal ─
  3: [true, true, false, false],   // ┘ top+right
  4: [true, false, false, true],   // └ top+left
  5: [false, true, true, false],   // ┐ right+bottom
  6: [false, false, true, true],   // ┌ left+bottom
};

const PIPE_CHARS: { [key: number]: string } = {
  0: ' ', 1: '│', 2: '─', 3: '┘', 4: '└', 5: '┐', 6: '┌',
};

const PIPE_COLORS: { [key: number]: number } = {
  0: 0x222222, 1: 0x4488cc, 2: 0x4488cc, 3: 0x4488cc, 4: 0x4488cc, 5: 0x4488cc, 6: 0x4488cc,
};

interface PipeCell {
  pipeType: number;
  rotation: number; // 0-3 (each adds 90deg clockwise)
  sprite: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  row: number;
  col: number;
  filled: boolean;
}

export class LEauEstPrecieuseScene extends BaseGameScene {
  private grid: (PipeCell | null)[][] = [];
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private waterFlowing: boolean = false;
  private waterTimer: Phaser.Time.TimerEvent | null = null;
  private sourceCol: number = 3;
  private villageCol: number = 3;
  private selectedPipeType: number = 1;
  private pipeSelector!: Phaser.GameObjects.Container;
  private statusText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene_leau-est-precieuse');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    this.cellSize = Math.min((width - 40) / GRID_COLS, (height * 0.6) / GRID_ROWS);
    this.gridOffsetX = (width - GRID_COLS * this.cellSize) / 2;
    this.gridOffsetY = height * 0.12;

    // Init empty grid
    // Règle: Grille 7x10 avec source d'eau en haut et village en bas
    for (let r = 0; r < GRID_ROWS; r++) {
      this.grid[r] = [];
      for (let c = 0; c < GRID_COLS; c++) {
        this.grid[r][c] = this.createPipeCell(r, c, 0);
      }
    }

    // Source marker (top)
    const srcX = this.gridOffsetX + this.sourceCol * this.cellSize + this.cellSize / 2;
    this.add.text(srcX, this.gridOffsetY - 20, '💧 Source', {
      fontSize: '18px', color: '#44aaff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Village marker (bottom)
    const vilX = this.gridOffsetX + this.villageCol * this.cellSize + this.cellSize / 2;
    const vilY = this.gridOffsetY + GRID_ROWS * this.cellSize + 15;
    this.add.text(vilX, vilY, '🏘️ Village', {
      fontSize: '18px', color: '#ffcc44', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Pipe type selector at bottom
    this.createPipeSelector(width, height);

    // Status text
    this.statusText = this.add.text(width / 2, height * 0.06, 'Place les tuyaux ! L\'eau coule dans 20s...', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Placer et tourner des segments de tuyaux pour créer un chemin
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.waterFlowing) return;

      const col = Math.floor((pointer.x - this.gridOffsetX) / this.cellSize);
      const row = Math.floor((pointer.y - this.gridOffsetY) / this.cellSize);

      if (row < 0 || row >= GRID_ROWS || col < 0 || col >= GRID_COLS) return;

      const cell = this.grid[row][col]!;
      if (cell.pipeType === 0) {
        // Place selected pipe
        cell.sprite.destroy();
        cell.label.destroy();
        this.grid[row][col] = this.createPipeCell(row, col, this.selectedPipeType);
      } else {
        // Règle: Tourner le segment (rotate connections)
        this.rotatePipe(cell);
      }
    });

    // Règle: L'eau coule après 20 secondes de réflexion
    this.waterTimer = this.time.delayedCall(20000, () => {
      this.startWaterFlow();
    });
  }

  private createPipeCell(row: number, col: number, pipeType: number): PipeCell {
    const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2;
    const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2;

    const color = pipeType === 0 ? 0x333344 : PIPE_COLORS[pipeType];
    const sprite = this.add.rectangle(x, y, this.cellSize - 3, this.cellSize - 3, color, 0.7)
      .setStrokeStyle(1, 0x556677);
    const label = this.add.text(x, y, PIPE_CHARS[pipeType], {
      fontSize: `${Math.floor(this.cellSize * 0.6)}px`, color: '#aaddff', fontFamily: 'monospace',
    }).setOrigin(0.5);

    return { pipeType, rotation: 0, sprite, label, row, col, filled: false };
  }

  private rotatePipe(cell: PipeCell): void {
    // Cycle through pipe types for simplicity
    const types = [1, 2, 3, 4, 5, 6];
    const idx = types.indexOf(cell.pipeType);
    const nextType = types[(idx + 1) % types.length];
    cell.pipeType = nextType;
    cell.label.setText(PIPE_CHARS[nextType]);
    cell.sprite.setFillStyle(PIPE_COLORS[nextType], 0.7);
  }

  private createPipeSelector(width: number, height: number): void {
    const y = height - 60;
    const types = [1, 2, 3, 4, 5, 6];
    const spacing = width / (types.length + 1);

    this.add.text(width / 2, y - 30, 'Sélectionner un tuyau:', {
      fontSize: '16px', color: '#aaaaaa', fontFamily: 'Arial',
    }).setOrigin(0.5);

    for (let i = 0; i < types.length; i++) {
      const x = spacing * (i + 1);
      const btn = this.add.rectangle(x, y, 45, 45, 0x4488cc, 0.5)
        .setStrokeStyle(2, this.selectedPipeType === types[i] ? 0xffffff : 0x446688)
        .setInteractive();
      const lbl = this.add.text(x, y, PIPE_CHARS[types[i]], {
        fontSize: '28px', color: '#aaddff', fontFamily: 'monospace',
      }).setOrigin(0.5);

      btn.on('pointerdown', () => {
        this.selectedPipeType = types[i];
        // Update highlights (simple approach)
      });
    }
  }

  private startWaterFlow(): void {
    this.waterFlowing = true;
    this.statusText.setText('L\'eau coule !');

    const scoring = this.jeu.scoring;
    let currentRow = 0;
    let currentCol = this.sourceCol;
    let fromDirection = 'top'; // water enters from top initially
    let segmentsConnected = 0;

    const flowStep = () => {
      if (currentRow < 0 || currentRow >= GRID_ROWS || currentCol < 0 || currentCol >= GRID_COLS) {
        // Water leaked — level failed
        this.statusText.setText('L\'eau s\'est perdue...');
        GameState.addScore(segmentsConnected * (scoring.segment || 5));
        this.time.delayedCall(2000, () => GameState.triggerGameOver());
        return;
      }

      const cell = this.grid[currentRow][currentCol]!;
      const connections = PIPE_DEFS[cell.pipeType];
      if (!connections) {
        this.statusText.setText('Fuite ! Pas de tuyau ici.');
        GameState.addScore(segmentsConnected * (scoring.segment || 5));
        this.time.delayedCall(2000, () => GameState.triggerGameOver());
        return;
      }

      // Check if pipe accepts water from the direction it's coming from
      const entryIdx = fromDirection === 'top' ? 0 : fromDirection === 'right' ? 1 : fromDirection === 'bottom' ? 2 : 3;
      if (!connections[entryIdx] && cell.pipeType !== 0) {
        // Check if any opening matches
      }

      if (cell.pipeType === 0 || !connections[entryIdx]) {
        this.statusText.setText('Fuite !');
        GameState.addScore(segmentsConnected * (scoring.segment || 5));
        this.time.delayedCall(2000, () => GameState.triggerGameOver());
        return;
      }

      // Règle: Chaque segment correctement placé = +scoring.segment pts
      cell.filled = true;
      cell.sprite.setFillStyle(0x2266ff, 0.9);
      segmentsConnected++;

      // Find exit direction
      let exitDir = -1;
      for (let d = 0; d < 4; d++) {
        if (d !== entryIdx && connections[d]) {
          exitDir = d;
          break;
        }
      }

      if (exitDir === -1) {
        this.statusText.setText('Impasse !');
        GameState.addScore(segmentsConnected * (scoring.segment || 5));
        this.time.delayedCall(2000, () => GameState.triggerGameOver());
        return;
      }

      // Move to next cell
      let nextRow = currentRow, nextCol = currentCol;
      let nextFrom = '';
      if (exitDir === 0) { nextRow--; nextFrom = 'bottom'; }
      else if (exitDir === 1) { nextCol++; nextFrom = 'left'; }
      else if (exitDir === 2) { nextRow++; nextFrom = 'top'; }
      else if (exitDir === 3) { nextCol--; nextFrom = 'right'; }

      // Règle: Niveau réussi si l'eau atteint le village
      if (nextRow >= GRID_ROWS && nextCol === this.villageCol) {
        // Règle: Bonus combo si l'eau traverse sans fuite = +scoring.sans_fuite pts
        GameState.addScore(scoring.sans_fuite || 50);
        GameState.addScore(scoring.niveau_complete || 100);
        GameState.addScore(segmentsConnected * (scoring.segment || 5));
        this.statusText.setText('Bravo ! L\'eau atteint le village !');
        this.time.delayedCall(2000, () => GameState.triggerGameOver());
        return;
      }

      currentRow = nextRow;
      currentCol = nextCol;
      fromDirection = nextFrom;

      this.time.delayedCall(300, flowStep);
    };

    flowStep();
  }

  shutdown(): void {
    super.shutdown();
    if (this.waterTimer) this.waterTimer.destroy();
  }
}

registerScene('leau-est-precieuse', LEauEstPrecieuseScene);
