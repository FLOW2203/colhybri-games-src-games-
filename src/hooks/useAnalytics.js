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

  const trackGameStart = useCallback((gameSlug, locale) => {
    send({
      game_slug: gameSlug,
      action: 'game_start',
      locale,
      created_at: new Date().toISOString(),
    });
  }, []);

  const trackGameComplete = useCallback((gameSlug, score, duration) => {
    send({
      game_slug: gameSlug,
      action: 'game_complete',
      locale: null,
      created_at: new Date().toISOString(),
    });
  }, []);

  const trackGameAbandon = useCallback((gameSlug, elapsed) => {
    send({
      game_slug: gameSlug,
      action: 'game_abandon',
      locale: null,
      created_at: new Date().toISOString(),
    });
  }, []);

  const trackShare = useCallback((gameSlug) => {
    send({
      game_slug: gameSlug,
      action: 'share',
      locale: null,
      created_at: new Date().toISOString(),
    });
  }, []);

  return { trackGameStart, trackGameComplete, trackGameAbandon, trackShare };
}
