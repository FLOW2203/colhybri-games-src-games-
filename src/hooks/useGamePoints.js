import { useState, useCallback } from 'react';

const KEYS = {
  points: 'colhybri_points',
  streak: 'colhybri_streak',
  lastPlay: 'colhybri_last_play',
};

function readNumber(key, fallback) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return fallback;
    const num = JSON.parse(raw);
    return typeof num === 'number' && Number.isFinite(num) ? num : fallback;
  } catch {
    return fallback;
  }
}

function readString(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function persist(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable — proceed with in-memory state.
  }
}

function toDateStr(date) {
  return date.toISOString().slice(0, 10);
}

function daysBetween(dateStrA, dateStrB) {
  const a = new Date(dateStrA + 'T00:00:00');
  const b = new Date(dateStrB + 'T00:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function computeStreakBonus(streak) {
  if (streak >= 7) return 75;
  if (streak >= 3) return 25;
  return 0;
}

export default function useGamePoints() {
  const [points, setPoints] = useState(() => readNumber(KEYS.points, 0));
  const [streak, setStreak] = useState(() => readNumber(KEYS.streak, 0));

  const addPoints = useCallback(
    (amount) => {
      const today = toDateStr(new Date());
      const lastPlay = readString(KEYS.lastPlay);

      let newStreak = streak;

      if (lastPlay === today) {
        // Same day — streak unchanged, just add points.
        newStreak = streak;
      } else if (lastPlay && daysBetween(lastPlay, today) === 1) {
        // Played yesterday — extend streak.
        newStreak = streak + 1;
      } else {
        // First play ever or missed a day — reset to 1.
        newStreak = 1;
      }

      const bonus = computeStreakBonus(newStreak);
      const total = amount + bonus;
      const newPoints = points + total;

      persist(KEYS.points, newPoints);
      persist(KEYS.streak, newStreak);
      persist(KEYS.lastPlay, today);

      setPoints(newPoints);
      setStreak(newStreak);
    },
    [points, streak],
  );

  const canRedeem = useCallback(
    (cost) => {
      return points >= cost;
    },
    [points],
  );

  const redeem = useCallback(
    (cost) => {
      if (points < cost) return false;
      const newPoints = points - cost;
      persist(KEYS.points, newPoints);
      setPoints(newPoints);
      return true;
    },
    [points],
  );

  const resetStreak = useCallback(() => {
    persist(KEYS.streak, 0);
    persist(KEYS.lastPlay, null);
    setStreak(0);
  }, []);

  return { points, streak, addPoints, canRedeem, redeem, resetStreak };
}
