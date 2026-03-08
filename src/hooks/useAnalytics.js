import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

const QUEUE_KEY = 'colhybri_analytics_queue';

// ---------------------------------------------------------------------------
// Offline queue helpers
// ---------------------------------------------------------------------------

function readQueue() {
  try {
    const raw = window.localStorage.getItem(QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeQueue(queue) {
  try {
    window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch {
    // Storage full or unavailable — drop silently.
  }
}

function enqueue(event) {
  const queue = readQueue();
  queue.push(event);
  writeQueue(queue);
}

async function flushQueue() {
  if (!supabase) return;

  const queue = readQueue();
  if (queue.length === 0) return;

  // Clear immediately so concurrent flushes don't duplicate.
  writeQueue([]);

  const { error } = await supabase.from('game_analytics').insert(queue);

  if (error) {
    // Re-enqueue failed events so they can be retried later.
    const current = readQueue();
    writeQueue([...queue, ...current]);
  }
}

// ---------------------------------------------------------------------------
// Fire-and-forget send — queues offline, flushes when online.
// ---------------------------------------------------------------------------

function send(event) {
  if (!supabase) return;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    enqueue(event);
    return;
  }

  supabase
    .from('game_analytics')
    .insert(event)
    .then(({ error }) => {
      if (error) {
        enqueue(event);
      }
    })
    .catch(() => {
      enqueue(event);
    });
}

// ---------------------------------------------------------------------------
// useAnalytics hook
// ---------------------------------------------------------------------------

export default function useAnalytics() {
  const flushing = useRef(false);

  // Flush queued events when the browser comes back online.
  useEffect(() => {
    function handleOnline() {
      if (flushing.current) return;
      flushing.current = true;
      flushQueue().finally(() => {
        flushing.current = false;
      });
    }

    window.addEventListener('online', handleOnline);

    // Also attempt a flush on mount in case there are stale events.
    handleOnline();

    return () => window.removeEventListener('online', handleOnline);
  }, []);

  const trackGameStart = useCallback((gameId, locale) => {
    send({
      game_id: gameId,
      event: 'game_start',
      locale,
      created_at: new Date().toISOString(),
    });
  }, []);

  const trackGameComplete = useCallback((gameId, score, duration) => {
    send({
      game_id: gameId,
      event: 'game_complete',
      score,
      duration_seconds: Math.round(duration),
      created_at: new Date().toISOString(),
    });
  }, []);

  const trackGameAbandon = useCallback((gameId, elapsed) => {
    send({
      game_id: gameId,
      event: 'game_abandon',
      duration_seconds: Math.round(elapsed),
      created_at: new Date().toISOString(),
    });
  }, []);

  const trackShare = useCallback((gameId) => {
    send({
      game_id: gameId,
      event: 'share',
      created_at: new Date().toISOString(),
    });
  }, []);

  return { trackGameStart, trackGameComplete, trackGameAbandon, trackShare };
}
