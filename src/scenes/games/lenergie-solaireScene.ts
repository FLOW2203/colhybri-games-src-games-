/**
 * LEnergieSolaireScene — Strategy: place solar panels on village roofs.
 * Connecter les panneaux aux maisons pour alimenter 100% du village.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface House {
  x: number;
  y: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  powered: boolean;
  connectedPanel: Panel | null;
}

interface Panel {
  x: number;
  y: number;
  rect: Phaser.GameObjects.Rectangle;
  label: Phaser.GameObjects.Text;
  production: number;
  gridCol: number;
  gridRow: number;
  clouded: boolean;
}

interface Cable {
  line: Phaser.GameObjects.Line;
  panel: Panel;
  house: House;
}

export class LEnergieSolaireScene extends BaseGameScene {
  private gridCols: number = 6;
  private gridRows: number = 6;
  private cellSize: number = 0;
  private gridOffsetX: number = 0;
  private gridOffsetY: number = 0;
  private houses: House[] = [];
  private panels: Panel[] = [];
  private cables: Cable[] = [];
  private clouds: Phaser.GameObjects.Container[] = [];
  private selectedPanel: Panel | null = null;
  private cableMode: boolean = false;
  private energyText!: Phaser.GameObjects.Text;
  private cloudTimer: Phaser.Time.TimerEvent | null = null;
  private productionTimer: Phaser.Time.TimerEvent | null = null;
  private roofCells: boolean[][] = [];

  constructor() {
    super('GameScene_lenergie-solaire');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: Grille représentant un village vu du dessus
    this.cellSize = Math.floor(Math.min((width - 40) / this.gridCols, (height - 160) / this.gridRows));
    this.gridOffsetX = (width - this.gridCols * this.cellSize) / 2;
    this.gridOffsetY = (height - this.gridRows * this.cellSize) / 2 + 20;

    // Initialize roof availability
    this.roofCells = [];
    for (let r = 0; r < this.gridRows; r++) {
      this.roofCells[r] = [];
      for (let c = 0; c < this.gridCols; c++) {
        this.roofCells[r][c] = false;
      }
    }

    // Draw grid and place houses randomly
    for (let r = 0; r < this.gridRows; r++) {
      for (let c = 0; c < this.gridCols; c++) {
        const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
        const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
        this.add.rectangle(x, y, this.cellSize - 2, this.cellSize - 2, 0x556B2F, 0.3);
      }
    }

    // Règle: Place houses on the grid (8-10 houses)
    const houseCount = Phaser.Math.Between(8, 10);
    const positions: { r: number; c: number }[] = [];
    while (positions.length < houseCount + 6) { // extra for roof spots
      const r = Phaser.Math.Between(0, this.gridRows - 1);
      const c = Phaser.Math.Between(0, this.gridCols - 1);
      if (!positions.find(p => p.r === r && p.c === c)) {
        positions.push({ r, c });
      }
    }

    // First positions are houses
    for (let i = 0; i < houseCount; i++) {
      const { r, c } = positions[i];
      const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
      const rect = this.add.rectangle(x, y, this.cellSize - 6, this.cellSize - 6, 0x8B4513);
      const label = this.add.text(x, y, '🏠', { fontSize: `${this.cellSize * 0.4}px` }).setOrigin(0.5);
      this.houses.push({ x, y, rect, label, powered: false, connectedPanel: null });
    }

    // Remaining positions are available roof spots for panels
    for (let i = houseCount; i < positions.length; i++) {
      const { r, c } = positions[i];
      this.roofCells[r][c] = true;
      const x = this.gridOffsetX + c * this.cellSize + this.cellSize / 2;
      const y = this.gridOffsetY + r * this.cellSize + this.cellSize / 2;
      // Mark as available roof
      this.add.rectangle(x, y, this.cellSize - 6, this.cellSize - 6, 0xDDDDDD, 0.4);
      this.add.text(x, y - this.cellSize * 0.2, '⬜', { fontSize: `${this.cellSize * 0.25}px` }).setOrigin(0.5);
    }

    // Energy meter
    this.energyText = this.add.text(width / 2, 30, 'Village : 0%', {
      fontSize: '24px', color: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    // Mode toggle button
    const modeBtn = this.add.rectangle(width - 60, 30, 100, 36, 0x4488ff);
    const modeBtnText = this.add.text(width - 60, 30, 'Câble', {
      fontSize: '16px', color: '#fff', fontFamily: 'Arial',
    }).setOrigin(0.5);
    modeBtn.setInteractive();
    modeBtn.on('pointerdown', () => {
      this.cableMode = !this.cableMode;
      modeBtnText.setText(this.cableMode ? 'Placer' : 'Câble');
      modeBtn.setFillStyle(this.cableMode ? 0xff8844 : 0x4488ff);
    });

    // Règle: Tap pour placer des panneaux solaires sur les toits
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (GameState.isGameOver) return;
      const col = Math.floor((pointer.x - this.gridOffsetX) / this.cellSize);
      const row = Math.floor((pointer.y - this.gridOffsetY) / this.cellSize);
      if (col < 0 || col >= this.gridCols || row < 0 || row >= this.gridRows) return;

      if (!this.cableMode) {
        this.tryPlacePanel(row, col);
      } else {
        this.trySelectForCable(pointer.x, pointer.y);
      }
    });

    // Règle: Les nuages passent et réduisent temporairement la production
    this.cloudTimer = this.time.addEvent({
      delay: 4000,
      loop: true,
      callback: () => this.spawnCloud(),
    });

    // Production tick
    this.productionTimer = this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => this.updateProduction(),
    });
  }

  private tryPlacePanel(row: number, col: number): void {
    if (!this.roofCells[row][col]) return;
    // Check no panel already there
    if (this.panels.find(p => p.gridCol === col && p.gridRow === row)) return;

    const scoring = this.jeu.scoring;
    const x = this.gridOffsetX + col * this.cellSize + this.cellSize / 2;
    const y = this.gridOffsetY + row * this.cellSize + this.cellSize / 2;

    const rect = this.add.rectangle(x, y, this.cellSize - 8, this.cellSize - 8, 0x2244AA);
    const label = this.add.text(x, y, '☀️', { fontSize: `${this.cellSize * 0.4}px` }).setOrigin(0.5);

    const panel: Panel = { x, y, rect, label, production: 1, gridCol: col, gridRow: row, clouded: false };
    this.panels.push(panel);

    // Règle: Chaque panneau produit de l'énergie selon l'ensoleillement
    GameState.addScore(scoring.panneau_place || 10);
  }

  private trySelectForCable(px: number, py: number): void {
    const scoring = this.jeu.scoring;

    if (!this.selectedPanel) {
      // Select a panel
      for (const panel of this.panels) {
        if (Math.abs(panel.x - px) < this.cellSize / 2 && Math.abs(panel.y - py) < this.cellSize / 2) {
          this.selectedPanel = panel;
          panel.rect.setStrokeStyle(3, 0xffff00);
          return;
        }
      }
    } else {
      // Règle: Connecter les panneaux aux maisons avec des câbles
      for (const house of this.houses) {
        if (Math.abs(house.x - px) < this.cellSize / 2 && Math.abs(house.y - py) < this.cellSize / 2) {
          if (!house.powered) {
            const line = this.add.line(0, 0, this.selectedPanel.x, this.selectedPanel.y, house.x, house.y, 0xffff00).setLineWidth(2).setOrigin(0, 0);
            this.cables.push({ line, panel: this.selectedPanel, house });
            house.powered = true;
            house.connectedPanel = this.selectedPanel;
            house.rect.setFillStyle(0x00aa00);
            GameState.addScore(scoring.maison_alimentee || 25);
            GameState.addScore(scoring.cable_optimise || 5);
            GameState.addSolidarite(3);

            // Règle: Objectif alimenter 100% du village
            this.checkVillageComplete();
          }
          break;
        }
      }
      this.selectedPanel.rect.setStrokeStyle(0);
      this.selectedPanel = null;
    }
  }

  private checkVillageComplete(): void {
    const scoring = this.jeu.scoring;
    const total = this.houses.length;
    const powered = this.houses.filter(h => h.powered).length;
    const pct = Math.floor((powered / total) * 100);
    this.energyText.setText(`Village : ${pct}%`);

    // Règle: Alimenter 100% du village
    if (powered === total) {
      GameState.addScore(scoring.village_100 || 500);
      GameState.addSolidarite(20);
      this.showBonusText('Village 100% alimenté !');
    }
  }

  private spawnCloud(): void {
    const { width } = this.scale;
    const y = Phaser.Math.Between(
      this.gridOffsetY,
      this.gridOffsetY + this.gridRows * this.cellSize
    );

    const cloud = this.add.container(-100, y);
    const rect = this.add.rectangle(0, 0, 120, 50, 0x888888, 0.6).setDepth(20);
    const label = this.add.text(0, 0, '☁️', { fontSize: '30px' }).setOrigin(0.5).setDepth(20);
    cloud.add([rect, label]);
    this.clouds.push(cloud);

    // Règle: Les nuages passent et réduisent temporairement la production
    this.tweens.add({
      targets: cloud, x: width + 150, duration: 6000,
      onUpdate: () => {
        for (const panel of this.panels) {
          const dist = Math.abs(panel.x - cloud.x) + Math.abs(panel.y - cloud.y);
          panel.clouded = dist < 100;
        }
      },
      onComplete: () => {
        const idx = this.clouds.indexOf(cloud);
        if (idx >= 0) this.clouds.splice(idx, 1);
        cloud.destroy();
        this.panels.forEach(p => p.clouded = false);
      },
    });
  }

  private updateProduction(): void {
    // Score from connected non-clouded panels
    for (const cable of this.cables) {
      if (!cable.panel.clouded) {
        GameState.addScore(1);
      }
    }
  }

  private showBonusText(msg: string): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, msg, {
      fontSize: '28px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: height / 2 - 80, alpha: 0, duration: 2000,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.cloudTimer) this.cloudTimer.destroy();
    if (this.productionTimer) this.productionTimer.destroy();
  }
}

registerScene('lenergie-solaire', LEnergieSolaireScene);
