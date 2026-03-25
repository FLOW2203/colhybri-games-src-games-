/**
 * LaCleanWalkScene — Runner: ramasser les déchets sur un sentier.
 * Le personnage court automatiquement, tap pour ramasser, swipe pour esquiver.
 */
import Phaser from 'phaser';
import { BaseGameScene } from './BaseGameScene';
import { GameState } from '../../core/GameState';
import { EventBus, EVENTS } from '../../core/EventBus';
import { registerScene } from '../../GameRouter';

export class LaCleanWalkScene extends BaseGameScene {
  private runner!: Phaser.GameObjects.Rectangle;
  private runnerLabel!: Phaser.GameObjects.Text;
  private dechets: Phaser.GameObjects.Container[] = [];
  private obstacles: Phaser.GameObjects.Container[] = [];
  private sacCount: number = 0;
  private sacMax: number = 5;
  private sacBar!: Phaser.GameObjects.Rectangle;
  private sacBarBg!: Phaser.GameObjects.Rectangle;
  private distanceTraveled: number = 0;
  private speed: number = 2;
  private lane: number = 1; // 0=left, 1=center, 2=right
  private lanePositions: number[] = [];
  private swipeStartX: number = 0;
  private swipeStartY: number = 0;
  private spawnDechetTimer: Phaser.Time.TimerEvent | null = null;
  private spawnObstacleTimer: Phaser.Time.TimerEvent | null = null;
  private gameLoopTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('GameScene_la-clean-walk');
  }

  protected setupGameplay(): void {
    const { width, height } = this.scale;
    const scoring = this.jeu.scoring;

    // Règle: 3 couloirs sur le sentier
    const laneWidth = width / 3;
    this.lanePositions = [
      laneWidth * 0.5,
      laneWidth * 1.5,
      laneWidth * 2.5,
    ];

    // Règle: Le personnage court automatiquement sur un sentier
    this.runner = this.add.rectangle(
      this.lanePositions[this.lane], height * 0.8, 45, 55, 0x33aa55
    );
    this.runnerLabel = this.add.text(
      this.lanePositions[this.lane], height * 0.8, '🏃', { fontSize: '36px' }
    ).setOrigin(0.5).setDepth(1);

    // Sac poubelle gauge
    this.sacBarBg = this.add.rectangle(width - 40, height * 0.5, 20, 150, 0x444444);
    this.sacBar = this.add.rectangle(width - 40, height * 0.5 + 75, 20, 0, 0x88cc00).setOrigin(0.5, 1);
    this.add.text(width - 40, height * 0.5 - 90, '🗑️', { fontSize: '20px' }).setOrigin(0.5);

    // Règle: Swipe pour esquiver les obstacles naturels (rochers, branches)
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.swipeStartX = pointer.x;
      this.swipeStartY = pointer.y;
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const dx = pointer.x - this.swipeStartX;
      const dy = pointer.y - this.swipeStartY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > 40 && Math.abs(dx) > Math.abs(dy)) {
        // Swipe horizontal = esquiver
        if (dx < 0 && this.lane > 0) {
          this.lane--;
        } else if (dx > 0 && this.lane < 2) {
          this.lane++;
        }
        this.runner.setX(this.lanePositions[this.lane]);
        this.runnerLabel.setX(this.lanePositions[this.lane]);
      } else if (dist < 30) {
        // Règle: Tap sur les déchets pour les ramasser (+scoring.dechet_ramasse pts)
        this.tryCollectDechet(pointer.x, pointer.y);
      }
    });

    // Spawn déchets
    this.spawnDechetTimer = this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => this.spawnDechet(),
    });

    // Spawn obstacles
    this.spawnObstacleTimer = this.time.addEvent({
      delay: 2000,
      loop: true,
      callback: () => this.spawnObstacle(),
    });

    // Main game loop
    this.gameLoopTimer = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => this.gameLoop(),
    });
  }

  private spawnDechet(): void {
    const laneIdx = Phaser.Math.Between(0, 2);
    const x = this.lanePositions[laneIdx];
    const types = ['🥤', '📦', '🧴', '🍬'];
    const type = types[Phaser.Math.Between(0, types.length - 1)];

    const rect = this.add.rectangle(0, 0, 35, 35, 0x886644);
    const label = this.add.text(0, 0, type, { fontSize: '24px' }).setOrigin(0.5);
    const container = this.add.container(x, -30, [rect, label]);
    (container as any).isDechet = true;
    this.dechets.push(container);
  }

  private spawnObstacle(): void {
    const laneIdx = Phaser.Math.Between(0, 2);
    const x = this.lanePositions[laneIdx];
    const types = ['🪨', '🌿'];
    const type = types[Phaser.Math.Between(0, types.length - 1)];

    const rect = this.add.rectangle(0, 0, 50, 40, 0x666666);
    const label = this.add.text(0, 0, type, { fontSize: '28px' }).setOrigin(0.5);
    const container = this.add.container(x, -30, [rect, label]);
    this.obstacles.push(container);
  }

  private tryCollectDechet(px: number, py: number): void {
    const scoring = this.jeu.scoring;
    for (let i = this.dechets.length - 1; i >= 0; i--) {
      const d = this.dechets[i];
      if (Math.abs(d.x - px) < 50 && Math.abs(d.y - py) < 50) {
        // Règle: Tap sur les déchets pour les ramasser (+scoring.dechet_ramasse pts)
        GameState.addScore(scoring.dechet_ramasse);
        this.sacCount++;

        // Règle: Chaque déchet ramassé remplit le sac poubelle
        const fillH = (this.sacCount / this.sacMax) * 150;
        this.sacBar.setSize(20, fillH);

        // Règle: Sac plein = bonus vidage (+scoring.sac_plein pts, +5 solidarité)
        if (this.sacCount >= this.sacMax) {
          GameState.addScore(scoring.sac_plein);
          GameState.addSolidarite(5);
          this.sacCount = 0;
          this.sacBar.setSize(20, 0);
        }

        d.destroy();
        this.dechets.splice(i, 1);
        return;
      }
    }
  }

  private gameLoop(): void {
    if (GameState.isGameOver) return;

    const { height } = this.scale;
    const scoring = this.jeu.scoring;
    const runnerX = this.runner.x;
    const runnerY = this.runner.y;

    // Règle: Distance parcourue = score bonus continu
    this.distanceTraveled += this.speed * 0.01;
    if (Math.floor(this.distanceTraveled) > Math.floor(this.distanceTraveled - this.speed * 0.01)) {
      GameState.addScore(scoring.distance_bonus);
    }

    // Move dechets down
    for (let i = this.dechets.length - 1; i >= 0; i--) {
      const d = this.dechets[i];
      d.y += this.speed * 1.5;
      if (d.y > height + 50) {
        d.destroy();
        this.dechets.splice(i, 1);
      }
    }

    // Move obstacles down and check collision
    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.y += this.speed * 2;

      // Règle: Swipe pour esquiver les obstacles naturels (rochers, branches)
      if (Math.abs(obs.x - runnerX) < 40 && Math.abs(obs.y - runnerY) < 40) {
        GameState.addScore(scoring.obstacle_malus);
        GameState.loseLife();
        obs.destroy();
        this.obstacles.splice(i, 1);
        continue;
      }

      if (obs.y > height + 50) {
        obs.destroy();
        this.obstacles.splice(i, 1);
      }
    }

    // Increase speed over time
    this.speed += 0.0002;
  }

  shutdown(): void {
    super.shutdown();
    if (this.spawnDechetTimer) this.spawnDechetTimer.destroy();
    if (this.spawnObstacleTimer) this.spawnObstacleTimer.destroy();
    if (this.gameLoopTimer) this.gameLoopTimer.destroy();
  }
}

registerScene('la-clean-walk', LaCleanWalkScene);
