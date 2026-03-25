/**
 * LeCompostMagiqueScene — Cooking/sorting: sort organic waste into compost.
 * Drag les bons déchets dans le composteur, rejeter les mauvais.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface WasteItem {
  emoji: string;
  name: string;
  organic: boolean;
}

const WASTE_ITEMS: WasteItem[] = [
  { emoji: '🥕', name: 'Épluchures', organic: true },
  { emoji: '☕', name: 'Marc café', organic: true },
  { emoji: '🍂', name: 'Feuilles', organic: true },
  { emoji: '🍌', name: 'Peau banane', organic: true },
  { emoji: '🥚', name: 'Coquille', organic: true },
  { emoji: '🍞', name: 'Pain rassis', organic: true },
  { emoji: '🧴', name: 'Plastique', organic: false },
  { emoji: '🥫', name: 'Métal', organic: false },
  { emoji: '🍾', name: 'Verre', organic: false },
  { emoji: '🔋', name: 'Pile', organic: false },
  { emoji: '📱', name: 'Électronique', organic: false },
];

export class LeCompostMagiqueScene extends BaseGameScene {
  private beltItems: { container: Phaser.GameObjects.Container; item: WasteItem; speed: number }[] = [];
  private compostZone!: Phaser.GameObjects.Rectangle;
  private rejectZone!: Phaser.GameObjects.Rectangle;
  private spawnTimer: Phaser.Time.TimerEvent | null = null;
  private compostFill: number = 0;
  private compostMaxFill: number = 20;
  private compostPhase: number = 0; // 0=filling, 1=temperature, 2=humidity, 3=decomposition
  private phaseProgress: number = 0;
  private compostBar!: Phaser.GameObjects.Rectangle;
  private compostBarBg!: Phaser.GameObjects.Rectangle;
  private phaseText!: Phaser.GameObjects.Text;
  private stirCircle!: Phaser.GameObjects.Arc;
  private stirAngle: number = 0;
  private lastStirAngle: number = 0;
  private stirProgress: number = 0;
  private needsStirring: boolean = false;
  private stirTimer: Phaser.Time.TimerEvent | null = null;
  private compostReady: boolean = false;
  private beltSpeed: number = 1.5;
  private distributed: number = 0;

  constructor() {
    super('GameScene_le-compost-magique');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: Des déchets organiques défilent sur un tapis roulant
    // Belt area (top portion)
    this.add.rectangle(width / 2, 80, width - 20, 100, 0x555555, 0.5).setStrokeStyle(2, 0x777777);
    this.add.text(width / 2, 30, 'Tapis roulant', {
      fontSize: '14px', color: '#aaa', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Drag les bons déchets dans le composteur
    this.compostZone = this.add.rectangle(width * 0.3, height * 0.55, 140, 140, 0x664400, 0.6)
      .setStrokeStyle(3, 0x886622).setDepth(2);
    this.add.text(width * 0.3, height * 0.55 - 50, '🪱 Composteur', {
      fontSize: '16px', color: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    // Règle: Rejeter les mauvais (plastique, métal, verre)
    this.rejectZone = this.add.rectangle(width * 0.7, height * 0.55, 140, 140, 0x444466, 0.6)
      .setStrokeStyle(3, 0x666688).setDepth(2);
    this.add.text(width * 0.7, height * 0.55 - 50, '🗑️ Rejet', {
      fontSize: '16px', color: '#ff8888', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(3);

    // Compost progress bar
    this.compostBarBg = this.add.rectangle(width / 2, height * 0.78, 250, 20, 0x333333).setDepth(5);
    this.compostBar = this.add.rectangle(width / 2 - 125, height * 0.78, 0, 20, 0x44aa00)
      .setOrigin(0, 0.5).setDepth(6);
    this.phaseText = this.add.text(width / 2, height * 0.78 + 20, 'Phase : Remplissage', {
      fontSize: '14px', color: '#aaa', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(5);

    // Règle: Remuer le compost régulièrement (geste circulaire)
    this.stirCircle = this.add.circle(width / 2, height * 0.9, 40, 0x886622, 0.3)
      .setStrokeStyle(2, 0xaa8833).setDepth(5).setVisible(false);
    const stirLabel = this.add.text(width / 2, height * 0.9, '↻ Remuer', {
      fontSize: '14px', color: '#ffcc00', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(6).setVisible(false);

    // Spawn waste on belt
    this.spawnTimer = this.time.addEvent({
      delay: 1200,
      loop: true,
      callback: () => this.spawnWaste(),
    });

    // Belt movement
    this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.updateBelt(),
    });

    // Stirring mechanic
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.isDown || !this.needsStirring || GameState.isGameOver) return;

      const cx = width / 2;
      const cy = height * 0.9;
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, cx, cy);
      if (dist > 80) return;

      const angle = Phaser.Math.Angle.Between(cx, cy, pointer.x, pointer.y);
      const angleDeg = Phaser.Math.RadToDeg(angle);
      const diff = Math.abs(angleDeg - this.lastStirAngle);
      if (diff > 5 && diff < 180) {
        this.stirProgress += diff * 0.2;
        // Règle: Remuer le compost régulièrement (geste circulaire)
        if (this.stirProgress >= 100) {
          GameState.addScore(scoring.remuage || 5);
          this.stirProgress = 0;
          this.needsStirring = false;
          this.stirCircle.setVisible(false);
          stirLabel.setVisible(false);
          this.advanceCompostPhase();
        }
      }
      this.lastStirAngle = angleDeg;
    });

    // Stirring needed periodically
    this.stirTimer = this.time.addEvent({
      delay: 8000,
      loop: true,
      callback: () => {
        if (this.compostFill >= this.compostMaxFill && !this.compostReady) {
          this.needsStirring = true;
          this.stirCircle.setVisible(true);
          stirLabel.setVisible(true);
        }
      },
    });
  }

  private spawnWaste(): void {
    if (GameState.isGameOver) return;
    const { width } = this.scale;

    const item = WASTE_ITEMS[Phaser.Math.Between(0, WASTE_ITEMS.length - 1)];

    const rect = this.add.rectangle(0, 0, 55, 55, item.organic ? 0x558833 : 0x884433)
      .setStrokeStyle(1, 0xaaaaaa);
    const emoji = this.add.text(0, -8, item.emoji, { fontSize: '26px' }).setOrigin(0.5);
    const name = this.add.text(0, 18, item.name, {
      fontSize: '10px', color: '#fff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    const container = this.add.container(-40, 80, [rect, emoji, name]).setDepth(8);

    // Make draggable
    rect.setInteractive({ draggable: true });
    this.input.setDraggable(rect);

    let dragging = false;
    rect.on('dragstart', () => {
      dragging = true;
      container.setDepth(20);
    });
    rect.on('drag', (_p: any, dragX: number, dragY: number) => {
      // Move entire container
      container.setPosition(dragX, dragY);
    });
    rect.on('dragend', () => {
      dragging = true;
      this.handleDrop(container, item);
    });

    this.beltItems.push({ container, item, speed: this.beltSpeed });
  }

  private updateBelt(): void {
    if (GameState.isGameOver) return;
    const { width } = this.scale;

    for (let i = this.beltItems.length - 1; i >= 0; i--) {
      const belt = this.beltItems[i];
      if (belt.container.x < width + 60) {
        belt.container.x += belt.speed;
      } else {
        // Off screen - waste missed
        belt.container.destroy();
        this.beltItems.splice(i, 1);
      }
    }
  }

  private handleDrop(container: Phaser.GameObjects.Container, item: WasteItem): void {
    const scoring = this.jeu.scoring;
    const cx = container.x;
    const cy = container.y;

    const compostDist = Phaser.Math.Distance.Between(cx, cy, this.compostZone.x, this.compostZone.y);
    const rejectDist = Phaser.Math.Distance.Between(cx, cy, this.rejectZone.x, this.rejectZone.y);

    if (compostDist < 90) {
      if (item.organic) {
        // Règle: Bon déchet dans le composteur
        GameState.addScore(scoring.bon_dechet || 10);
        this.compostFill++;
        this.updateCompostBar();
      } else {
        // Règle: Mauvais déchet dans le composteur = malus
        GameState.addScore(scoring.mauvais_dechet || -15);
        GameState.loseLife();
      }
      this.removeFromBelt(container);
    } else if (rejectDist < 90) {
      if (!item.organic) {
        // Correctly rejected
        GameState.addScore(scoring.bon_dechet || 10);
      } else {
        // Wrongly rejected organic waste
        GameState.addScore(scoring.mauvais_dechet || -15);
      }
      this.removeFromBelt(container);
    }
    // If dropped elsewhere, do nothing (stays on belt area)
  }

  private removeFromBelt(container: Phaser.GameObjects.Container): void {
    const idx = this.beltItems.findIndex(b => b.container === container);
    if (idx >= 0) {
      this.beltItems.splice(idx, 1);
    }
    container.destroy();
  }

  private updateCompostBar(): void {
    const { width } = this.scale;
    const pct = Math.min(1, this.compostFill / this.compostMaxFill);
    this.compostBar.setSize(250 * pct, 20);

    if (this.compostFill >= this.compostMaxFill && this.compostPhase === 0) {
      // Règle: Le compost mûrit en 3 phases (température, humidité, décomposition)
      this.compostPhase = 1;
      this.phaseText.setText('Phase : Température — Remuez !');
      this.needsStirring = true;
      this.stirCircle.setVisible(true);
    }
  }

  private advanceCompostPhase(): void {
    const scoring = this.jeu.scoring;
    const { width } = this.scale;
    const phaseNames = ['', 'Température', 'Humidité', 'Décomposition'];

    this.compostPhase++;
    if (this.compostPhase <= 3) {
      this.phaseText.setText(`Phase : ${phaseNames[this.compostPhase]} — Remuez !`);
      this.compostBar.setFillStyle(
        this.compostPhase === 1 ? 0xff6600 :
        this.compostPhase === 2 ? 0x0066ff :
        0x663300
      );
      // Need stirring again after delay
      this.time.delayedCall(3000, () => {
        if (this.compostPhase <= 3) {
          this.needsStirring = true;
          this.stirCircle.setVisible(true);
        }
      });
    } else {
      // Règle: Compost prêt = récolte et distribution aux jardiniers (+solidarité)
      this.compostReady = true;
      GameState.addScore(scoring.compost_pret || 50);
      this.phaseText.setText('Compost prêt ! Tapez pour distribuer !');
      this.compostBar.setFillStyle(0x00ff00);
      this.showDistributeButton();
    }
  }

  private showDistributeButton(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    const btn = this.add.rectangle(width / 2, height * 0.9, 180, 50, 0x228822)
      .setStrokeStyle(2, 0x44cc44).setInteractive().setDepth(15);
    const btnLabel = this.add.text(width / 2, height * 0.9, '🌱 Distribuer', {
      fontSize: '20px', color: '#fff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(16);

    btn.on('pointerdown', () => {
      // Règle: Distribution aux jardiniers
      GameState.addScore(scoring.distribution || 30);
      GameState.addSolidarite(10);
      this.distributed++;

      btn.destroy();
      btnLabel.destroy();

      this.showFloatingText('Distribué aux jardiniers !');

      // Reset for new batch
      this.compostFill = 0;
      this.compostPhase = 0;
      this.compostReady = false;
      this.compostBar.setSize(0, 20);
      this.compostBar.setFillStyle(0x44aa00);
      this.phaseText.setText('Phase : Remplissage');
      this.beltSpeed += 0.3; // Increase difficulty
    });
  }

  private showFloatingText(msg: string): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, msg, {
      fontSize: '26px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: height / 2 - 60, alpha: 0, duration: 1500,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.spawnTimer) this.spawnTimer.destroy();
    if (this.stirTimer) this.stirTimer.destroy();
  }
}

registerScene('le-compost-magique', LeCompostMagiqueScene);
