// ---------------------------------------------------------------------------
// COLHYBRI GAMES — useGameScore
// Persist scores to Supabase game_scores + game_progress tables.
// Uses the submit_game_score RPC for atomic insert + progress update.
// Graceful degradation: if Supabase unavailable, scores stay in localStorage.
// ---------------------------------------------------------------------------

import { useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Offline queue — persists failed submissions for retry
const QUEUE_KEY = 'colhybri_score_queue';

function readQueue() {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function writeQueue(queue) {
  try { localStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch {}
}

function enqueue(payload) {
  const q = readQueue();
  q.push(payload);
  if (q.length > 50) q.shift(); // cap queue size
  writeQueue(q);
}

async function flushQueue() {
  if (!supabase) return;
  const queue = readQueue();
  if (!queue.length) return;
  writeQueue([]);

  const failed = [];
  for (const p of queue) {
    const { error } = await supabase.rpc('submit_game_score', p);
    if (error) failed.push(p);
  }
  if (failed.length) writeQueue([...failed, ...readQueue()]);
}

/**
 * Hook for submitting scores and fetching leaderboards.
 * Game slug is passed at call time so a single hook instance
 * works across all 26 games in App.jsx.
 */
export default function useGameScore() {
  const [submitting, setSubmitting] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const flushing = useRef(false);

  // Flush offline queue on mount
  if (!flushing.current && supabase) {
    flushing.current = true;
    flushQueue().finally(() => { flushing.current = false; });
  }

  /**
   * Submit a score to Supabase via RPC.
   * Works for both authenticated users (full progress tracking)
   * and anonymous users (score row only, rank returned).
   */
  const submitScore = useCallback(
    async (gameSlug, score, durationSeconds = null, metadata = {}) => {
      if (!supabase) return null;

      const payload = {
        p_game_slug: gameSlug,
        p_score: score,
        p_duration: durationSeconds,
        p_metadata: metadata,
      };

      // Offline? Queue for later.
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        enqueue(payload);
        return null;
      }

      setSubmitting(true);
      try {
        const { data, error } = await supabase.rpc('submit_game_score', payload);

        if (error) {
          console.warn('[useGameScore] submit error:', error.message);
          enqueue(payload);
          return null;
        }

        setLastResult(data);
        return data;
      } catch (err) {
        console.warn('[useGameScore] network error:', err);
        enqueue(payload);
        return null;
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  /**
   * Fetch leaderboard for a specific game (or all games).
   * Queries game_scores directly, aggregating best score per user/fingerprint.
   */
  const getLeaderboard = useCallback(
    async (gameSlug = null, limit = 50) => {
      if (!supabase) return [];

      try {
        let query = supabase
          .from('game_scores')
          .select('user_id, game_slug, score, created_at')
          .order('score', { ascending: false })
          .limit(limit);

        if (gameSlug && gameSlug !== 'all') {
          query = query.eq('game_slug', gameSlug);
        }

        const { data, error } = await query;

        if (error) {
          console.warn('[useGameScore] leaderboard error:', error.message);
          return [];
        }

        // Deduplicate: keep best score per user_id per game
        const best = new Map();
        for (const row of data || []) {
          const key = `${row.user_id || 'anon'}_${row.game_slug}`;
          const existing = best.get(key);
          if (!existing || row.score > existing.score) {
            best.set(key, row);
          }
        }

        // Sort by score descending and add rank
        const sorted = [...best.values()]
          .sort((a, b) => b.score - a.score)
          .map((entry, i) => ({ ...entry, rank: i + 1 }));

        return sorted;
      } catch {
        return [];
      }
    },
    [],
  );

  /**
   * Fetch user's game progress (authenticated only).
   */
  const getProgress = useCallback(async () => {
    if (!supabase) return null;

    try {
      const { data, error } = await supabase
        .from('game_progress')
        .select('*')
        .limit(1)
        .single();

      if (error) return null;
      return data;
    } catch {
      return null;
    }
  }, []);

  /**
   * Fetch recent scores for the current user.
   */
  const getRecentScores = useCallback(async (limit = 10) => {
    if (!supabase) return [];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('game_scores')
        .select('game_slug, score, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return [];
      return data || [];
    } catch {
      return [];
    }
  }, []);

  /**
   * Update streak days in game_progress (authenticated only).
   */
  const updateStreak = useCallback(async (streakDays) => {
    if (!supabase) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('game_progress')
        .update({ streak_days: streakDays, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);
    } catch {}
  }, []);

  return {
    submitScore,
    getLeaderboard,
    getProgress,
    getRecentScores,
    updateStreak,
    submitting,
    lastResult,
  };
}
