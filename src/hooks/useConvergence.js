import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';

const FINGERPRINT_KEY = 'colhybri_fingerprint';

// ---------------------------------------------------------------------------
// Fingerprint — stable anonymous UUID per device
// ---------------------------------------------------------------------------

export function getFingerprint() {
  if (typeof window === 'undefined') return 'server';

  try {
    const existing = window.localStorage.getItem(FINGERPRINT_KEY);
    if (existing) return existing;
  } catch {
    // localStorage unavailable — fall through to generate.
  }

  const uuid = crypto.randomUUID();

  try {
    window.localStorage.setItem(FINGERPRINT_KEY, uuid);
  } catch {
    // Storage unavailable — UUID lives only in memory this session.
  }

  return uuid;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nextConvergenceTime() {
  const now = new Date();
  const todayNoon = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12, 0, 0,
  ));
  const todayEvening = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 19, 0, 0,
  ));
  const tomorrowNoon = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1, 12, 0, 0,
  ));

  if (now < todayNoon) return todayNoon;
  if (now < todayEvening) return todayEvening;
  return tomorrowNoon;
}

function isWithinWindow(scheduledAt, windowMinutes = 30) {
  const now = Date.now();
  const start = new Date(scheduledAt).getTime();
  const end = start + windowMinutes * 60 * 1000;
  return now >= start && now <= end;
}

function offlineState() {
  return {
    currentDrops: 0,
    participants: 0,
    isActive: false,
    nextEventAt: nextConvergenceTime().toISOString(),
    contributeDrops: () => {},
  };
}

// ---------------------------------------------------------------------------
// useConvergence hook
// ---------------------------------------------------------------------------

export default function useConvergence() {
  const [currentDrops, setCurrentDrops] = useState(0);
  const [participants, setParticipants] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [nextEventAt, setNextEventAt] = useState(() => nextConvergenceTime().toISOString());
  const subscriptionRef = useRef(null);
  const eventIdRef = useRef(null);

  // Fetch the current (or next upcoming) convergence event.
  useEffect(() => {
    if (!supabase) return;

    let cancelled = false;

    async function fetchCurrentEvent() {
      const now = new Date().toISOString();

      // Look for an active, uncompleted event whose scheduled_at is within the window.
      const { data, error } = await supabase
        .from('convergence_events')
        .select('*')
        .eq('completed', false)
        .lte('scheduled_at', now)
        .order('scheduled_at', { ascending: false })
        .limit(1);

      if (error || cancelled) return;

      if (data && data.length > 0) {
        const event = data[0];
        const active = isWithinWindow(event.scheduled_at);

        eventIdRef.current = event.id;
        setCurrentDrops(event.current_drops);
        setParticipants(event.participants);
        setIsActive(active);
        setNextEventAt(active ? event.scheduled_at : nextConvergenceTime().toISOString());
      } else {
        setIsActive(false);
        setNextEventAt(nextConvergenceTime().toISOString());
      }
    }

    fetchCurrentEvent();

    return () => {
      cancelled = true;
    };
  }, []);

  // Subscribe to realtime changes on convergence_events.
  useEffect(() => {
    if (!supabase) return;

    const channel = supabase
      .channel('convergence-realtime')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'convergence_events' },
        (payload) => {
          const row = payload.new;
          if (eventIdRef.current && row.id === eventIdRef.current) {
            setCurrentDrops(row.current_drops);
            setParticipants(row.participants);

            if (row.completed) {
              setIsActive(false);
              setNextEventAt(nextConvergenceTime().toISOString());
            }
          }
        },
      )
      .subscribe();

    subscriptionRef.current = channel;

    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, []);

  // Periodically update isActive and nextEventAt based on clock.
  useEffect(() => {
    const interval = setInterval(() => {
      setNextEventAt(nextConvergenceTime().toISOString());
    }, 60_000);

    return () => clearInterval(interval);
  }, []);

  const contributeDrops = useCallback(async (n) => {
    if (!supabase || !eventIdRef.current) return;

    const fingerprint = getFingerprint();

    try {
      await supabase.rpc('increment_convergence_drops', {
        p_event_id: eventIdRef.current,
        p_drops: n,
        p_fingerprint: fingerprint,
      });
    } catch {
      // Fire-and-forget — never block the UI.
    }
  }, []);

  if (!supabase) {
    return offlineState();
  }

  return { currentDrops, participants, isActive, nextEventAt, contributeDrops };
}
