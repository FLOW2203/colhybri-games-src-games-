/**
 * LeBusSolidaireScene — Simulation: conduire un bus solidaire sur un parcours.
 * Embarquer des passagers aux arrêts, respecter les horaires.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Arret {
  x: number;
  y: number;
  name: string;
  passagers: number;
  hasPMR: boolean;
  timeLimit: number; // seconds to reach this stop
  node: Phaser.GameObjects.Rectangle | null;
  label: Phaser.GameObjects.Text | null;
  visited: boolean;
}

export class LeBusSolidaireScene extends BaseGameScene {
  private bus!: Phaser.GameObjects.Rectangle;
  private busLabel!: Phaser.GameObjects.Text;
  private arrets: Arret[] = [];
  private currentArretIndex: number = 0;
  private passagersEmbarques: number = 0;
  private routeLine!: Phaser.GameObjects.Graphics;
  private busMoving: boolean = false;
  private arretTimer: number = 0;
  private arretTimerText!: Phaser.GameObjects.Text;
  private arretTimerEvent: Phaser.Time.TimerEvent | null = null;
  private feedbackText!: Phaser.GameObjects.Text;
  private totalPassagers: number = 0;

  private arretDefs = [
    { name: 'Mairie', passagers: 3, hasPMR: false, timeLimit: 8 },
    { name: 'Marché', passagers: 4, hasPMR: true, timeLimit: 10 },
    { name: 'École', passagers: 5, hasPMR: false, timeLimit: 8 },
    { name: 'Hôpital', passagers: 2, hasPMR: true, timeLimit: 12 },
    { name: 'Parc', passagers: 3, hasPMR: false, timeLimit: 8 },
    { name: 'Gare', passagers: 4, hasPMR: true, timeLimit: 10 },
  ];

  constructor() {
    super('GameScene_le-bus-solidaire');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    this.add.text(width / 2, height * 0.04, 'Le Bus Solidaire', {
      fontSize: '24px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Règle: Le bus suit un parcours avec des arrêts
    // Create route
    this.routeLine = this.add.graphics();
    this.routeLine.lineStyle(4, 0x666666);

    const arretPositions: { x: number; y: number }[] = [];
    for (let i = 0; i < this.arretDefs.length; i++) {
      const angle = (i / this.arretDefs.length) * Math.PI * 1.5 + Math.PI * 0.25;
      const rx = width * 0.3;
      const ry = height * 0.25;
      const cx = width / 2;
      const cy = height * 0.5;
      arretPositions.push({
        x: cx + Math.cos(angle) * rx,
        y: cy + Math.sin(angle) * ry,
      });
    }

    // Draw route lines
    this.routeLine.beginPath();
    this.routeLine.moveTo(arretPositions[0].x, arretPositions[0].y);
    for (let i = 1; i < arretPositions.length; i++) {
      this.routeLine.lineTo(arretPositions[i].x, arretPositions[i].y);
    }
    this.routeLine.strokePath();

    // Create arrêt nodes
    for (let i = 0; i < this.arretDefs.length; i++) {
      const def = this.arretDefs[i];
      const pos = arretPositions[i];
      this.totalPassagers += def.passagers;

      const node = this.add.rectangle(pos.x, pos.y, 50, 50, 0x4466aa);
      node.setStrokeStyle(2, 0x6688cc);
      node.setInteractive();

      const label = this.add.text(pos.x, pos.y - 35, def.name, {
        fontSize: '12px', color: '#ffffff', fontFamily: 'Arial',
      }).setOrigin(0.5);

      const pLabel = this.add.text(pos.x, pos.y, `${def.passagers}${def.hasPMR ? '♿' : ''}`, {
        fontSize: '14px', color: '#ffffff',
      }).setOrigin(0.5);

      const arret: Arret = {
        ...pos, ...def, node, label, visited: false,
      };
      this.arrets.push(arret);

      // Règle: Tap sur les arrêts pour s'arrêter et embarquer des passagers
      node.on('pointerdown', () => {
        this.tryStopAtArret(i);
      });
    }

    // Bus starts at first arrêt
    this.bus = this.add.rectangle(
      arretPositions[0].x, arretPositions[0].y + 60, 60, 30, 0xffaa00
    );
    this.busLabel = this.add.text(
      arretPositions[0].x, arretPositions[0].y + 60, '🚌', { fontSize: '24px' }
    ).setOrigin(0.5);

    // Feedback text
    this.feedbackText = this.add.text(width / 2, height * 0.88, '', {
      fontSize: '18px', color: '#ffffff', fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Règle: Respecter les horaires (timer par arrêt)
    this.arretTimerText = this.add.text(width / 2, height * 0.12, '', {
      fontSize: '20px', color: '#ffcc44', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    // Passagers count
    this.add.text(20, height * 0.12, 'Passagers: 0', {
      fontSize: '16px', color: '#ffffff',
    }).setOrigin(0);

    // Start timer for first stop
    this.startArretTimer();
  }

  private startArretTimer(): void {
    if (this.currentArretIndex >= this.arrets.length) return;

    const arret = this.arrets[this.currentArretIndex];
    this.arretTimer = arret.timeLimit;
    this.arretTimerText.setText(`Prochain: ${arret.name} — ${this.arretTimer}s`);

    // Highlight current target
    if (arret.node) {
      arret.node.setStrokeStyle(3, 0xffcc44);
    }

    if (this.arretTimerEvent) this.arretTimerEvent.destroy();

    this.arretTimerEvent = this.time.addEvent({
      delay: 1000,
      repeat: arret.timeLimit - 1,
      callback: () => {
        this.arretTimer--;
        this.arretTimerText.setText(`Prochain: ${arret.name} — ${this.arretTimer}s`);

        if (this.arretTimer <= 0) {
          // Règle: Retard malus
          const scoring = this.jeu.scoring;
          GameState.addScore(scoring.retard_malus);
          this.showFeedback('Retard !', '#ff4444');
          this.advanceToNextStop();
        }
      },
    });
  }

  private tryStopAtArret(index: number): void {
    if (GameState.isGameOver) return;
    if (index !== this.currentArretIndex) return;

    const arret = this.arrets[index];
    if (arret.visited) return;

    const scoring = this.jeu.scoring;
    arret.visited = true;

    // Move bus to stop
    this.tweens.add({
      targets: [this.bus, this.busLabel],
      x: arret.x,
      y: arret.y + 60,
      duration: 300,
      onComplete: () => {
        // Règle: Chaque passager embarqué = +scoring.passager_embarque pts, +2 solidarité
        for (let p = 0; p < arret.passagers; p++) {
          GameState.addScore(scoring.passager_embarque);
          GameState.addSolidarite(2);
        }
        this.passagersEmbarques += arret.passagers;

        // Règle: Bonus : embarquer une personne à mobilité réduite = +scoring.pmr_embarque pts
        if (arret.hasPMR) {
          GameState.addScore(scoring.pmr_embarque);
          this.showFeedback(`+${arret.passagers} passagers + PMR !`, '#88ff88');
        } else {
          this.showFeedback(`+${arret.passagers} passagers !`, '#88ff88');
        }

        // Règle: Respecter les horaires (timer par arrêt)
        if (this.arretTimer > 0) {
          GameState.addScore(scoring.horaire_respecte);
        }

        // Mark stop as visited
        if (arret.node) {
          arret.node.setFillStyle(0x338833);
          arret.node.setStrokeStyle(2, 0x44aa44);
        }

        this.advanceToNextStop();
      },
    });
  }

  private advanceToNextStop(): void {
    if (this.arretTimerEvent) this.arretTimerEvent.destroy();

    this.currentArretIndex++;

    // Règle: Compléter le circuit avec tous les passagers livrés
    if (this.currentArretIndex >= this.arrets.length) {
      this.completeCircuit();
    } else {
      this.startArretTimer();
    }
  }

  private completeCircuit(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    GameState.addScore(scoring.circuit_complet);

    this.arretTimerText.setText('Circuit terminé !');
    this.add.text(width / 2, height * 0.5, `${this.passagersEmbarques} passagers livrés !`, {
      fontSize: '28px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(10);

    this.time.delayedCall(2500, () => {
      GameState.triggerGameOver();
    });
  }

  private showFeedback(msg: string, color: string): void {
    this.feedbackText.setText(msg).setColor(color).setAlpha(1);
    this.tweens.add({
      targets: this.feedbackText,
      alpha: 0,
      duration: 1500,
      ease: 'Power2',
    });
  }

  shutdown(): void {
    super.shutdown();
    if (this.arretTimerEvent) this.arretTimerEvent.destroy();
  }
}

registerScene('le-bus-solidaire', LeBusSolidaireScene);
