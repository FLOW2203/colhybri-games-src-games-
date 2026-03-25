/**
 * Constants — TOUTES les valeurs proviennent de gdd.json.
 * 0 hardcode. Ce fichier est hydraté au boot depuis le GDD.
 */
import type { GDD, GDDJeu, GDDScoringGlobal } from '../types';

class ConstantsManager {
  private gdd: GDD | null = null;

  load(gdd: GDD): void {
    this.gdd = gdd;
  }

  get resolution(): { width: number; height: number } {
    return this.gdd?.resolution ?? { width: 1080, height: 1920 };
  }

  get renderer(): string {
    return this.gdd?.renderer ?? 'WebGL';
  }

  get fallback(): string {
    return this.gdd?.fallback ?? 'Canvas';
  }

  get routeBase(): string {
    return this.gdd?.route_base ?? '/jeux';
  }

  get routeParam(): string {
    return this.gdd?.route_param ?? 'game';
  }

  get scoringGlobal(): GDDScoringGlobal {
    return this.gdd?.scoring_global ?? {
      vies_initiales: 3,
      jauge_solidarite_max: 100,
      bonus_solidarite: 5,
      malus_solidarite: -10,
    };
  }

  get supabaseRef(): string {
    return this.gdd?.supabase_ref ?? 'isuzbpzwxcagtnbosgjl';
  }

  get totalGames(): number {
    return this.gdd?.jeux.length ?? 0;
  }

  get sloganFr(): string {
    return this.gdd?.slogan_fr ?? '';
  }

  getJeu(id: number): GDDJeu | undefined {
    return this.gdd?.jeux.find((j) => j.id === id);
  }

  getJeuBySlug(slug: string): GDDJeu | undefined {
    return this.gdd?.jeux.find((j) => j.slug === slug);
  }

  getAllJeux(): GDDJeu[] {
    return this.gdd?.jeux ?? [];
  }
}

export const Constants = new ConstantsManager();
