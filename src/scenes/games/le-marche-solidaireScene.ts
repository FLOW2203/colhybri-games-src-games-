/**
 * LeMarcheSolidaireScene — Tycoon: gérer un marché solidaire sur 5 jours.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Product {
  name: string;
  emoji: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  sold: number;
}

interface Customer {
  sprite: Phaser.GameObjects.Container;
  maxPrice: number;
  wantedProduct: number;
  timer: Phaser.Time.TimerEvent;
}

export class LeMarcheSolidaireScene extends BaseGameScene {
  private products: Product[] = [];
  private cash: number = 100;
  private day: number = 1;
  private dayTimer: Phaser.Time.TimerEvent | null = null;
  private customerTimer: Phaser.Time.TimerEvent | null = null;
  private customers: Customer[] = [];
  private dayText!: Phaser.GameObjects.Text;
  private cashText!: Phaser.GameObjects.Text;
  private productButtons: Phaser.GameObjects.Container[] = [];
  private isDayEnd: boolean = false;
  private unsoldProducts: Product[] = [];

  constructor() {
    super('GameScene_le-marche-solidaire');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Initialize products
    this.products = [
      { name: 'Pommes', emoji: '🍎', costPrice: 5, sellPrice: 8, stock: 0, sold: 0 },
      { name: 'Pain', emoji: '🍞', costPrice: 3, sellPrice: 5, stock: 0, sold: 0 },
      { name: 'Fromage', emoji: '🧀', costPrice: 8, sellPrice: 12, stock: 0, sold: 0 },
      { name: 'Légumes', emoji: '🥕', costPrice: 4, sellPrice: 7, stock: 0, sold: 0 },
    ];

    // UI
    this.dayText = this.add.text(width / 2, 50, `Jour ${this.day}/5`, {
      fontSize: '30px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.cashText = this.add.text(width / 2, 90, `Caisse: ${this.cash}€`, {
      fontSize: '24px', color: '#44ff44', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Acheter des produits au grossiste (tap pour acheter)
    this.add.text(width / 2, 140, 'Acheter au grossiste:', {
      fontSize: '20px', color: '#cccccc', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.createProductUI(width, height);
    this.startDay();
  }

  private createProductUI(width: number, height: number): void {
    this.productButtons.forEach(b => b.destroy());
    this.productButtons = [];

    const startY = 180;
    const btnHeight = 70;

    for (let i = 0; i < this.products.length; i++) {
      const p = this.products[i];
      const y = startY + i * (btnHeight + 10);

      // Buy button
      const buyBtn = this.add.rectangle(-width * 0.3, 0, 90, 50, 0x336633)
        .setStrokeStyle(1, 0x44aa44).setInteractive();
      const buyLabel = this.add.text(-width * 0.3, 0, `Acheter\n${p.costPrice}€`, {
        fontSize: '14px', color: '#44ff44', fontFamily: 'Arial', align: 'center',
      }).setOrigin(0.5);

      // Product info
      const info = this.add.text(0, 0, `${p.emoji} ${p.name} | Stock: ${p.stock} | Prix: ${p.sellPrice}€`, {
        fontSize: '16px', color: '#ffffff', fontFamily: 'Arial',
      }).setOrigin(0.5);

      // Price adjust buttons
      const priceDown = this.add.rectangle(width * 0.28, -12, 35, 25, 0x663333)
        .setStrokeStyle(1, 0xaa4444).setInteractive();
      const priceDownLabel = this.add.text(width * 0.28, -12, '-', {
        fontSize: '20px', color: '#ff4444',
      }).setOrigin(0.5);
      const priceUp = this.add.rectangle(width * 0.28, 12, 35, 25, 0x336633)
        .setStrokeStyle(1, 0x44aa44).setInteractive();
      const priceUpLabel = this.add.text(width * 0.28, 12, '+', {
        fontSize: '20px', color: '#44ff44',
      }).setOrigin(0.5);

      const container = this.add.container(width / 2, y, [
        buyBtn, buyLabel, info, priceDown, priceDownLabel, priceUp, priceUpLabel,
      ]);
      this.productButtons.push(container);

      // Règle: Acheter des produits au grossiste (tap pour acheter)
      buyBtn.on('pointerdown', () => {
        if (this.cash >= p.costPrice) {
          this.cash -= p.costPrice;
          p.stock += 1;
          this.updateProductUI();
        }
      });

      // Règle: Fixer un prix juste pour chaque produit
      priceDown.on('pointerdown', () => {
        if (p.sellPrice > 1) {
          p.sellPrice--;
          this.updateProductUI();
        }
      });

      priceUp.on('pointerdown', () => {
        p.sellPrice++;
        this.updateProductUI();
      });
    }
  }

  private updateProductUI(): void {
    this.cashText.setText(`Caisse: ${this.cash}€`);
    this.dayText.setText(`Jour ${this.day}/5`);

    for (let i = 0; i < this.products.length; i++) {
      const p = this.products[i];
      const container = this.productButtons[i];
      if (container && container.list.length > 2) {
        const info = container.list[2] as Phaser.GameObjects.Text;
        info.setText(`${p.emoji} ${p.name} | Stock: ${p.stock} | Prix: ${p.sellPrice}€`);
      }
    }
  }

  private startDay(): void {
    this.isDayEnd = false;

    // Règle: Les clients arrivent et achètent selon le prix
    this.customerTimer = this.time.addEvent({
      delay: 2500,
      loop: true,
      callback: () => this.spawnCustomer(),
    });

    // Day lasts 25 seconds
    this.dayTimer = this.time.delayedCall(25000, () => {
      this.endDay();
    });
  }

  private spawnCustomer(): void {
    if (this.isDayEnd || GameState.isGameOver) return;
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    const wantedProduct = Phaser.Math.Between(0, this.products.length - 1);
    const maxPrice = this.products[wantedProduct].costPrice + Phaser.Math.Between(2, 8);

    const x = Phaser.Math.Between(100, width - 100);
    const y = height * 0.65;

    const bg = this.add.rectangle(0, 0, 120, 70, 0x444466, 0.8)
      .setStrokeStyle(1, 0x6666aa).setInteractive();
    const emoji = this.add.text(0, -15, '🧑', { fontSize: '28px' }).setOrigin(0.5);
    const want = this.add.text(0, 15, `Veut: ${this.products[wantedProduct].emoji} ≤${maxPrice}€`, {
      fontSize: '12px', color: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    const sprite = this.add.container(x, y, [bg, emoji, want]);

    // Customer leaves after 5s if not served
    const timer = this.time.delayedCall(5000, () => {
      const idx = this.customers.findIndex(c => c.sprite === sprite);
      if (idx !== -1) {
        // Règle: Client perdu
        GameState.addScore(scoring.client_perdu || -10);
        sprite.destroy();
        this.customers.splice(idx, 1);
      }
    });

    const customer: Customer = { sprite, maxPrice, wantedProduct, timer };
    this.customers.push(customer);

    // Règle: Les clients arrivent et achètent selon le prix
    bg.on('pointerdown', () => {
      const p = this.products[wantedProduct];
      if (p.stock > 0 && p.sellPrice <= maxPrice) {
        // Règle: Vente réussie
        p.stock--;
        p.sold++;
        this.cash += p.sellPrice;
        GameState.addScore(scoring.vente || 5);
        this.updateProductUI();
      }
      timer.destroy();
      sprite.destroy();
      const idx = this.customers.findIndex(c => c.sprite === sprite);
      if (idx !== -1) this.customers.splice(idx, 1);
    });
  }

  private endDay(): void {
    this.isDayEnd = true;
    if (this.customerTimer) this.customerTimer.destroy();

    // Remove remaining customers
    for (const c of this.customers) {
      c.timer.destroy();
      c.sprite.destroy();
    }
    this.customers = [];

    // Règle: Les invendus en fin de journée : redistribuer (+solidarité) ou jeter (-solidarité)
    const scoring = this.jeu.scoring;
    this.unsoldProducts = this.products.filter(p => p.stock > 0);

    if (this.unsoldProducts.length > 0) {
      this.showRedistributeChoice();
    } else {
      // Règle: Jour complet bonus
      GameState.addScore(scoring.jour_complete || 50);
      this.nextDay();
    }
  }

  private showRedistributeChoice(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    const overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7).setDepth(50);

    const totalUnsold = this.unsoldProducts.reduce((sum, p) => sum + p.stock, 0);
    const title = this.add.text(width / 2, height * 0.35, `Fin du jour ${this.day}\n${totalUnsold} invendus`, {
      fontSize: '26px', color: '#ffffff', fontFamily: 'Arial', align: 'center',
    }).setOrigin(0.5).setDepth(51);

    // Redistribute button
    const redistBtn = this.add.rectangle(width * 0.3, height * 0.55, 160, 60, 0x336633)
      .setStrokeStyle(2, 0x44aa44).setInteractive().setDepth(51);
    const redistLabel = this.add.text(width * 0.3, height * 0.55, 'Redistribuer\n+solidarité', {
      fontSize: '16px', color: '#44ff44', fontFamily: 'Arial', align: 'center',
    }).setOrigin(0.5).setDepth(51);

    // Throw away button
    const throwBtn = this.add.rectangle(width * 0.7, height * 0.55, 160, 60, 0x663333)
      .setStrokeStyle(2, 0xaa4444).setInteractive().setDepth(51);
    const throwLabel = this.add.text(width * 0.7, height * 0.55, 'Jeter\n-solidarité', {
      fontSize: '16px', color: '#ff4444', fontFamily: 'Arial', align: 'center',
    }).setOrigin(0.5).setDepth(51);

    const cleanup = () => {
      overlay.destroy(); title.destroy();
      redistBtn.destroy(); redistLabel.destroy();
      throwBtn.destroy(); throwLabel.destroy();
    };

    redistBtn.on('pointerdown', () => {
      // Règle: redistribuer (+solidarité)
      GameState.addSolidarite(totalUnsold * 3);
      GameState.addScore(scoring.redistribution || 20);
      for (const p of this.unsoldProducts) p.stock = 0;
      this.updateProductUI();
      cleanup();
      GameState.addScore(scoring.jour_complete || 50);
      this.nextDay();
    });

    throwBtn.on('pointerdown', () => {
      // Règle: jeter (-solidarité)
      GameState.addScore(scoring.gaspillage || -15);
      GameState.addSolidarite(-totalUnsold * 2);
      for (const p of this.unsoldProducts) p.stock = 0;
      this.updateProductUI();
      cleanup();
      GameState.addScore(scoring.jour_complete || 50);
      this.nextDay();
    });
  }

  private nextDay(): void {
    this.day++;
    // Règle: 5 jours de marché = 1 niveau
    if (this.day > 5) {
      GameState.triggerGameOver();
      return;
    }
    this.dayText.setText(`Jour ${this.day}/5`);
    // Reset sold counts
    for (const p of this.products) p.sold = 0;
    this.time.delayedCall(1000, () => this.startDay());
  }

  shutdown(): void {
    super.shutdown();
    if (this.dayTimer) this.dayTimer.destroy();
    if (this.customerTimer) this.customerTimer.destroy();
  }
}

registerScene('le-marche-solidaire', LeMarcheSolidaireScene);
