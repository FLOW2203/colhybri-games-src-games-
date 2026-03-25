/**
 * Collectible — Goutte, Jeton, Bourgeon et autres objets à collecter.
 * Texture depuis manifest.
 */
import Phaser from 'phaser';

export type CollectibleType = 'goutte' | 'goutte_doree' | 'jeton' | 'bourgeon' | 'custom';

export class Collectible extends Phaser.GameObjects.Sprite {
  public collectibleType: CollectibleType;
  public pointValue: number;
  public solidariteValue: number;

  constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    textureKey: string,
    type: CollectibleType = 'custom',
    pointValue: number = 10,
    solidariteValue: number = 0,
  ) {
    if (!scene.textures.exists(textureKey)) {
      console.warn(`[Collectible] Texture "${textureKey}" not found, using placeholder`);
      const color = type === 'goutte_doree' ? 0xffcc44 : 0x4488ff;
      const placeholderKey = `collectible_${type}_placeholder`;
      if (!scene.textures.exists(placeholderKey)) {
        const gfx = scene.add.graphics();
        gfx.fillStyle(color, 1);
        gfx.fillCircle(24, 24, 20);
        gfx.generateTexture(placeholderKey, 48, 48);
        gfx.destroy();
      }
      textureKey = placeholderKey;
    }

    super(scene, x, y, textureKey);
    this.collectibleType = type;
    this.pointValue = pointValue;
    this.solidariteValue = solidariteValue;

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Floating animation
    scene.tweens.add({
      targets: this,
      y: y - 10,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  collect(): { points: number; solidarite: number } {
    const result = {
      points: this.pointValue,
      solidarite: this.solidariteValue,
    };

    // Pop animation then destroy
    this.scene.tweens.add({
      targets: this,
      scaleX: 1.5,
      scaleY: 1.5,
      alpha: 0,
      duration: 200,
      onComplete: () => this.destroy(),
    });

    return result;
  }
}
