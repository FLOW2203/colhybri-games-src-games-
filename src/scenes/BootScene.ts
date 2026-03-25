/**
 * BootScene — Charge gdd.json + manifest.json dynamiquement.
 * Passe le GDD au Constants manager, puis redirige vers HubScene.
 * Les assets des jeux sont chargés à la demande (pas au boot).
 */
import Phaser from 'phaser';
import { Constants } from '../core/Constants';
import type { GDD, Manifest } from '../types';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    const { width, height } = this.scale;

    // Progress bar
    const barW = width * 0.6;
    const barH = 40;
    const barY = height / 2;

    const bg = this.add.rectangle(width / 2, barY, barW, barH, 0x333333);
    const fill = this.add.rectangle(width / 2 - barW / 2 + 2, barY, 0, barH - 4, 0x44cc88);
    fill.setOrigin(0, 0.5);

    const label = this.add.text(width / 2, barY - 50, 'Chargement...', {
      fontSize: '28px',
      color: '#ffffff',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    this.load.on('progress', (value: number) => {
      fill.width = (barW - 4) * value;
    });

    this.load.on('complete', () => {
      bg.destroy();
      fill.destroy();
      label.destroy();
    });

    // Load JSON sources — use import.meta.env.BASE_URL for correct path
    const base = import.meta.env.BASE_URL ?? '/';
    this.load.json('gdd', `${base}assets/gdd.json`);
    this.load.json('manifest', `${base}assets/manifest.json`);
  }

  create(): void {
    const gdd = this.cache.json.get('gdd') as GDD | null;
    const manifest = this.cache.json.get('manifest') as Manifest | null;

    if (!gdd) {
      console.error('[BootScene] gdd.json failed to load');
      // Show error on screen
      const { width, height } = this.scale;
      this.add.text(width / 2, height / 2, 'Erreur : gdd.json introuvable', {
        fontSize: '32px', color: '#ff4444', fontFamily: 'Arial',
      }).setOrigin(0.5);
      return;
    }

    // Hydrate Constants from GDD
    Constants.load(gdd);

    // Store manifest in cache for later use by game scenes
    if (manifest) {
      this.cache.json.add('manifest_data', manifest);
    }

    // Go to HubScene
    this.scene.start('HubScene');
  }
}
