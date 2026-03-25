// Types dérivés de gdd.json — source de vérité unique

export interface GDDScoring {
  [key: string]: number;
}

export interface GDDJeu {
  id: number;
  slug: string;
  titre: string;
  genre: string;
  description: string;
  background: string;
  regles_jeu: string[];
  scoring: GDDScoring;
  fait_scientifique: string;
  lecon: string;
  cta_game_over: string;
  assets: string[];
  social: string | null;
  duree_max_seconds: number | null;
  enemy_braise: boolean;
}

export interface GDDScoringGlobal {
  vies_initiales: number;
  jauge_solidarite_max: number;
  bonus_solidarite: number;
  malus_solidarite: number;
}

export interface GDD {
  titre: string;
  version: string;
  resolution: { width: number; height: number; orientation: string };
  renderer: string;
  fallback: string;
  supabase_ref: string;
  route_base: string;
  route_param: string;
  slogan_fr: string;
  slogan_en: string;
  scoring_global: GDDScoringGlobal;
  jeux: GDDJeu[];
}

export interface ManifestAsset {
  key: string;
  file: string;
  type: 'image' | 'spritesheet';
  frameWidth?: number;
  frameHeight?: number;
  frameCount?: number;
}

export interface Manifest {
  version: string;
  base_path: string;
  assets: ManifestAsset[];
}
