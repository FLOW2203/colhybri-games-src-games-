/**
 * LaMonnaieLocaleScene — Economic sim: local currency circulation.
 * Acheter chez les commerçants locaux et faire circuler la monnaie.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Merchant {
  name: string;
  emoji: string;
  product: string;
  price: number;
  rect: Phaser.GameObjects.Rectangle;
  container: Phaser.GameObjects.Container;
  bought: boolean;
  chainLevel: number; // how many times money circulated through
}

export class LaMonnaieLocaleScene extends BaseGameScene {
  private merchants: Merchant[] = [];
  private wallet: number = 100;
  private walletText!: Phaser.GameObjects.Text;
  private chainLength: number = 0;
  private multiplier: number = 1;
  private multiplierText!: Phaser.GameObjects.Text;
  private totalPurchases: number = 0;
  private purchaseDistribution: Map<number, number> = new Map();
  private circulationGraphics!: Phaser.GameObjects.Graphics;
  private lastBoughtIdx: number = -1;

  constructor() {
    super('GameScene_la-monnaie-locale');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    const merchantData = [
      { name: 'Boulanger', emoji: '🥖', product: 'Pain', price: 10 },
      { name: 'Maraîcher', emoji: '🥕', product: 'Légumes', price: 15 },
      { name: 'Fromager', emoji: '🧀', product: 'Fromage', price: 12 },
      { name: 'Fleuriste', emoji: '💐', product: 'Fleurs', price: 8 },
      { name: 'Libraire', emoji: '📚', product: 'Livre', price: 20 },
      { name: 'Artisan', emoji: '🏺', product: 'Poterie', price: 18 },
    ];

    // Layout merchants in a circle
    const centerX = width / 2;
    const centerY = height / 2 + 20;
    const radius = Math.min(width, height) * 0.3;

    this.circulationGraphics = this.add.graphics().setDepth(1);

    merchantData.forEach((data, i) => {
      const angle = (i / merchantData.length) * Math.PI * 2 - Math.PI / 2;
      const x = centerX + Math.cos(angle) * radius;
      const y = centerY + Math.sin(angle) * radius;

      const rect = this.add.rectangle(0, 0, 90, 80, 0x336699).setStrokeStyle(2, 0x4488bb);
      const emoji = this.add.text(0, -18, data.emoji, { fontSize: '28px' }).setOrigin(0.5);
      const nameText = this.add.text(0, 10, data.name, {
        fontSize: '11px', color: '#fff', fontFamily: 'Arial',
      }).setOrigin(0.5);
      const priceText = this.add.text(0, 28, `${data.price}💰`, {
        fontSize: '13px', color: '#ffcc00', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5);

      const container = this.add.container(x, y, [rect, emoji, nameText, priceText]).setDepth(5);

      const merchant: Merchant = {
        name: data.name, emoji: data.emoji, product: data.product,
        price: data.price, rect, container, bought: false, chainLevel: 0,
      };
      this.merchants.push(merchant);
      this.purchaseDistribution.set(i, 0);

      // Règle: Tap pour acheter
      rect.setInteractive();
      rect.on('pointerdown', () => this.buyFrom(i));
    });

    // Règle: Un portefeuille avec des billets de monnaie locale
    const walletBg = this.add.rectangle(width / 2, 40, 220, 40, 0x224422).setStrokeStyle(2, 0x44aa44).setDepth(10);
    this.walletText = this.add.text(width / 2, 40, `💰 Portefeuille : ${this.wallet}`, {
      fontSize: '18px', color: '#44ff44', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(11);

    // Multiplier display
    this.multiplierText = this.add.text(width / 2, height - 40, `Chaîne : 0 | Multiplicateur : x1`, {
      fontSize: '16px', color: '#ffcc00', fontFamily: 'Arial',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);

    // Instructions
    this.add.text(width / 2, 80, 'Achetez local ! Répartissez vos achats.', {
      fontSize: '14px', color: '#aaaaaa', fontFamily: 'Arial', fontStyle: 'italic',
    }).setOrigin(0.5).setDepth(10);
  }

  private buyFrom(idx: number): void {
    if (GameState.isGameOver) return;
    const scoring = this.jeu.scoring;
    const merchant = this.merchants[idx];
    const maxMultiplier = scoring.multiplicateur_max || 3;

    // Règle: Attention ne pas tout dépenser d'un coup, répartir les achats
    if (this.wallet < merchant.price) {
      this.showFloatingText(merchant.container.x, merchant.container.y - 50, 'Pas assez !', '#ff4444');
      return;
    }

    // Deduct from wallet
    this.wallet -= merchant.price;
    this.walletText.setText(`💰 Portefeuille : ${this.wallet}`);
    this.totalPurchases++;
    this.purchaseDistribution.set(idx, (this.purchaseDistribution.get(idx) || 0) + 1);

    // Règle: Acheter chez les commerçants locaux (+scoring.achat_local, +solidarité)
    GameState.addScore(scoring.achat_local || 10);
    GameState.addSolidarite(2);

    // Règle: La monnaie circule : ton achat génère un nouvel achat pour un autre
    if (this.lastBoughtIdx >= 0 && this.lastBoughtIdx !== idx) {
      this.chainLength++;

      // Draw circulation arrow
      const from = this.merchants[this.lastBoughtIdx];
      const to = this.merchants[idx];
      this.circulationGraphics.lineStyle(2, 0x44ff44, 0.5);
      this.circulationGraphics.beginPath();
      this.circulationGraphics.moveTo(from.container.x, from.container.y);
      this.circulationGraphics.lineTo(to.container.x, to.container.y);
      this.circulationGraphics.strokePath();

      // Règle: Chaîne de circulation longue = multiplicateur de points
      GameState.addScore(scoring.chaine_circulation || 5);
      this.multiplier = Math.min(maxMultiplier, 1 + Math.floor(this.chainLength / 3));

      // Apply multiplier bonus
      if (this.chainLength % 3 === 0 && this.multiplier > 1) {
        const bonus = (scoring.achat_local || 10) * (this.multiplier - 1);
        GameState.addScore(bonus);
        this.showFloatingText(merchant.container.x, merchant.container.y - 60, `x${this.multiplier} !`, '#ffd700');
      }

      // Simulate circulation: merchant "buys" from another
      this.simulateCirculation(idx);
    } else if (this.lastBoughtIdx === idx) {
      // Same merchant = break chain
      this.chainLength = 0;
      this.multiplier = 1;
    }

    this.lastBoughtIdx = idx;
    this.multiplierText.setText(`Chaîne : ${this.chainLength} | Multiplicateur : x${this.multiplier}`);

    // Flash merchant
    merchant.rect.setFillStyle(0x44aa44);
    this.time.delayedCall(300, () => merchant.rect.setFillStyle(0x336699));

    // Règle: Répartir les achats = equilibre bonus
    this.checkEquilibre();

    // Check if wallet empty
    if (this.wallet <= 0) {
      this.endRound();
    }
  }

  private simulateCirculation(fromIdx: number): void {
    // Visual: show money flowing between merchants
    const from = this.merchants[fromIdx];
    const otherIdx = (fromIdx + Phaser.Math.Between(1, this.merchants.length - 1)) % this.merchants.length;
    const to = this.merchants[otherIdx];

    const coin = this.add.text(from.container.x, from.container.y, '💰', { fontSize: '18px' }).setOrigin(0.5).setDepth(20);
    this.tweens.add({
      targets: coin, x: to.container.x, y: to.container.y, duration: 600,
      onComplete: () => {
        coin.destroy();
        to.chainLevel++;
      },
    });
  }

  private checkEquilibre(): void {
    const scoring = this.jeu.scoring;
    // Règle: Répartir les achats = equilibre_bonus
    if (this.totalPurchases >= this.merchants.length) {
      let allVisited = true;
      this.purchaseDistribution.forEach((count) => {
        if (count === 0) allVisited = false;
      });
      if (allVisited) {
        // Check relatively balanced (no merchant has more than double the min)
        const counts = Array.from(this.purchaseDistribution.values()).filter(c => c > 0);
        const minCount = Math.min(...counts);
        const maxCount = Math.max(...counts);
        if (maxCount <= minCount * 2) {
          GameState.addScore(scoring.equilibre_bonus || 40);
          GameState.addSolidarite(5);
          this.showFloatingText(this.scale.width / 2, this.scale.height / 2, 'Équilibre !', '#44ff44');
          // Reset distribution for next round
          this.purchaseDistribution.forEach((_, key) => this.purchaseDistribution.set(key, 0));
        }
      }
    }
  }

  private endRound(): void {
    const scoring = this.jeu.scoring;

    // Give wallet refill based on chain
    const refill = 30 + this.chainLength * 5;
    this.wallet += refill;
    this.walletText.setText(`💰 Portefeuille : ${this.wallet}`);
    this.showFloatingText(this.scale.width / 2, 40, `+${refill} 💰 !`, '#44ff44');

    if (this.wallet <= 0) {
      GameState.triggerGameOver();
    }
  }

  private showFloatingText(x: number, y: number, msg: string, color: string): void {
    const text = this.add.text(x, y, msg, {
      fontSize: '22px', color, fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: y - 50, alpha: 0, duration: 1200,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
  }
}

registerScene('la-monnaie-locale', LaMonnaieLocaleScene);
