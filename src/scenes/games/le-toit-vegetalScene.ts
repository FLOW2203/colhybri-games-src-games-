/**
 * LeToitVegetalScene — Builder: végétaliser un toit par étapes.
 * Drag & drop, jauges, tap et connexion de tuyaux.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

interface Etape {
  name: string;
  instruction: string;
  color: number;
}

export class LeToitVegetalScene extends BaseGameScene {
  private currentStep: number = 0;
  private stepStartTime: number = 0;
  private instructionText!: Phaser.GameObjects.Text;
  private stepLabel!: Phaser.GameObjects.Text;
  private toitRect!: Phaser.GameObjects.Rectangle;
  private progressBar!: Phaser.GameObjects.Rectangle;
  private progressBarBg!: Phaser.GameObjects.Rectangle;
  private fillProgress: number = 0;
  private draggableItem: Phaser.GameObjects.Rectangle | null = null;
  private dropZone!: Phaser.GameObjects.Rectangle;
  private tuyauNodes: Phaser.GameObjects.Rectangle[] = [];
  private tuyauLines: Phaser.GameObjects.Line[] = [];
  private tuyauConnections: number = 0;
  private tuyauTarget: number = 3;
  private plantCount: number = 0;
  private plantTarget: number = 6;

  private etapes: Etape[] = [
    { name: 'Membrane étanche', instruction: 'Glissez la membrane sur le toit', color: 0x333333 },
    { name: 'Substrat', instruction: 'Tapez pour remplir la jauge de substrat', color: 0x8B4513 },
    { name: 'Plantation', instruction: 'Tapez sur le toit pour planter', color: 0x228B22 },
    { name: 'Arrosage', instruction: 'Connectez les tuyaux entre les points', color: 0x4488ff },
  ];

  constructor() {
    super('GameScene_le-toit-vegetal');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Toit de base
    this.toitRect = this.add.rectangle(width / 2, height * 0.55, width * 0.8, height * 0.35, 0x999999);
    this.toitRect.setStrokeStyle(3, 0x555555);

    // Labels
    this.stepLabel = this.add.text(width / 2, height * 0.15, '', {
      fontSize: '28px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
    }).setOrigin(0.5);

    this.instructionText = this.add.text(width / 2, height * 0.22, '', {
      fontSize: '20px', color: '#ffcc44', fontFamily: 'Arial', align: 'center',
      wordWrap: { width: width * 0.8 },
    }).setOrigin(0.5);

    // Progress bar
    this.progressBarBg = this.add.rectangle(width / 2, height * 0.9, width * 0.6, 20, 0x444444);
    this.progressBar = this.add.rectangle(width / 2 - width * 0.3, height * 0.9, 0, 20, 0x44cc44).setOrigin(0, 0.5);

    this.stepStartTime = this.time.now;
    this.startStep(0);
  }

  private startStep(stepIndex: number): void {
    this.currentStep = stepIndex;
    const etape = this.etapes[stepIndex];
    if (!etape) {
      // Règle: Toit complet
      this.completeToit();
      return;
    }

    this.stepLabel.setText(`Étape ${stepIndex + 1}/4 : ${etape.name}`);
    this.instructionText.setText(etape.instruction);
    this.stepStartTime = this.time.now;

    // Update progress bar
    const { width } = this.scale;
    this.progressBar.setSize((stepIndex / 4) * width * 0.6, 20);

    // Clean previous step elements
    this.cleanStepElements();

    switch (stepIndex) {
      case 0: this.setupMembraneStep(); break;
      case 1: this.setupSubstratStep(); break;
      case 2: this.setupPlantationStep(); break;
      case 3: this.setupArrosageStep(); break;
    }
  }

  private cleanStepElements(): void {
    if (this.draggableItem) { this.draggableItem.destroy(); this.draggableItem = null; }
    this.tuyauNodes.forEach(n => n.destroy());
    this.tuyauNodes = [];
    this.tuyauLines.forEach(l => l.destroy());
    this.tuyauLines = [];
    this.tuyauConnections = 0;
    this.plantCount = 0;
    this.fillProgress = 0;
  }

  // Règle: Étape 1 : poser la membrane étanche (drag & drop)
  private setupMembraneStep(): void {
    const { width, height } = this.scale;

    this.draggableItem = this.add.rectangle(width * 0.15, height * 0.85, 80, 40, 0x333333);
    this.draggableItem.setInteractive({ draggable: true });
    this.add.text(width * 0.15, height * 0.85, 'Membrane', {
      fontSize: '12px', color: '#ffffff',
    }).setOrigin(0.5);

    this.dropZone = this.add.rectangle(width / 2, height * 0.55, width * 0.7, height * 0.25, 0x555555, 0.3);
    this.dropZone.setStrokeStyle(2, 0xffcc44);

    this.input.on('drag', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle, dragX: number, dragY: number) => {
      gameObject.setPosition(dragX, dragY);
    });

    this.input.on('dragend', (_pointer: Phaser.Input.Pointer, gameObject: Phaser.GameObjects.Rectangle) => {
      const dx = Math.abs(gameObject.x - this.dropZone.x);
      const dy = Math.abs(gameObject.y - this.dropZone.y);
      if (dx < 100 && dy < 80) {
        this.toitRect.setFillStyle(this.etapes[0].color);
        this.completeStep();
      }
    });
  }

  // Règle: Étape 2 : ajouter le substrat (remplir la jauge)
  private setupSubstratStep(): void {
    const { width, height } = this.scale;

    const fillBarBg = this.add.rectangle(width / 2, height * 0.35, width * 0.5, 25, 0x333333);
    const fillBar = this.add.rectangle(width / 2 - width * 0.25, height * 0.35, 0, 25, 0x8B4513).setOrigin(0, 0.5);

    this.input.on('pointerdown', () => {
      if (this.currentStep !== 1) return;
      this.fillProgress += 0.1;
      fillBar.setSize(Math.min(this.fillProgress, 1) * width * 0.5, 25);

      if (this.fillProgress >= 1) {
        this.toitRect.setFillStyle(this.etapes[1].color);
        fillBarBg.destroy();
        fillBar.destroy();
        this.completeStep();
      }
    });
  }

  // Règle: Étape 3 : planter les sedums et graminées (tap pour planter)
  private setupPlantationStep(): void {
    const { width, height } = this.scale;
    const toitX = width * 0.1 + width * 0.1;
    const toitY = height * 0.4;
    const toitW = width * 0.8;
    const toitH = height * 0.35;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.currentStep !== 2) return;
      // Check if tap is on the toit area
      if (pointer.x > toitX && pointer.x < toitX + toitW - width * 0.1 &&
          pointer.y > toitY && pointer.y < toitY + toitH) {
        this.plantCount++;
        const plants = ['🌱', '🌿', '🌾'];
        const plant = plants[Phaser.Math.Between(0, plants.length - 1)];
        this.add.text(pointer.x, pointer.y, plant, { fontSize: '24px' }).setOrigin(0.5);

        if (this.plantCount >= this.plantTarget) {
          this.toitRect.setFillStyle(this.etapes[2].color);
          this.completeStep();
        }
      }
    });
  }

  // Règle: Étape 4 : installer le système d'arrosage (connecter les tuyaux)
  private setupArrosageStep(): void {
    const { width, height } = this.scale;

    // Create nodes to connect
    const positions = [
      { x: width * 0.2, y: height * 0.45 },
      { x: width * 0.5, y: height * 0.42 },
      { x: width * 0.8, y: height * 0.45 },
      { x: width * 0.35, y: height * 0.6 },
      { x: width * 0.65, y: height * 0.6 },
    ];

    let selectedNode: Phaser.GameObjects.Rectangle | null = null;

    for (const pos of positions) {
      const node = this.add.rectangle(pos.x, pos.y, 30, 30, 0x4488ff);
      node.setInteractive();
      node.setStrokeStyle(2, 0xffffff);
      this.tuyauNodes.push(node);

      node.on('pointerdown', () => {
        if (this.currentStep !== 3) return;
        if (!selectedNode) {
          selectedNode = node;
          node.setFillStyle(0xffcc44);
        } else if (selectedNode !== node) {
          // Draw line between nodes
          const line = this.add.line(
            0, 0,
            selectedNode.x, selectedNode.y,
            node.x, node.y,
            0x4488ff
          ).setOrigin(0).setLineWidth(3);
          this.tuyauLines.push(line);
          selectedNode.setFillStyle(0x4488ff);
          selectedNode = null;
          this.tuyauConnections++;

          if (this.tuyauConnections >= this.tuyauTarget) {
            this.toitRect.setFillStyle(this.etapes[3].color);
            this.completeStep();
          }
        }
      });
    }
  }

  // Règle: Chaque étape bien réalisée = +scoring.etape_reussie pts
  private completeStep(): void {
    const scoring = this.jeu.scoring;
    GameState.addScore(scoring.etape_reussie);

    // Règle: Bonus rapide si étape terminée en moins de 10s
    const elapsed = (this.time.now - this.stepStartTime) / 1000;
    if (elapsed < 10) {
      GameState.addScore(scoring.bonus_rapide);
    }

    // Remove all listeners before next step
    this.input.removeAllListeners();

    this.time.delayedCall(500, () => {
      this.startStep(this.currentStep + 1);
    });
  }

  private completeToit(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: Toit complet = bonus
    GameState.addScore(scoring.toit_complet);

    const { } = this.scale;
    this.progressBar.setSize(width * 0.6, 20);
    this.stepLabel.setText('Toit végétalisé !');
    this.instructionText.setText('Félicitations ! Le toit est complet.');

    this.time.delayedCall(2000, () => {
      GameState.triggerGameOver();
    });
  }

  shutdown(): void {
    super.shutdown();
    this.input.removeAllListeners();
  }
}

registerScene('le-toit-vegetal', LeToitVegetalScene);
