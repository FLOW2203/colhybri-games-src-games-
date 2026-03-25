/**
 * Player — Entité joueur réutilisable.
 * Animations depuis manifest assets du jeu actif.
 */
import Phaser from 'phaser';

export class Player extends Phaser.GameObjects.Sprite {
  private speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    speed: number = 300,
  ) {
    // Fallback to a rectangle if texture doesn't exist
    if (!scene.textures.exists(textureKey)) {
      console.warn(`[Player] Texture "${textureKey}" not found, using placeholder`);
      // Create a placeholder texture
      const gfx = scene.add.graphics();
      gfx.fillStyle(0x44cc88, 1);
      gfx.fillRoundedRect(0, 0, 64, 64, 8);
      gfx.generateTexture('player_placeholder', 64, 64);
      gfx.destroy();
      textureKey = 'player_placeholder';
    }

    super(scene, x, y, textureKey);
    this.speed = speed;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setCollideWorldBounds(true);

    // Create animation if spritesheet
    if (scene.textures.get(textureKey).frameTotal > 1) {
      scene.anims.create({
        key: `${textureKey}_idle`,
        frames: scene.anims.generateFrameNumbers(textureKey, {
          start: 0,
          end: scene.textures.get(textureKey).frameTotal - 2,
        }),
        frameRate: 10,
        repeat: -1,
      });
      this.play(`${textureKey}_idle`);
    }
  }

  moveLeft(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(-this.speed);
  }

  moveRight(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(this.speed);
  }

  moveUp(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(-this.speed);
  }

  moveDown(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(this.speed);
  }

  stopMoving(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }

  getSpeed(): number {
    return this.speed;
  }
}
