/**
 * SupabaseClient — ref isuzbpzwxcagtnbosgjl UNIQUEMENT.
 * JAMAIS utiliser l'ancienne ref obsolète.
 */
import { createClient, SupabaseClient as SBClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://isuzbpzwxcagtnbosgjl.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

let client: SBClient | null = null;

function getClient(): SBClient {
  if (!client) {
    if (!SUPABASE_ANON_KEY) {
      console.warn('[SupabaseClient] VITE_SUPABASE_ANON_KEY not set — Supabase disabled');
    }
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

/** Save score to game_scores table */
export async function saveScore(
  gameId: number,
  score: number,
  slug: string,
): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase.from('game_scores').insert({
      game_id: gameId,
      score,
      slug,
      played_at: new Date().toISOString(),
    });
    if (error) console.error('[Supabase] saveScore error:', error.message);
  } catch (err) {
    console.error('[Supabase] saveScore failed:', err);
  }
}

/** Sync solidarity points to colibri_points table */
export async function syncSolidarite(
  gameId: number,
  points: number,
  slug: string,
): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase.from('colibri_points').insert({
      game_id: gameId,
      points,
      slug,
      created_at: new Date().toISOString(),
    });
    if (error) console.error('[Supabase] syncSolidarite error:', error.message);
  } catch (err) {
    console.error('[Supabase] syncSolidarite failed:', err);
  }
}

/** Log convergence events for Zone de Convergence */
export async function logConvergenceEvent(
  contribution: number,
  palier: string,
): Promise<void> {
  try {
    const supabase = getClient();
    const { error } = await supabase.from('convergence_events').insert({
      contribution,
      palier,
      created_at: new Date().toISOString(),
    });
    if (error) console.error('[Supabase] logConvergence error:', error.message);
  } catch (err) {
    console.error('[Supabase] logConvergence failed:', err);
  }
}
