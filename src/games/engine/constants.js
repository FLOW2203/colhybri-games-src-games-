export const COLORS = {
  primary: '#0A0F1C',
  surface: '#111827',
  mint: '#2EEAA3',
  gold: '#F5A623',
  magenta: '#E91E8C',
  cyan: '#00D4FF',
  fire: '#FF4500',
  water: '#00BFFF',
  white: '#FFFFFF',
  gray: '#9CA3AF',
  red: '#EF4444',
  green: '#22C55E',
  // COLHYBRI Brand Palette
  teal: '#0D9488',
  amber: '#F59E0B',
  sky: '#0EA5E9',
  emerald: '#10B981',
  colhybriTeal: '#0D9488',
  colhybriTealLight: '#14B8A6',
  colhybriGold: '#D97706',
  sunsetOrange: '#F97316',
  sunsetMagenta: '#DB2777',
  navy: '#1B2A4A',
  cream: '#FEF7ED',
  dark: '#0F172A',
};

export const GAMES = [
  { id: 1,  name: 'Heartbeat Rush',              emoji: '💓', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Rhythm',          duration: 30, pointsBase: 10, pointsBonus: 5,  priority: 'P1', social: 'Solo' },
  { id: 2,  name: 'Torpeur',                      emoji: '❄️', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Puzzle',          duration: 45, pointsBase: 12, pointsBonus: 6,  priority: 'P1', social: 'Solo' },
  { id: 3,  name: 'Reverse Flight',               emoji: '🔄', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Dive & Dodge',    duration: 30, pointsBase: 10, pointsBonus: 5,  priority: 'P2', social: 'Solo' },
  { id: 4,  name: '800km La Traversée',           emoji: '🌊', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Endurance',       duration: 60, pointsBase: 20, pointsBonus: 10, priority: 'P1', social: 'Défi Ami' },
  { id: 5,  name: 'Wing Beat Challenge',           emoji: '⚡', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Tap Frenzy',      duration: 15, pointsBase: 8,  pointsBonus: 4,  priority: 'P1', social: 'Défi Ami' },
  { id: 6,  name: '300 Cheeseburgers',             emoji: '🍔', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Speed Run',       duration: 15, pointsBase: 8,  pointsBonus: 4,  priority: 'P2', social: 'Défi Ami' },
  { id: 7,  name: 'Super Brain',                   emoji: '🧠', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Memory',          duration: 60, pointsBase: 15, pointsBonus: 8,  priority: 'P3', social: 'Solo' },
  { id: 8,  name: 'Timbre Express',                emoji: '📮', animal: 'Colibri',     chapter: 'Ch.1',  genre: 'Puzzle',          duration: 30, pointsBase: 10, pointsBonus: 5,  priority: 'P3', social: 'Solo' },
  { id: 9,  name: 'Don Bec-à-Bec',                emoji: '🤝', animal: 'Perroquet',   chapter: 'Ch.2',  genre: 'Coopératif',      duration: 30, pointsBase: 12, pointsBonus: 6,  priority: 'P1', social: 'Coopératif' },
  { id: 10, name: 'Transformation Arc-en-ciel',    emoji: '🌈', animal: 'Perroquet',   chapter: 'Ch.2',  genre: 'Dive & Dodge',    duration: 45, pointsBase: 15, pointsBonus: 8,  priority: 'P1', social: 'Solo' },
  { id: 11, name: 'Zéro Jalousie',                emoji: '🙅', animal: 'Perroquet',   chapter: 'Ch.2',  genre: 'Puzzle',          duration: 45, pointsBase: 12, pointsBonus: 6,  priority: 'P2', social: 'Solo' },
  { id: 12, name: 'Le Perroquet Comprend',          emoji: '🧠', animal: 'Perroquet',   chapter: 'Ch.2',  genre: 'Puzzle',          duration: 30, pointsBase: 10, pointsBonus: 5,  priority: 'P2', social: 'Solo' },
  { id: 13, name: '10 sur 10',                     emoji: '💔', animal: 'Perroquet',   chapter: 'Ch.2',  genre: 'Tap Frenzy',      duration: 15, pointsBase: 8,  pointsBonus: 4,  priority: 'P1', social: 'Défi Ami' },
  { id: 14, name: 'Plongeon Sacré',               emoji: '💧', animal: 'Perroquet',   chapter: 'Ch.2',  genre: 'Dive & Dodge',    duration: 45, pointsBase: 15, pointsBonus: 8,  priority: 'P1', social: 'Solo' },
  { id: 15, name: 'Semi-Cercle',                   emoji: '⏺', animal: 'Pélican',    chapter: 'Ch.5',  genre: 'Coopératif',      duration: 45, pointsBase: 15, pointsBonus: 8,  priority: 'P1', social: 'Zone de Convergence' },
  { id: 16, name: 'Signal Domino',                 emoji: '⚡', animal: 'Pélican',    chapter: 'Ch.5',  genre: 'Rhythm',          duration: 30, pointsBase: 12, pointsBonus: 6,  priority: 'P1', social: 'Solo' },
  { id: 17, name: '11 Litres',                     emoji: '🪣', animal: 'Pélican',    chapter: 'Ch.5',  genre: 'Speed Run',       duration: 15, pointsBase: 8,  pointsBonus: 4,  priority: 'P2', social: 'Solo' },
  { id: 18, name: 'École des Pélicans',            emoji: '🎓', animal: 'Pélican',    chapter: 'Ch.5',  genre: 'Memory',          duration: 45, pointsBase: 12, pointsBonus: 6,  priority: 'P3', social: 'Solo' },
  { id: 19, name: 'Lancer de Fruits',              emoji: '🍌', animal: 'Toucan',     chapter: 'Ch.3',  genre: 'Speed Run',       duration: 15, pointsBase: 8,  pointsBonus: 4,  priority: 'P1', social: 'Défi Ami' },
  { id: 20, name: 'Dortoir à 6',                  emoji: '🌳', animal: 'Toucan',     chapter: 'Ch.3',  genre: 'Builder',         duration: 45, pointsBase: 12, pointsBonus: 6,  priority: 'P2', social: 'Coopératif' },
  { id: 21, name: 'Helpers at the Nest',            emoji: '🤝', animal: 'Toucan',     chapter: 'Ch.3',  genre: 'Coopératif',      duration: 45, pointsBase: 12, pointsBonus: 6,  priority: 'P2', social: 'Coopératif' },
  { id: 22, name: 'Super Disperseur',              emoji: '🌱', animal: 'Toucan',     chapter: 'Ch.3',  genre: 'Speed Run',       duration: 30, pointsBase: 10, pointsBonus: 5,  priority: 'P2', social: 'Solo' },
  { id: 23, name: 'Radiateur Naturel',             emoji: '🌡️', animal: 'Toucan',     chapter: 'Bonus', genre: 'Puzzle',          duration: 45, pointsBase: 12, pointsBonus: 6,  priority: 'P3', social: 'Solo' },
  { id: 24, name: 'Nid de Dukdukdiya',             emoji: '🏗️', animal: 'Dukdukdiya', chapter: 'Ch.4',  genre: 'Builder',         duration: 45, pointsBase: 15, pointsBonus: 8,  priority: 'P1', social: 'Solo' },
  { id: 25, name: 'Bouclier de Heigig',            emoji: '🛡️', animal: 'Heigig',     chapter: 'Ch.3',  genre: 'Tower Defense',   duration: 40, pointsBase: 15, pointsBonus: 8,  priority: 'P1', social: 'Solo' },
  { id: 26, name: "L'Éveilleur",                   emoji: '🐦', animal: 'Pélican',    chapter: 'Ch.5',  genre: 'Tap Frenzy',      duration: 30, pointsBase: 20, pointsBonus: 10, priority: 'P1', social: 'Zone de Convergence' },
];

export const REWARDS = {
  perGame: 10,
  streak3: 25,
  streak7: 75,
  convergence: 25,
  dailyBonus: 15,
};

export const CONVERGENCE_TIMES = {
  morning: '12:00',
  evening: '19:00',
  durationMinutes: 30,
};

export const CHAPTERS = ['Ch.1', 'Ch.2', 'Ch.3', 'Ch.4', 'Ch.5', 'Bonus'];
