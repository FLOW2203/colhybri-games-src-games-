/**
 * LeCafeSuspenduScene — Management: gérer un café avec solidarité.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface CafeClient {
  sprite: Phaser.GameObjects.Container;
  type: 'normal' | 'suspended_payer' | 'in_need';
  order: string;
  timer: Phaser.Time.TimerEvent;
  x: number;
  y: number;
}

export class LeCafeSuspenduScene extends BaseGameScene {
  private clients: CafeClient[] = [];
  private coffeeStock: number = 20;
  private cashRegister: number = 50;
  private suspendedCoffees: number = 0;
  private solidariteLocal: number = 0;
  private stockText!: Phaser.GameObjects.Text;
  private cashText!: Phaser.GameObjects.Text;
  private suspendedText!: Phaser.GameObjects.Text;
  private solidariteText!: Phaser.GameObjects.Text;
  private clientTimer: Phaser.Time.TimerEvent | null = null;
  private restockTimer: Phaser.Time.TimerEvent | null = null;
  private slotPositions: { x: number; y: number; occupied: boolean }[] = [];

  constructor() {
    super('GameScene_le-cafe-suspendu');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Café counter visual
    this.add.rectangle(width / 2, height * 0.45, width * 0.9, 8, 0x8B4513).setDepth(1);
    this.add.text(width / 2, height * 0.42, '☕ CAFÉ SUSPENDU ☕', {
      fontSize: '24px', color: '#ffcc44', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(1);

    // Client slots (where clients appear)
    const slotCount = 4;
    for (let i = 0; i < slotCount; i++) {
      const x = width * (0.15 + i * 0.23);
      const y = height * 0.55;
      this.slotPositions.push({ x, y, occupied: false });
    }

    // UI panel
    const panelY = height * 0.15;
    this.stockText = this.add.text(width * 0.25, panelY, `Stock: ${this.coffeeStock} ☕`, {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.cashText = this.add.text(width * 0.75, panelY, `Caisse: ${this.cashRegister}€`, {
      fontSize: '20px', color: '#44ff44', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.suspendedText = this.add.text(width * 0.25, panelY + 35, `Suspendus: ${this.suspendedCoffees}`, {
      fontSize: '18px', color: '#ffaa44', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Niveau réussi si solidarité >= 50 ET caisse > 0
    this.solidariteText = this.add.text(width * 0.75, panelY + 35, `Solidarité: ${this.solidariteLocal}/50`, {
      fontSize: '18px', color: '#ff88cc', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Restock button
    const restockBtn = this.add.rectangle(width / 2, height * 0.28, 180, 45, 0x664422)
      .setStrokeStyle(2, 0x886633).setInteractive();
    this.add.text(width / 2, height * 0.28, 'Acheter stock (10€ = 5☕)', {
      fontSize: '14px', color: '#ffcc88', fontFamily: 'Arial',
    }).setOrigin(0.5);

    restockBtn.on('pointerdown', () => {
      if (this.cashRegister >= 10) {
        this.cashRegister -= 10;
        this.coffeeStock += 5;
        this.updateUI();
      }
    });

    // Règle: Les clients arrivent avec des commandes (tap pour servir)
    this.clientTimer = this.time.addEvent({
      delay: 3000,
      loop: true,
      callback: () => this.spawnClient(),
    });
  }

  private spawnClient(): void {
    if (GameState.isGameOver) return;

    // Find empty slot
    const emptySlot = this.slotPositions.find(s => !s.occupied);
    if (!emptySlot) return;
    emptySlot.occupied = true;

    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Determine client type
    const roll = Phaser.Math.Between(1, 10);
    let type: CafeClient['type'];
    if (roll <= 5) {
      type = 'normal';
    } else if (roll <= 8) {
      // Règle: Certains clients proposent de payer un café suspendu (+solidarité)
      type = 'suspended_payer';
    } else {
      // Règle: Des personnes en difficulté arrivent : offrir un café suspendu
      type = 'in_need';
    }

    const colors: { [key: string]: number } = {
      normal: 0x446688,
      suspended_payer: 0x448844,
      in_need: 0x884444,
    };

    const emojis: { [key: string]: string } = {
      normal: '🧑',
      suspended_payer: '😊',
      in_need: '😢',
    };

    const labels: { [key: string]: string } = {
      normal: 'Un café SVP',
      suspended_payer: 'Je paie un\nsuspendu aussi!',
      in_need: 'Un café\nsuspendu?',
    };

    const bg = this.add.rectangle(0, 0, 100, 90, colors[type], 0.8)
      .setStrokeStyle(2, 0xffffff).setInteractive();
    const emoji = this.add.text(0, -20, emojis[type], { fontSize: '30px' }).setOrigin(0.5);
    const text = this.add.text(0, 20, labels[type], {
      fontSize: '11px', color: '#ffffff', fontFamily: 'Arial', align: 'center',
    }).setOrigin(0.5);

    const container = this.add.container(emptySlot.x, emptySlot.y, [bg, emoji, text]);

    // Client leaves after 6s
    const timer = this.time.delayedCall(6000, () => {
      const idx = this.clients.findIndex(c => c.sprite === container);
      if (idx !== -1) {
        // Règle: Client perdu
        GameState.addScore(scoring.client_perdu || -10);
        container.destroy();
        emptySlot.occupied = false;
        this.clients.splice(idx, 1);
      }
    });

    const client: CafeClient = {
      sprite: container, type, order: 'cafe',
      timer, x: emptySlot.x, y: emptySlot.y,
    };
    this.clients.push(client);

    // Règle: Les clients arrivent avec des commandes (tap pour servir)
    bg.on('pointerdown', () => {
      this.serveClient(client, emptySlot);
    });
  }

  private serveClient(client: CafeClient, slot: { x: number; y: number; occupied: boolean }): void {
    const scoring = this.jeu.scoring;

    if (client.type === 'normal') {
      // Règle: Servir un café normal
      if (this.coffeeStock <= 0) return;
      this.coffeeStock--;
      this.cashRegister += 5;
      GameState.addScore(scoring.cafe_servi || 5);
    } else if (client.type === 'suspended_payer') {
      // Règle: Certains clients proposent de payer un café suspendu (+solidarité)
      if (this.coffeeStock <= 0) return;
      this.coffeeStock--;
      this.cashRegister += 5; // pays for theirs
      this.suspendedCoffees++;
      this.cashRegister += 5; // pays for suspended
      GameState.addScore(scoring.cafe_suspendu_paye || 15);
      GameState.addSolidarite(5);
      this.solidariteLocal += 5;
    } else if (client.type === 'in_need') {
      // Règle: Des personnes en difficulté arrivent : offrir un café suspendu (-stock, +solidarité)
      if (this.suspendedCoffees > 0) {
        this.suspendedCoffees--;
        // Règle: Chaque café suspendu offert = +10 solidarité
        GameState.addScore(scoring.cafe_suspendu_offert || 10);
        GameState.addSolidarite(10);
        this.solidariteLocal += 10;
      } else if (this.coffeeStock > 0) {
        // Use regular stock as fallback (less solidarité)
        this.coffeeStock--;
        GameState.addScore(scoring.cafe_suspendu_offert || 10);
        GameState.addSolidarite(5);
        this.solidariteLocal += 5;
      } else {
        // Can't serve
        GameState.addScore(scoring.client_perdu || -10);
      }
    }

    client.timer.destroy();
    client.sprite.destroy();
    slot.occupied = false;
    const idx = this.clients.indexOf(client);
    if (idx !== -1) this.clients.splice(idx, 1);

    this.updateUI();
    this.checkWinCondition();
  }

  private updateUI(): void {
    this.stockText.setText(`Stock: ${this.coffeeStock} ☕`);
    this.cashText.setText(`Caisse: ${this.cashRegister}€`);
    this.suspendedText.setText(`Suspendus: ${this.suspendedCoffees}`);
    this.solidariteText.setText(`Solidarité: ${this.solidariteLocal}/50`);
  }

  // Règle: Niveau réussi si solidarité >= 50 ET caisse > 0
  private checkWinCondition(): void {
    if (this.solidariteLocal >= 50 && this.cashRegister > 0) {
      this.time.delayedCall(500, () => {
        GameState.triggerGameOver();
      });
    }

    // Lose if no stock and no money to restock and no suspended coffees
    if (this.coffeeStock <= 0 && this.cashRegister < 10 && this.suspendedCoffees <= 0) {
      this.time.delayedCall(1000, () => {
        GameState.triggerGameOver();
      });
    }
  }

  shutdown(): void {
    super.shutdown();
    if (this.clientTimer) this.clientTimer.destroy();
    for (const c of this.clients) {
      c.timer.destroy();
    }
  }
}

registerScene('le-cafe-suspendu', LeCafeSuspenduScene);
