/**
 * LeCovoiturageSolidaireScene — Pathfinding: trace routes to pick up passengers.
 * Tracer le trajet en glissant le doigt sur la route.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Passenger {
  x: number;
  y: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  collected: boolean;
  gridR: number;
  gridC: number;
}

interface TrafficZone {
  x: number;
  y: number;
  rect: Phaser.GameObjects.Rectangle;
}

export class LeCovoiturageSolidaireScene extends BaseGameScene {
  private gridCols: number = 8;
  private gridRows: number = 10;
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private car!: Phaser.GameObjects.Container;
  private carGridR: number = 0;
  private carGridC: number = 0;
  private passengers: Passenger[] = [];
  private trafficZones: TrafficZone[] = [];
  private fuel: number = 100;
  private maxFuel: number = 100;
  private fuelBar!: Phaser.GameObjects.Rectangle;
  private fuelBarBg!: Phaser.GameObjects.Rectangle;
  private fuelText!: Phaser.GameObjects.Text;
  private pathGraphics!: Phaser.GameObjects.Graphics;
  private isDrawing: boolean = false;
  private pathPoints: { r: number; c: number }[] = [];
  private roadCells: boolean[][] = [];
  private totalDistance: number = 0;
  private collectedCount: number = 0;

  constructor() {
    super('GameScene_le-covoiturage-solidaire');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: Carte de la ville avec des passagers à récupérer
    this.cellSize = Math.floor(Math.min((width - 20) / this.gridCols, (height - 120) / this.gridRows));
    this.gridOffsetX = (width - this.gridCols * this.cellSize) / 2;
    this.gridOffsetY = 70;

    // Generate road layout (simple grid roads)
    this.roadCells = [];
    for (let r = 0; r < this.gridRows; r++) {
      this.roadCells[r] = [];
      for (let c = 0; c < this.gridCols; c++) {
        // Roads on every other row and every other column
        this.roadCells[r][c] = (r % 2 === 0) || (c % 2 === 0);
      }
    }

    // Draw map
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
        const isRoad = this.roadCells[r][c];
        this.add.rectangle(x, y, this.cellSize - 1, this.cellSize - 1,
          isRoad ? 0x555555 : 0x336633, isRoad ? 0.8 : 0.4);
      }
    }

    // Place car at top-left road cell
    this.carGridR = 0;
    this.carGridC = 0;
    const carX = this.gridOffsetX + this.carGridC * this.cellSize + this.cellSize / 2;
    const carY = this.gridOffsetY + this.carGridR * this.cellSize + this.cellSize / 2;
    const carRect = this.add.rectangle(0, 0, this.cellSize - 8, this.cellSize - 8, 0x2288ff);
    const carLabel = this.add.text(0, 0, '🚗', { fontSize: `${this.cellSize * 0.5}px` }).setOrigin(0.5);
    this.car = this.add.container(carX, carY, [carRect, carLabel]).setDepth(10);

    // Place passengers on road cells
    const passengerCount = 6;
    const usedCells = new Set<string>();
    usedCells.add('0,0');
    for (let i = 0; i < passengerCount; i++) {
      let pr: number, pc: number;
      do {
        pr = Phaser.Math.Between(1, this.gridRows - 1);
        pc = Phaser.Math.Between(0, this.gridCols - 1);
      } while (!this.roadCells[pr][pc] || usedCells.has(`${pr},${pc}`));
      usedCells.add(`${pr},${pc}`);

      const px = this.gridOffsetX + pc * this.cellSize + this.cellSize / 2;
      const py = this.gridOffsetY + pr * this.cellSize + this.cellSize / 2;
      const rect = this.add.rectangle(px, py, this.cellSize * 0.6, this.cellSize * 0.6, 0xffaa00).setDepth(5);
      const label = this.add.text(px, py, '🧑', { fontSize: `${this.cellSize * 0.35}px` }).setOrigin(0.5).setDepth(5);
      this.passengers.push({ x: px, y: py, rect, label, collected: false, gridR: pr, gridC: pc });
    }

    // Règle: Attention aux embouteillages (zones rouges = ralentissement)
    const trafficCount = 4;
    for (let i = 0; i < trafficCount; i++) {
      let tr: number, tc: number;
      do {
        tr = Phaser.Math.Between(1, this.gridRows - 1);
        tc = Phaser.Math.Between(0, this.gridCols - 1);
      } while (!this.roadCells[tr][tc] || usedCells.has(`${tr},${tc}`));
      usedCells.add(`${tr},${tc}`);

      const tx = this.gridOffsetX + tc * this.cellSize + this.cellSize / 2;
      const ty = this.gridOffsetY + tr * this.cellSize + this.cellSize / 2;
      const rect = this.add.rectangle(tx, ty, this.cellSize - 4, this.cellSize - 4, 0xff0000, 0.3).setDepth(3);
      this.trafficZones.push({ x: tx, y: ty, rect });
    }

    // Fuel bar
    this.fuelBarBg = this.add.rectangle(width / 2, 30, 200, 20, 0x333333).setDepth(10);
    this.fuelBar = this.add.rectangle(width / 2, 30, 200, 20, 0x00cc00).setDepth(11);
    this.fuelText = this.add.text(width / 2, 30, 'Essence: 100%', {
      fontSize: '14px', color: '#fff', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(12);

    // Path drawing
    this.pathGraphics = this.add.graphics().setDepth(8);

    // Règle: Tracer le trajet en glissant le doigt sur la route
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (GameState.isGameOver) return;
      const cell = this.getCellAt(pointer.x, pointer.y);
      if (!cell) return;
      // Must start from car position
      if (cell.r === this.carGridR && cell.c === this.carGridC) {
        this.isDrawing = true;
        this.pathPoints = [{ r: cell.r, c: cell.c }];
        this.pathGraphics.clear();
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDrawing || GameState.isGameOver) return;
      const cell = this.getCellAt(pointer.x, pointer.y);
      if (!cell || !this.roadCells[cell.r][cell.c]) return;

      const last = this.pathPoints[this.pathPoints.length - 1];
      if (cell.r === last.r && cell.c === last.c) return;

      // Must be adjacent
      const dr = Math.abs(cell.r - last.r);
      const dc = Math.abs(cell.c - last.c);
      if (dr + dc !== 1) return;

      // Don't revisit
      if (this.pathPoints.find(p => p.r === cell.r && p.c === cell.c)) return;

      this.pathPoints.push({ r: cell.r, c: cell.c });
      this.drawPath();
    });

    this.input.on('pointerup', () => {
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (this.pathPoints.length > 1) {
        this.executePath();
      }
    });
  }

  private getCellAt(px: number, py: number): { r: number; c: number } | null {
    const c = Math.floor((px - this.gridOffsetX) / this.cellSize);
    const r = Math.floor((py - this.gridOffsetY) / this.cellSize);
    if (r < 0 || r >= this.gridRows || c < 0 || c >= this.gridCols) return null;
    return { r, c };
  }

  private drawPath(): void {
    this.pathGraphics.clear();
    this.pathGraphics.lineStyle(4, 0x00ffff, 0.8);
    this.pathGraphics.beginPath();
    this.pathPoints.forEach((pt, i) => {
      const x = this.gridOffsetX + pt.c * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + pt.r * this.cellSize + this.cellSize / 2;
      if (i === 0) this.pathGraphics.moveTo(x, y);
      else this.pathGraphics.lineTo(x, y);
    });
    this.pathGraphics.strokePath();
  }

  private executePath(): void {
    const scoring = this.jeu.scoring;
    let stepIdx = 0;

    const moveStep = () => {
      if (stepIdx >= this.pathPoints.length || GameState.isGameOver) {
        this.pathGraphics.clear();
        // Règle: Trajet optimal (court) = bonus
        if (this.collectedCount === this.passengers.length) {
          const minPossible = this.passengers.length * 2;
          if (this.totalDistance <= minPossible) {
            GameState.addScore(scoring.trajet_optimal || 30);
          }
          // Règle: Essence économisée
          if (this.fuel > 30) {
            GameState.addScore(scoring.essence_economisee || 20);
          }
        }
        return;
      }

      const pt = this.pathPoints[stepIdx];
      this.carGridR = pt.r;
      this.carGridC = pt.c;

      const x = this.gridOffsetX + pt.c * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + pt.r * this.cellSize + this.cellSize / 2;

      // Règle: Récupérer tous les passagers sans dépasser la jauge d'essence
      let fuelCost = 2;
      // Check traffic zone
      const inTraffic = this.trafficZones.some(tz =>
        Math.abs(tz.x - x) < this.cellSize / 2 && Math.abs(tz.y - y) < this.cellSize / 2
      );
      if (inTraffic) {
        // Règle: Embouteillages = ralentissement + extra fuel
        fuelCost = 5;
        GameState.addScore(scoring.embouteillage_malus || -5);
      }

      this.fuel -= fuelCost;
      this.totalDistance++;
      this.updateFuelBar();

      if (this.fuel <= 0) {
        GameState.triggerGameOver();
        return;
      }

      this.tweens.add({
        targets: this.car, x, y, duration: inTraffic ? 400 : 150,
        onComplete: () => {
          // Règle: Chaque passager récupéré = +scoring.passager pts, +2 solidarité
          for (const p of this.passengers) {
            if (!p.collected && p.gridR === pt.r && p.gridC === pt.c) {
              p.collected = true;
              p.rect.setFillStyle(0x00ff00);
              p.label.setText('✅');
              this.collectedCount++;
              GameState.addScore(scoring.passager || 10);
              GameState.addSolidarite(2);
            }
          }
          stepIdx++;
          moveStep();
        },
      });
    };

    moveStep();
  }

  private updateFuelBar(): void {
    const pct = Math.max(0, this.fuel / this.maxFuel);
    this.fuelBar.setScale(pct, 1);
    this.fuelBar.setFillStyle(pct > 0.3 ? 0x00cc00 : 0xff4400);
    this.fuelText.setText(`Essence: ${Math.floor(pct * 100)}%`);
  }

  shutdown(): void {
    super.shutdown();
  }
}

registerScene('le-covoiturage-solidaire', LeCovoiturageSolidaireScene);
