/**
 * HubScene — Grille visuelle des 26 mini-jeux COLHYBRI.
 * Style COLHYBRI : fond #0D9488, cartes blanches, hover amber #F59E0B.
 * Mobile-first, touch-friendly (min 44px tap target).
 */
import Phaser from 'phaser';
import { Constants } from '../core/Constants';
import { GameState } from '../core/GameState';
import { EventBus, EVENTS } from '../core/EventBus';
import { getGameSceneKey } from '../GameRouter';
import type { GDDJeu } from '../types';

// Genre → emoji mapping for visual cards
const GENRE_ICONS: Record<string, string> = {
  runner: '🏃',
  puzzle: '🧩',
  tower_defense: '🏰',
  sorting: '♻️',
  pipe_puzzle: '🔧',
  tycoon: '🏪',
  clicker: '🌳',
  delivery: '🚲',
  management: '☕',
  tetris: '🌱',
  strategy: '☀️',
  matching: '🃏',
  pathfinding: '🚗',
  minigame_collection: '🔨',
  economic_sim: '💰',
  cooking: '🥬',
  arcade: '🐝',
  time_management: '🧊',
  builder: '🏠',
  quiz: '📚',
  network: '🤝',
  rhythm: '🎵',
  collection: '🌻',
  simulation: '🚌',
  multiplayer_coop: '🌍',
};

export class HubScene extends Phaser.Scene {
  private scrollY: number = 0;
  private maxScrollY: number = 0;
  private container!: Phaser.GameObjects.Container;
  private isDragging: boolean = false;
  private dragStartY: number = 0;
  private dragStartScrollY: number = 0;

  constructor() {
    super({ key: 'HubScene' });
  }

  create(): void {
    const { width, height } = this.scale;

    // Background — COLHYBRI teal #0D9488
    this.cameras.main.setBackgroundColor('#0D9488');

    // Title bar
    this.add.rectangle(width / 2, 0, width, 160, 0x0a7a70).setOrigin(0.5, 0);
    this.add.text(width / 2, 45, 'COLHYBRI GAMES', {
      fontSize: '52px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      stroke: '#065f56',
      strokeThickness: 3,
    }).setOrigin(0.5);
    this.add.text(width / 2, 110, 'Chaque geste compte. Le vôtre aussi.', {
      fontSize: '24px',
      color: '#a7f3d0',
      fontFamily: 'Arial',
      fontStyle: 'italic',
    }).setOrigin(0.5);

    // Scrollable container for cards
    this.container = this.add.container(0, 160);

    const jeux = Constants.getAllJeux();
    const cols = 4;
    const padding = 20;
    const cardW = (width - padding * (cols + 1)) / cols;
    const cardH = cardW * 1.2;
    const rows = Math.ceil(jeux.length / cols);

    jeux.forEach((jeu: GDDJeu, index: number) => {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const x = padding + col * (cardW + padding) + cardW / 2;
      const y = padding + row * (cardH + padding) + cardH / 2;

      this.createCard(x, y, cardW, cardH, jeu);
    });

    // Calculate scroll bounds
    const totalContentH = padding + rows * (cardH + padding);
    const visibleH = height - 160;
    this.maxScrollY = Math.max(0, totalContentH - visibleH);

    // Touch scroll
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.isDragging = true;
      this.dragStartY = pointer.y;
      this.dragStartScrollY = this.scrollY;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const deltaY = this.dragStartY - pointer.y;
      this.scrollY = Phaser.Math.Clamp(
        this.dragStartScrollY + deltaY, 0, this.maxScrollY
      );
      this.container.y = 160 - this.scrollY;
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    // Mask to hide overflow (GeometryMask requires Graphics, not Rectangle)
    const maskGraphics = this.make.graphics();
    maskGraphics.fillRect(0, 160, width, visibleH);
    this.container.setMask(new Phaser.Display.Masks.GeometryMask(this, maskGraphics));
  }

  private createCard(x: number, y: number, w: number, h: number, jeu: GDDJeu): void {
    const icon = GENRE_ICONS[jeu.genre] ?? '🎮';

    // Card background — white
    const card = this.add.rectangle(x, y, w, h, 0xffffff, 1)
      .setStrokeStyle(2, 0xe5e7eb)
      .setInteractive({ useHandCursor: true });

    // Game number badge
    const badgeBg = this.add.circle(x - w / 2 + 28, y - h / 2 + 28, 20, 0x0D9488);
    const badgeText = this.add.text(x - w / 2 + 28, y - h / 2 + 28, `${jeu.id}`, {
      fontSize: '20px',
      color: '#ffffff',
      fontFamily: 'Arial',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    // Genre icon
    const iconText = this.add.text(x, y - h * 0.15, icon, {
      fontSize: '48px',
    }).setOrigin(0.5);

    // Title
    const title = this.add.text(x, y + h * 0.15, jeu.titre, {
      fontSize: '18px',
      color: '#1f2937',
      fontFamily: 'Arial',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: w - 16 },
    }).setOrigin(0.5);

    // Genre label
    const genre = this.add.text(x, y + h * 0.37, jeu.genre.replace('_', ' '), {
      fontSize: '14px',
      color: '#6b7280',
      fontFamily: 'Arial',
    }).setOrigin(0.5);

    // Add all to container
    this.container.add([card, badgeBg, badgeText, iconText, title, genre]);

    // Hover effects — amber #F59E0B
    card.on('pointerover', () => {
      card.setStrokeStyle(4, 0xF59E0B);
      card.setFillStyle(0xFFFBEB);
    });

    card.on('pointerout', () => {
      card.setStrokeStyle(2, 0xe5e7eb);
      card.setFillStyle(0xffffff);
    });

    // Click → go to game
    card.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      // Store pointer Y to distinguish tap from scroll
      (card as unknown as Record<string, number>)._tapY = pointer.y;
    });

    card.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      const tapY = (card as unknown as Record<string, number>)._tapY ?? pointer.y;
      const dragDist = Math.abs(pointer.y - tapY);

      // Only navigate if this was a tap, not a scroll drag
      if (dragDist < 15) {
        GameState.reset(jeu.id, jeu.slug);
        EventBus.emit(EVENTS.GAME_START, jeu);
        const sceneKey = getGameSceneKey(jeu.slug);
        this.scene.start(sceneKey);
        this.scene.launch('UIScene');
      }
    });
  }
}
