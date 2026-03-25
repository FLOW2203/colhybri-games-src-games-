/**
 * LeReseauDEntraideScene — Network: connecter besoins et offres entre habitants.
 * Tracer des lignes sans croisement pour construire un réseau d'entraide.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Habitant {
  x: number;
  y: number;
  label: string;
  type: 'besoin' | 'offre';
  category: string;
  node: Phaser.GameObjects.Rectangle;
  text: Phaser.GameObjects.Text;
}

interface Connection {
  from: Habitant;
  to: Habitant;
  line: Phaser.GameObjects.Line;
}

export class LeReseauDEntraideScene extends BaseGameScene {
  private habitants: Habitant[] = [];
  private connections: Connection[] = [];
  private selectedHabitant: Habitant | null = null;
  private drawingLine: Phaser.GameObjects.Line | null = null;
  private errorCount: number = 0;
  private totalPairs: number = 0;
  private connectedPairs: number = 0;

  private pairData = [
    { besoin: 'Courses', offre: 'Livreur', category: 'aide' },
    { besoin: 'Garderie', offre: 'Nounou', category: 'enfants' },
    { besoin: 'Réparation', offre: 'Bricoleur', category: 'maison' },
    { besoin: 'Transport', offre: 'Chauffeur', category: 'mobilite' },
    { besoin: 'Jardinage', offre: 'Jardinier', category: 'nature' },
  ];

  constructor() {
    super('GameScene_le-reseau-dentraide');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.05, 'Réseau d\'Entraide', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.add.text(width * 0.15, height * 0.1, 'Besoins', {
      fontSize: '16px', color: '#ff8888', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.add.text(width * 0.85, height * 0.1, 'Offres', {
      fontSize: '16px', color: '#88ff88', fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.totalPairs = this.pairData.length;

    // Règle: Des habitants apparaissent avec des bulles de besoin/offre
    // Create besoin nodes on left, shuffled
    const besoinOrder = Phaser.Utils.Array.Shuffle([...Array(this.pairData.length).keys()]);
    const offreOrder = Phaser.Utils.Array.Shuffle([...Array(this.pairData.length).keys()]);

    for (let i = 0; i < this.pairData.length; i++) {
      const pair = this.pairData[i];
      const by = height * 0.2 + besoinOrder[i] * (height * 0.13);
      const oy = height * 0.2 + offreOrder[i] * (height * 0.13);

      // Besoin node
      const bNode = this.add.rectangle(width * 0.15, by, 90, 40, 0xcc4444);
      bNode.setInteractive();
      bNode.setStrokeStyle(2, 0xff6666);
      const bText = this.add.text(width * 0.15, by, pair.besoin, {
        fontSize: '13px', color: '#ffffff',
      }).setOrigin(0.5);

      const besoin: Habitant = {
        x: width * 0.15, y: by, label: pair.besoin,
        type: 'besoin', category: pair.category,
        node: bNode, text: bText,
      };
      this.habitants.push(besoin);

      // Offre node
      const oNode = this.add.rectangle(width * 0.85, oy, 90, 40, 0x44aa44);
      oNode.setInteractive();
      oNode.setStrokeStyle(2, 0x66ff66);
      const oText = this.add.text(width * 0.85, oy, pair.offre, {
        fontSize: '13px', color: '#ffffff',
      }).setOrigin(0.5);

      const offre: Habitant = {
        x: width * 0.85, y: oy, label: pair.offre,
        type: 'offre', category: pair.category,
        node: oNode, text: oText,
      };
      this.habitants.push(offre);

      // Setup interaction
      bNode.on('pointerdown', () => this.selectHabitant(besoin));
      oNode.on('pointerdown', () => this.selectHabitant(offre));
    }

    // Drawing line follows pointer
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.selectedHabitant && this.drawingLine) {
        this.drawingLine.setTo(
          this.selectedHabitant.x, this.selectedHabitant.y,
          pointer.x, pointer.y
        );
      }
    });
  }

  private selectHabitant(hab: Habitant): void {
    if (!this.selectedHabitant) {
      // First selection
      this.selectedHabitant = hab;
      hab.node.setFillStyle(0xffcc44);

      // Start drawing line
      this.drawingLine = this.add.line(
        0, 0, hab.x, hab.y, hab.x, hab.y, 0xffcc44
      ).setOrigin(0).setLineWidth(2);
    } else {
      // Second selection — try to connect
      const from = this.selectedHabitant;
      const to = hab;

      // Clean up drawing line
      if (this.drawingLine) { this.drawingLine.destroy(); this.drawingLine = null; }

      // Reset first node color
      from.node.setFillStyle(from.type === 'besoin' ? 0xcc4444 : 0x44aa44);

      // Must connect besoin to offre (or vice versa)
      if (from.type === to.type) {
        this.selectedHabitant = null;
        return;
      }

      const besoin = from.type === 'besoin' ? from : to;
      const offre = from.type === 'offre' ? from : to;

      // Règle: Connexion correcte = lien d'entraide (+scoring.connexion pts, +3 solidarité)
      if (besoin.category === offre.category) {
        // Check if already connected
        const alreadyConnected = this.connections.some(
          c => c.from.category === besoin.category
        );
        if (!alreadyConnected) {
          const line = this.add.line(
            0, 0, besoin.x, besoin.y, offre.x, offre.y, 0x44ff44
          ).setOrigin(0).setLineWidth(3);

          // Check for crossing lines
          const crosses = this.checkCrossings(besoin, offre);

          this.connections.push({ from: besoin, to: offre, line });
          this.connectedPairs++;

          const scoring = this.jeu.scoring;
          GameState.addScore(scoring.connexion);
          GameState.addSolidarite(3);

          // Règle: Connexion incorrecte = les lignes se croisent (-scoring.croisement pts)
          if (crosses) {
            GameState.addScore(scoring.croisement);
            this.errorCount++;
            line.setStrokeStyle(3, 0xffaa00);
          }

          // Disable connected nodes
          besoin.node.setFillStyle(0x666666);
          offre.node.setFillStyle(0x666666);
          besoin.node.removeAllListeners();
          offre.node.removeAllListeners();

          // Règle: Objectif : connecter tous les habitants sans croisement
          if (this.connectedPairs >= this.totalPairs) {
            this.completeNetwork();
          }
        }
      } else {
        // Règle: Connexion incorrecte
        const scoring = this.jeu.scoring;
        GameState.addScore(scoring.croisement);
        this.errorCount++;
      }

      this.selectedHabitant = null;
    }
  }

  private checkCrossings(newFrom: Habitant, newTo: Habitant): boolean {
    for (const conn of this.connections) {
      if (this.linesIntersect(
        newFrom.x, newFrom.y, newTo.x, newTo.y,
        conn.from.x, conn.from.y, conn.to.x, conn.to.y
      )) {
        return true;
      }
    }
    return false;
  }

  private linesIntersect(
    x1: number, y1: number, x2: number, y2: number,
    x3: number, y3: number, x4: number, y4: number,
  ): boolean {
    const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
    if (Math.abs(denom) < 0.001) return false;

    const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
    const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

    return t > 0.01 && t < 0.99 && u > 0.01 && u < 0.99;
  }

  // Règle: Plus le réseau grandit, plus les bonus sont élevés
  private completeNetwork(): void {
    const scoring = this.jeu.scoring;

    // Règle: Réseau complet bonus
    GameState.addScore(scoring.reseau_complet);

    // Règle: Sans erreur bonus
    if (this.errorCount === 0) {
      GameState.addScore(scoring.sans_erreur);
    }

    const { width, height } = this.scale;
    this.add.text(width / 2, height * 0.92, 'Réseau complet !', {
      fontSize: '28px', color: '#44ff44', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.time.delayedCall(2000, () => {
      GameState.triggerGameOver();
    });
  }

  shutdown(): void {
    super.shutdown();
  }
}

registerScene('le-reseau-dentraide', LeReseauDEntraideScene);
