/**
 * LaBanqueDuTempsScene — Memory matching: besoins/compétences pairs.
 * Retourner 2 cartes pour trouver une paire besoin/compétence.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Card {
  id: number;
  pairId: number;
  type: 'besoin' | 'competence';
  label: string;
  faceUp: boolean;
  matched: boolean;
  container: Phaser.GameObjects.Container;
  back: Phaser.GameObjects.Rectangle;
  frontRect: Phaser.GameObjects.Rectangle;
  frontText: Phaser.GameObjects.Text;
}

const PAIRS = [
  { besoin: '🔧 Plomberie', competence: '👷 Plombier' },
  { besoin: '📚 Cours maths', competence: '🎓 Prof' },
  { besoin: '🌱 Jardinage', competence: '🧑‍🌾 Jardinier' },
  { besoin: '🍳 Cuisine', competence: '👨‍🍳 Cuisinier' },
  { besoin: '💻 Info', competence: '🧑‍💻 Dev' },
  { besoin: '🎵 Musique', competence: '🎸 Musicien' },
  { besoin: '🪡 Couture', competence: '🧵 Couturier' },
  { besoin: '🚗 Transport', competence: '🚙 Chauffeur' },
];

export class LaBanqueDuTempsScene extends BaseGameScene {
  private cards: Card[] = [];
  private flippedCards: Card[] = [];
  private isChecking: boolean = false;
  private totalFlips: number = 0;
  private consecutiveMatches: number = 0;
  private matchedPairs: number = 0;
  private totalPairs: number = 0;
  private flipCountText!: Phaser.GameObjects.Text;

  constructor() {
    super('GameScene_la-banque-du-temps');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: Des cartes besoins et compétences apparaissent face cachée
    const pairCount = 6; // 6 pairs = 12 cards
    this.totalPairs = pairCount;
    const selectedPairs = Phaser.Utils.Array.Shuffle([...PAIRS]).slice(0, pairCount);

    // Create card data
    const cardData: { pairId: number; type: 'besoin' | 'competence'; label: string }[] = [];
    selectedPairs.forEach((pair, idx) => {
      cardData.push({ pairId: idx, type: 'besoin', label: pair.besoin });
      cardData.push({ pairId: idx, type: 'competence', label: pair.competence });
    });

    // Shuffle
    Phaser.Utils.Array.Shuffle(cardData);

    // Layout: 4 columns x 3 rows
    const cols = 4;
    const rows = 3;
    const cardW = Math.min((width - 60) / cols, 120);
    const cardH = Math.min((height - 180) / rows, 100);
    const startX = (width - cols * (cardW + 10)) / 2 + cardW / 2;
    const startY = (height - rows * (cardH + 10)) / 2 + cardH / 2;

    cardData.forEach((data, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + 10);
      const y = startY + row * (cardH + 10);

      // Back of card (face down)
      const back = this.add.rectangle(0, 0, cardW, cardH, 0x4466aa).setStrokeStyle(2, 0x6688cc);
      const backLabel = this.add.text(0, 0, '?', {
        fontSize: '28px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      }).setOrigin(0.5);

      // Front of card
      const typeColor = data.type === 'besoin' ? 0xcc4444 : 0x44aa44;
      const frontRect = this.add.rectangle(0, 0, cardW, cardH, typeColor).setStrokeStyle(2, 0xffffff).setVisible(false);
      const typeLabel = data.type === 'besoin' ? 'BESOIN' : 'COMPÉTENCE';
      const frontText = this.add.text(0, -10, data.label, {
        fontSize: '14px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
        align: 'center', wordWrap: { width: cardW - 10 },
      }).setOrigin(0.5).setVisible(false);
      const frontTypeText = this.add.text(0, cardH / 2 - 14, typeLabel, {
        fontSize: '10px', color: '#ffcc00', fontFamily: 'Arial',
      }).setOrigin(0.5).setVisible(false);

      const container = this.add.container(x, y, [back, backLabel, frontRect, frontText, frontTypeText]);

      const card: Card = {
        id: i,
        pairId: data.pairId,
        type: data.type,
        label: data.label,
        faceUp: false,
        matched: false,
        container,
        back,
        frontRect,
        frontText,
      };
      this.cards.push(card);

      // Règle: Retourner 2 cartes pour trouver une paire
      const hitArea = this.add.rectangle(x, y, cardW, cardH, 0x000000, 0).setInteractive();
      hitArea.on('pointerdown', () => this.flipCard(card));
    });

    // Flip counter
    this.flipCountText = this.add.text(width / 2, 40, 'Retournements : 0 / 20', {
      fontSize: '20px', color: '#ffffff', fontFamily: 'Arial',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(10);
  }

  private flipCard(card: Card): void {
    if (this.isChecking || card.faceUp || card.matched || GameState.isGameOver) return;
    if (this.flippedCards.length >= 2) return;

    const scoring = this.jeu.scoring;

    // Règle: Compléter toutes les paires en moins de 20 retournements
    this.totalFlips++;
    this.flipCountText.setText(`Retournements : ${this.totalFlips} / 20`);
    GameState.addScore(scoring.retournement_malus || -2);

    // Show card face
    card.faceUp = true;
    card.back.setVisible(false);
    card.container.getAll().forEach((child: any) => {
      if (child !== card.back) child.setVisible(true);
    });
    card.frontRect.setVisible(true);
    card.frontText.setVisible(true);

    this.flippedCards.push(card);

    if (this.flippedCards.length === 2) {
      this.isChecking = true;
      this.time.delayedCall(800, () => this.checkMatch());
    }
  }

  private checkMatch(): void {
    const scoring = this.jeu.scoring;
    const [card1, card2] = this.flippedCards;

    // Règle: Paire correcte = besoin matches compétence with same pairId
    if (card1.pairId === card2.pairId && card1.type !== card2.type) {
      // Match!
      card1.matched = true;
      card2.matched = true;
      this.matchedPairs++;
      this.consecutiveMatches++;

      // Règle: Paire correcte = échange réalisé (+scoring.paire_correcte pts, +3 solidarité)
      GameState.addScore(scoring.paire_correcte || 15);
      GameState.addSolidarite(3);

      // Règle: 3 échanges consécutifs = chaîne solidaire
      if (this.consecutiveMatches >= 3) {
        GameState.addScore(scoring.chaine_solidaire || 50);
        GameState.addSolidarite(5);
        this.showBonusText('Chaîne solidaire !');
        this.consecutiveMatches = 0;
      }

      // Flash matched cards
      this.tweens.add({ targets: card1.container, scaleX: 1.1, scaleY: 1.1, yoyo: true, duration: 200 });
      this.tweens.add({ targets: card2.container, scaleX: 1.1, scaleY: 1.1, yoyo: true, duration: 200 });

      // Règle: Compléter toutes les paires = niveau complet
      if (this.matchedPairs === this.totalPairs) {
        GameState.addScore(scoring.niveau_complete || 100);
        GameState.addSolidarite(10);
        this.showBonusText('Niveau complété !');
      }
    } else {
      // Règle: Paire incorrecte = les cartes se retournent
      this.consecutiveMatches = 0;
      card1.faceUp = false;
      card2.faceUp = false;
      card1.frontRect.setVisible(false);
      card1.frontText.setVisible(false);
      card2.frontRect.setVisible(false);
      card2.frontText.setVisible(false);
      card1.back.setVisible(true);
      card2.back.setVisible(true);
      // Re-show back labels
      card1.container.getAll().forEach((child: any) => {
        if (child === card1.back || (child instanceof Phaser.GameObjects.Text && child.text === '?')) child.setVisible(true);
        else child.setVisible(false);
      });
      card2.container.getAll().forEach((child: any) => {
        if (child === card2.back || (child instanceof Phaser.GameObjects.Text && child.text === '?')) child.setVisible(true);
        else child.setVisible(false);
      });
    }

    // Règle: Compléter en moins de 20 retournements
    if (this.totalFlips >= 20 && this.matchedPairs < this.totalPairs) {
      GameState.triggerGameOver();
    }

    this.flippedCards = [];
    this.isChecking = false;
  }

  private showBonusText(msg: string): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2, msg, {
      fontSize: '28px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: height / 2 - 60, alpha: 0, duration: 1500,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
  }
}

registerScene('la-banque-du-temps', LaBanqueDuTempsScene);
