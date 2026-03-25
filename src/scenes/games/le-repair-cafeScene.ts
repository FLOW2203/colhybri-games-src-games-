/**
 * LeRepairCafeScene — Mini-game collection: repair broken objects.
 * Chaque objet = un mini-jeu de réparation différent.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

type RepairType = 'velo' | 'grille_pain' | 'pull' | 'chaise';

interface RepairObject {
  type: RepairType;
  label: string;
  emoji: string;
  color: number;
}

const REPAIR_OBJECTS: RepairObject[] = [
  { type: 'velo', label: 'Vélo', emoji: '🚲', color: 0x4488cc },
  { type: 'grille_pain', label: 'Grille-pain', emoji: '🍞', color: 0xcc8844 },
  { type: 'pull', label: 'Pull', emoji: '🧶', color: 0xcc44aa },
  { type: 'chaise', label: 'Chaise', emoji: '🪑', color: 0x886633 },
];

export class LeRepairCafeScene extends BaseGameScene {
  private currentObject: RepairObject | null = null;
  private repairCount: number = 0;
  private consecutiveRepairs: number = 0;
  private repairStartTime: number = 0;
  private miniGameActive: boolean = false;
  private miniGameElements: Phaser.GameObjects.GameObject[] = [];

  // Vélo mini-game
  private rotationProgress: number = 0;
  private lastAngle: number = 0;

  // Grille-pain mini-game
  private wiresConnected: number = 0;
  private totalWires: number = 3;

  // Pull mini-game
  private stitchPoints: { x: number; y: number; hit: boolean }[] = [];
  private stitchIdx: number = 0;

  // Chaise mini-game
  private puzzlePieces: { rect: Phaser.GameObjects.Rectangle; placed: boolean; targetX: number; targetY: number }[] = [];

  constructor() {
    super('GameScene_le-repair-cafe');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;

    // Règle: Des objets cassés arrivent
    this.showNextObject();
  }

  private showNextObject(): void {
    if (GameState.isGameOver) return;
    const { width, height } = this.scale;

    // Clean previous mini-game
    this.cleanMiniGame();

    // Pick random object
    this.currentObject = REPAIR_OBJECTS[Phaser.Math.Between(0, REPAIR_OBJECTS.length - 1)];
    this.repairStartTime = this.time.now;
    this.miniGameActive = true;

    // Show object header
    const header = this.add.text(width / 2, 50, `Réparer : ${this.currentObject.emoji} ${this.currentObject.label}`, {
      fontSize: '26px', color: '#ffffff', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);
    this.miniGameElements.push(header);

    // Launch appropriate mini-game
    switch (this.currentObject.type) {
      case 'velo': this.startVeloRepair(); break;
      case 'grille_pain': this.startGrillePainRepair(); break;
      case 'pull': this.startPullRepair(); break;
      case 'chaise': this.startChaiseRepair(); break;
    }

    // Timeout: if not repaired in 15s, fail
    const timeout = this.time.delayedCall(15000, () => {
      if (this.miniGameActive) {
        this.failRepair();
      }
    });
    this.miniGameElements.push(timeout as any);
  }

  // Règle: Vélo : tourner la clé (rotation gesture)
  private startVeloRepair(): void {
    const { width, height } = this.scale;
    this.rotationProgress = 0;
    this.lastAngle = 0;

    const centerX = width / 2;
    const centerY = height / 2;

    // Wrench visual
    const wrench = this.add.rectangle(centerX, centerY, 80, 80, 0x888888).setDepth(15);
    const wrenchLabel = this.add.text(centerX, centerY, '🔧', { fontSize: '50px' }).setOrigin(0.5).setDepth(16);
    const progressText = this.add.text(centerX, centerY + 80, '0%', {
      fontSize: '24px', color: '#ffcc00', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(16);

    const circle = this.add.circle(centerX, centerY, 100, 0xffffff, 0.1).setDepth(14);
    const hint = this.add.text(centerX, centerY - 100, 'Faites tourner autour !', {
      fontSize: '18px', color: '#aaa', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(16);

    this.miniGameElements.push(wrench, wrenchLabel, progressText, circle, hint);

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.miniGameActive || !pointer.isDown || this.currentObject?.type !== 'velo') return;
      const angle = Phaser.Math.Angle.Between(centerX, centerY, pointer.x, pointer.y);
      const angleDeg = Phaser.Math.RadToDeg(angle);
      const diff = Math.abs(angleDeg - this.lastAngle);
      if (diff > 5 && diff < 180) {
        this.rotationProgress += diff * 0.3;
        wrenchLabel.setRotation(angle);
        progressText.setText(`${Math.min(100, Math.floor(this.rotationProgress))}%`);
      }
      this.lastAngle = angleDeg;

      if (this.rotationProgress >= 100) {
        this.completeRepair();
      }
    });
  }

  // Règle: Grille-pain : reconnecter les fils (drag & drop)
  private startGrillePainRepair(): void {
    const { width, height } = this.scale;
    this.wiresConnected = 0;
    this.totalWires = 3;

    const colors = [0xff0000, 0x00ff00, 0x0000ff];
    const wireNames = ['Rouge', 'Vert', 'Bleu'];

    for (let i = 0; i < this.totalWires; i++) {
      const startX = width * 0.2;
      const startY = height * 0.35 + i * 80;
      const endX = width * 0.8;
      const endY = height * 0.35 + i * 80;

      // Source
      const src = this.add.rectangle(startX, startY, 50, 30, colors[i]).setDepth(15);
      const srcLabel = this.add.text(startX, startY, wireNames[i], {
        fontSize: '12px', color: '#fff', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(16);

      // Target
      const tgt = this.add.rectangle(endX, endY, 50, 30, colors[i], 0.4).setStrokeStyle(2, colors[i]).setDepth(15);
      const tgtLabel = this.add.text(endX, endY, wireNames[i], {
        fontSize: '12px', color: '#fff', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(16);

      // Draggable wire end
      const wire = this.add.rectangle(startX + 60, startY, 30, 20, colors[i]).setInteractive({ draggable: true }).setDepth(17);
      const wireIdx = i;

      this.input.setDraggable(wire);
      wire.on('drag', (_p: any, dragX: number, dragY: number) => {
        wire.setPosition(dragX, dragY);
      });
      wire.on('dragend', () => {
        if (Math.abs(wire.x - endX) < 40 && Math.abs(wire.y - endY) < 30) {
          wire.setPosition(endX - 30, endY);
          wire.disableInteractive();
          this.wiresConnected++;
          // Draw connection line
          const line = this.add.line(0, 0, startX + 25, startY, endX - 25, endY, colors[wireIdx], 0.8).setLineWidth(3).setOrigin(0, 0).setDepth(14);
          this.miniGameElements.push(line);

          if (this.wiresConnected >= this.totalWires) {
            this.completeRepair();
          }
        } else {
          wire.setPosition(startX + 60, startY);
        }
      });

      this.miniGameElements.push(src, srcLabel, tgt, tgtLabel, wire);
    }

    const hint = this.add.text(width / 2, height * 0.2, 'Glissez les fils vers la droite', {
      fontSize: '18px', color: '#aaa', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(16);
    this.miniGameElements.push(hint);
  }

  // Règle: Pull : coudre le trou (tracer le chemin)
  private startPullRepair(): void {
    const { width, height } = this.scale;
    this.stitchIdx = 0;
    this.stitchPoints = [];

    // Generate stitch path (zigzag)
    const startX = width * 0.25;
    const endX = width * 0.75;
    const centerY = height / 2;
    const pointCount = 8;

    for (let i = 0; i < pointCount; i++) {
      const x = startX + (endX - startX) * (i / (pointCount - 1));
      const y = centerY + (i % 2 === 0 ? -25 : 25);
      this.stitchPoints.push({ x, y, hit: false });

      const dot = this.add.circle(x, y, 15, 0xff6699, 0.5).setStrokeStyle(2, 0xff6699).setDepth(15);
      const num = this.add.text(x, y, `${i + 1}`, {
        fontSize: '14px', color: '#fff', fontFamily: 'Arial',
      }).setOrigin(0.5).setDepth(16);
      this.miniGameElements.push(dot, num);
    }

    // Fabric background
    const fabric = this.add.rectangle(width / 2, centerY, endX - startX + 60, 100, 0x993366, 0.3).setDepth(14);
    const hint = this.add.text(width / 2, centerY - 80, 'Touchez les points dans l\'ordre !', {
      fontSize: '18px', color: '#aaa', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(16);
    this.miniGameElements.push(fabric, hint);

    const stitchGraphics = this.add.graphics().setDepth(15);
    this.miniGameElements.push(stitchGraphics);

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this.miniGameActive || this.currentObject?.type !== 'pull') return;
      const pt = this.stitchPoints[this.stitchIdx];
      if (!pt) return;

      if (Math.abs(pointer.x - pt.x) < 25 && Math.abs(pointer.y - pt.y) < 25) {
        pt.hit = true;
        if (this.stitchIdx > 0) {
          const prev = this.stitchPoints[this.stitchIdx - 1];
          stitchGraphics.lineStyle(3, 0xff6699);
          stitchGraphics.beginPath();
          stitchGraphics.moveTo(prev.x, prev.y);
          stitchGraphics.lineTo(pt.x, pt.y);
          stitchGraphics.strokePath();
        }
        this.stitchIdx++;
        if (this.stitchIdx >= this.stitchPoints.length) {
          this.completeRepair();
        }
      }
    });
  }

  // Règle: Chaise : coller les morceaux (puzzle)
  private startChaiseRepair(): void {
    const { width, height } = this.scale;
    this.puzzlePieces = [];

    // 4 puzzle pieces to drag to their targets
    const targets = [
      { x: width / 2 - 40, y: height / 2 - 40, label: '🔲' },
      { x: width / 2 + 40, y: height / 2 - 40, label: '🔲' },
      { x: width / 2 - 40, y: height / 2 + 40, label: '🔲' },
      { x: width / 2 + 40, y: height / 2 + 40, label: '🔲' },
    ];

    // Chair outline
    const outline = this.add.rectangle(width / 2, height / 2, 120, 120, 0x886633, 0.2).setStrokeStyle(2, 0x886633).setDepth(14);
    this.miniGameElements.push(outline);

    targets.forEach((tgt, i) => {
      // Target spot
      const tgtRect = this.add.rectangle(tgt.x, tgt.y, 50, 50, 0x886633, 0.3).setStrokeStyle(2, 0xaaaa55).setDepth(14);
      this.miniGameElements.push(tgtRect);

      // Draggable piece (scattered)
      const px = Phaser.Math.Between(40, width - 40);
      const py = Phaser.Math.Between(height * 0.7, height - 60);
      const piece = this.add.rectangle(px, py, 45, 45, 0xcc9944).setInteractive({ draggable: true }).setDepth(17);
      const pieceLabel = this.add.text(px, py, '🪵', { fontSize: '24px' }).setOrigin(0.5).setDepth(18);

      const pieceData = { rect: piece, placed: false, targetX: tgt.x, targetY: tgt.y };
      this.puzzlePieces.push(pieceData);

      this.input.setDraggable(piece);
      piece.on('drag', (_p: any, dragX: number, dragY: number) => {
        piece.setPosition(dragX, dragY);
        pieceLabel.setPosition(dragX, dragY);
      });
      piece.on('dragend', () => {
        if (Math.abs(piece.x - tgt.x) < 35 && Math.abs(piece.y - tgt.y) < 35) {
          piece.setPosition(tgt.x, tgt.y);
          pieceLabel.setPosition(tgt.x, tgt.y);
          piece.disableInteractive();
          pieceData.placed = true;
          piece.setFillStyle(0x00aa44);

          if (this.puzzlePieces.every(p => p.placed)) {
            this.completeRepair();
          }
        }
      });

      this.miniGameElements.push(piece, pieceLabel);
    });

    const hint = this.add.text(width / 2, height * 0.2, 'Glissez les morceaux en place !', {
      fontSize: '18px', color: '#aaa', fontFamily: 'Arial',
    }).setOrigin(0.5).setDepth(16);
    this.miniGameElements.push(hint);
  }

  private completeRepair(): void {
    if (!this.miniGameActive) return;
    this.miniGameActive = false;
    const scoring = this.jeu.scoring;
    const elapsed = this.time.now - this.repairStartTime;

    // Règle: Objet réparé = +scoring.objet_repare pts, +5 solidarité
    GameState.addScore(scoring.objet_repare || 20);
    GameState.addSolidarite(5);

    // Règle: Réparation rapide (< 8 seconds)
    if (elapsed < 8000) {
      GameState.addScore(scoring.reparation_rapide || 10);
    }

    this.repairCount++;
    this.consecutiveRepairs++;

    // Règle: Série de 3 réparations = bonus
    if (this.consecutiveRepairs >= 3) {
      GameState.addScore(scoring.serie_3_reparations || 30);
      GameState.addSolidarite(5);
      this.consecutiveRepairs = 0;
      this.showBonusText('Série de 3 !');
    }

    this.showBonusText('Réparé !');

    // Next object after delay
    this.time.delayedCall(1500, () => this.showNextObject());
  }

  private failRepair(): void {
    if (!this.miniGameActive) return;
    this.miniGameActive = false;
    const scoring = this.jeu.scoring;

    // Règle: Objet raté = scoring.objet_rate malus
    GameState.addScore(scoring.objet_rate || -10);
    this.consecutiveRepairs = 0;
    GameState.loseLife();

    this.showBonusText('Raté...');
    this.time.delayedCall(1500, () => this.showNextObject());
  }

  private cleanMiniGame(): void {
    this.miniGameElements.forEach(el => {
      if (el && (el as any).destroy) {
        try { (el as any).destroy(); } catch (e) { /* already destroyed */ }
      }
    });
    this.miniGameElements = [];
    this.input.removeAllListeners('pointermove');
    this.input.removeAllListeners('pointerdown');
    // Re-add pointer listeners will happen in each mini-game
  }

  private showBonusText(msg: string): void {
    const { width, height } = this.scale;
    const text = this.add.text(width / 2, height / 2 - 120, msg, {
      fontSize: '28px', color: '#ffd700', fontFamily: 'Arial', fontStyle: 'bold',
      stroke: '#000', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(50);
    this.tweens.add({
      targets: text, y: height / 2 - 180, alpha: 0, duration: 1200,
      onComplete: () => text.destroy(),
    });
  }

  shutdown(): void {
    super.shutdown();
    this.cleanMiniGame();
  }
}

registerScene('le-repair-cafe', LeRepairCafeScene);
