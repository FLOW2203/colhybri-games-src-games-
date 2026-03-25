/**
 * LeFrigoPartageScene — Time management: shared fridge with expiring food.
 * Distribuer les aliments avant qu'ils ne périment.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface FoodItem {
  name: string;
  emoji: string;
  slot: number;
  depositTime: number;
  expiresIn: number; // seconds until expiry
  container: Phaser.GameObjects.Container;
  timerBar: Phaser.GameObjects.Rectangle;
  expired: boolean;
  distributed: boolean;
}

interface Visitor {
  container: Phaser.GameObjects.Container;
  x: number;
  emoji: string;
  active: boolean;
}

const FOOD_TYPES = [
  { name: 'Pommes', emoji: '🍎', expiresIn: 25 },
  { name: 'Pain', emoji: '🍞', expiresIn: 15 },
  { name: 'Fromage', emoji: '🧀', expiresIn: 20 },
  { name: 'Yaourt', emoji: '🥛', expiresIn: 12 },
  { name: 'Soupe', emoji: '🍲', expiresIn: 18 },
  { name: 'Salade', emoji: '🥗', expiresIn: 10 },
  { name: 'Gâteau', emoji: '🍰', expiresIn: 14 },
  { name: 'Jus', emoji: '🧃', expiresIn: 22 },
];

export class LeFrigoPartageScene extends BaseGameScene {
  private fridgeSlots: (FoodItem | null)[] = [];
  private slotContainers: Phaser.GameObjects.Rectangle[] = [];
  private foods: FoodItem[] = [];
  private visitors: Visitor[] = [];
  private selectedSlot: number = -1;
  private maxSlots: number = 12;
  private depositQueue: { name: string; emoji: string; expiresIn: number }[] = [];
  private depositTimer: Phaser.Time.TimerEvent | null = null;
  private visitorTimer: Phaser.Time.TimerEvent | null = null;
  private updateTimer: Phaser.Time.TimerEvent | null = null;
  private notifText!: Phaser.GameObjects.Text;
  private slotStartX: number = 0;
  private slotStartY: number = 0;
  private slotW: number = 0;
  private slotH: number = 0;

  constructor() {
    super('GameScene_le-frigo-partage');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: Le frigo a 12 emplacements
    const cols = 4;
    const rows = 3;
    this.slotW = Math.min(80, (width - 60) / cols);
    this.slotH = Math.min(80, (height - 250) / rows);
    this.slotStartX = (width - cols * (this.slotW + 8)) / 2 + this.slotW / 2;
    this.slotStartY = 100;

    // Fridge background
    this.add.rectangle(width / 2, this.slotStartY + rows * (this.slotH + 8) / 2 - 20,
      cols * (this.slotW + 8) + 30, rows * (this.slotH + 8) + 30,
      0xddeeff, 0.3
    ).setStrokeStyle(3, 0x88aacc);
    this.add.text(width / 2, 65, '🧊 Frigo Partagé', {
      fontSize: '22px', color: '#88ccff', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5);

    // Init slots
    for (let i = 0; i < this.maxSlots; i++) {
      this.fridgeSlots[i] = null;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = this.slotStartX + col * (this.slotW + 8);
      const y = this.slotStartY + row * (this.slotH + 8);
      const slot = this.add.rectangle(x, y, this.slotW, this.slotH, 0x335566, 0.5)
        .setStrokeStyle(1, 0x556677);
      this.slotContainers.push(slot);
    }

    // Notification area
    this.notifText = this.add.text(width / 2, this.slotStartY + 3 * (this.slotH + 8) + 20, '', {
      fontSize: '16px', color: '#ffcc00', fontFamily: 'Arial', fontStyle: 'italic',
      stroke: '#000', strokeThickness: 1,
    }).setOrigin(0.5).setDepth(10);

    // Visitor area (bottom)
    const visitorY = height - 70;
    this.add.rectangle(width / 2, visitorY, width - 20, 80, 0x333333, 0.3);
    this.add.text(width / 2, visitorY - 30, 'Voisins qui passent :', {
      fontSize: '14px', color: '#aaa', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Les voisins déposent des aliments (tap pour accepter)
    this.depositTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => this.offerDeposit(),
    });

    // Règle: Distribuer les aliments aux personnes qui passent
    this.visitorTimer = this.time.addEvent({
      delay: 5000,
      loop: true,
      callback: () => this.spawnVisitor(),
    });

    // Timer update loop for expiry
    this.updateTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.updateExpiry(),
    });

    // Tap on fridge slot to select, tap on visitor to distribute
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (GameState.isGameOver) return;
      this.handleTap(pointer.x, pointer.y);
    });

    // Initial deposits
    this.offerDeposit();
  }

  private offerDeposit(): void {
    if (GameState.isGameOver) return;
    // Find empty slot
    const emptySlot = this.fridgeSlots.findIndex(s => s === null);
    if (emptySlot < 0) return; // Fridge full

    const foodType = FOOD_TYPES[Phaser.Math.Between(0, FOOD_TYPES.length - 1)];
    this.notifText.setText(`Un voisin dépose : ${foodType.emoji} ${foodType.name} — Tapez un emplacement vide !`);

    // Store pending deposit
    this.depositQueue.push(foodType);

    // Auto-clear notification
    this.time.delayedCall(4000, () => {
      if (this.depositQueue.length > 0) {
        // Auto-place in first empty slot if not manually placed
        const slot = this.fridgeSlots.findIndex(s => s === null);
        if (slot >= 0 && this.depositQueue.length > 0) {
          this.placeFood(slot, this.depositQueue.shift()!);
        }
      }
    });
  }

  private placeFood(slotIdx: number, foodType: { name: string; emoji: string; expiresIn: number }): void {
    if (this.fridgeSlots[slotIdx] !== null) return;

    const cols = 4;
    const col = slotIdx % cols;
    const row = Math.floor(slotIdx / cols);
    const x = this.slotStartX + col * (this.slotW + 8);
    const y = this.slotStartY + row * (this.slotH + 8);

    const rect = this.add.rectangle(0, 0, this.slotW - 6, this.slotH - 6, 0x226633);
    const emoji = this.add.text(0, -10, foodType.emoji, { fontSize: '24px' }).setOrigin(0.5);
    const nameText = this.add.text(0, 12, foodType.name, {
      fontSize: '10px', color: '#fff', fontFamily: 'Arial',
    }).setOrigin(0.5);
    // Règle: Chaque aliment a une date de péremption (timer visible)
    const timerBar = this.add.rectangle(0, this.slotH / 2 - 6, this.slotW - 10, 5, 0x00ff00);

    const container = this.add.container(x, y, [rect, emoji, nameText, timerBar]).setDepth(5);

    const food: FoodItem = {
      name: foodType.name, emoji: foodType.emoji, slot: slotIdx,
      depositTime: this.time.now, expiresIn: foodType.expiresIn,
      container, timerBar, expired: false, distributed: false,
    };
    this.fridgeSlots[slotIdx] = food;
    this.foods.push(food);

    this.notifText.setText('');
  }

  private spawnVisitor(): void {
    if (GameState.isGameOver) return;
    const { width, height } = this.scale;
    const visitorY = height - 60;

    const emojis = ['🧑', '👩', '👴', '👧', '🧓', '👨'];
    const emoji = emojis[Phaser.Math.Between(0, emojis.length - 1)];

    const x = -40;
    const rect = this.add.rectangle(0, 0, 40, 40, 0x664488, 0.6);
    const label = this.add.text(0, 0, emoji, { fontSize: '28px' }).setOrigin(0.5);
    const bubble = this.add.text(0, -30, '🍽️?', {
      fontSize: '16px', color: '#ffcc00',
    }).setOrigin(0.5);
    const container = this.add.container(x, visitorY, [rect, label, bubble]).setDepth(8);

    const visitor: Visitor = { container, x, emoji, active: true };
    this.visitors.push(visitor);

    // Visitor walks across screen
    this.tweens.add({
      targets: container, x: width + 40, duration: 8000,
      onUpdate: () => { visitor.x = container.x; },
      onComplete: () => {
        visitor.active = false;
        container.destroy();
        const idx = this.visitors.indexOf(visitor);
        if (idx >= 0) this.visitors.splice(idx, 1);
      },
    });
  }

  private handleTap(px: number, py: number): void {
    const scoring = this.jeu.scoring;
    const cols = 4;

    // Check if tapping a fridge slot
    for (let i = 0; i < this.maxSlots; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = this.slotStartX + col * (this.slotW + 8);
      const y = this.slotStartY + row * (this.slotH + 8);

      if (Math.abs(px - x) < this.slotW / 2 && Math.abs(py - y) < this.slotH / 2) {
        if (this.fridgeSlots[i] === null && this.depositQueue.length > 0) {
          // Règle: Les voisins déposent des aliments (tap pour accepter)
          this.placeFood(i, this.depositQueue.shift()!);
          return;
        }
        if (this.fridgeSlots[i] !== null && !this.fridgeSlots[i]!.expired) {
          // Select food for distribution
          this.selectedSlot = i;
          this.slotContainers[i].setStrokeStyle(3, 0xffff00);
          this.notifText.setText(`${this.fridgeSlots[i]!.emoji} sélectionné — Tapez un voisin !`);
          return;
        }
      }
    }

    // Check if tapping a visitor
    if (this.selectedSlot >= 0) {
      for (const visitor of this.visitors) {
        if (!visitor.active) continue;
        if (Math.abs(px - visitor.x) < 40 && Math.abs(py - visitor.container.y) < 40) {
          const food = this.fridgeSlots[this.selectedSlot]!;

          // Règle: Distribuer les aliments aux personnes qui passent (+solidarité)
          GameState.addScore(scoring.aliment_distribue || 15);
          GameState.addSolidarite(3);
          food.distributed = true;

          // Règle: Distribuer un aliment le jour même de son dépôt (+scoring.distribution_rapide pts)
          const elapsed = (this.time.now - food.depositTime) / 1000;
          if (elapsed < 5) {
            GameState.addScore(scoring.distribution_rapide || 20);
            this.showFloatingText(visitor.x, visitor.container.y - 50, 'Rapide !');
          }

          // Remove from fridge
          food.container.destroy();
          this.fridgeSlots[this.selectedSlot] = null;
          this.slotContainers[this.selectedSlot].setStrokeStyle(1, 0x556677);

          // Visitor happy
          const happyText = this.add.text(visitor.x, visitor.container.y - 30, '😊 Merci !', {
            fontSize: '16px', color: '#44ff44', fontFamily: 'Arial',
          }).setOrigin(0.5).setDepth(20);
          this.tweens.add({
            targets: happyText, y: visitor.container.y - 70, alpha: 0, duration: 1000,
            onComplete: () => happyText.destroy(),
          });

          this.selectedSlot = -1;
          this.notifText.setText('');

          // Règle: Frigo vide = bonus
          this.checkFrigoVide();
          return;
        }
      }
    }
  }

  private updateExpiry(): void {
    if (GameState.isGameOver) return;
    const scoring = this.jeu.scoring;
    const now = this.time.now;

    for (let i = 0; i < this.maxSlots; i++) {
      const food = this.fridgeSlots[i];
      if (!food || food.expired || food.distributed) continue;

      const elapsed = (now - food.depositTime) / 1000;
      const remaining = food.expiresIn - elapsed;
      const pct = Math.max(0, remaining / food.expiresIn);

      // Update timer bar
      food.timerBar.setScale(pct, 1);
      if (pct < 0.3) food.timerBar.setFillStyle(0xff4400);
      else if (pct < 0.6) food.timerBar.setFillStyle(0xffaa00);

      // Règle: Aliment périmé = gaspillage (-scoring.perime pts, -5 solidarité)
      if (remaining <= 0) {
        food.expired = true;
        GameState.addScore(scoring.perime || -15);
        GameState.addSolidarite(-5);

        // Visual: turn gray
        food.container.setAlpha(0.4);
        this.time.delayedCall(1500, () => {
          food.container.destroy();
          this.fridgeSlots[i] = null;
        });
      }
    }
  }

  private checkFrigoVide(): void {
    const scoring = this.jeu.scoring;
    // Règle: Frigo vide = bonus
    const hasFood = this.fridgeSlots.some(s => s !== null && !s.expired && !s.distributed);
    if (!hasFood) {
      GameState.addScore(scoring.frigo_vide_bonus || 40);
      GameState.addSolidarite(5);
      this.showFloatingText(this.scale.width / 2, this.scale.height / 2, 'Frigo vidé !');
    }
  }

  private showFloatingText(x: number, y: number, msg: string): void {
    const text = this.add.text(x, y, msg, {
      fontSize: '24px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: y - 50, alpha: 0, duration: 1200,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.depositTimer) this.depositTimer.destroy();
    if (this.visitorTimer) this.visitorTimer.destroy();
    if (this.updateTimer) this.updateTimer.destroy();
  }
}

registerScene('le-frigo-partage', LeFrigoPartageScene);
