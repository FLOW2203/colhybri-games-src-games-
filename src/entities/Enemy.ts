/**
 * Enemy — Braise Volante (utilisée dans tous les jeux avec enemy_braise=true).
 * Texture depuis manifest.
 */
import Phaser from 'phaser';

export class Enemy extends Phaser.GameObjects.Sprite {
  private speed: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string = 'braise',
    speed: number = 200,
  ) {
    if (!scene.textures.exists(textureKey)) {
      console.warn(`[Enemy] Texture "${textureKey}" not found, using placeholder`);
      if (!scene.textures.exists('enemy_placeholder')) {
        const gfx = scene.add.graphics();
        gfx.fillStyle(0xff4444, 1);
        gfx.fillCircle(32, 32, 28);
        gfx.generateTexture('enemy_placeholder', 64, 64);
        gfx.destroy();
      }
      textureKey = 'enemy_placeholder';
    }

    super(scene, x, y, textureKey);
    this.speed = speed;

    scene.add.existing(this);
    scene.physics.add.existing(this);
  }

  moveToward(targetX: number, targetY: number): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
    body.setVelocity(
      Math.cos(angle) * this.speed,
      Math.sin(angle) * this.speed,
    );
  }

  moveDown(): void {
    const body = this.body as Phaser.Physics.Arcade.Body;
    body.setVelocityY(this.speed);
  }

  setSpeed(speed: number): void {
    this.speed = speed;
  }
}
