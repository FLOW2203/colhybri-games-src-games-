import { useRef, useCallback, useState, useEffect } from 'react';

export default function useGameLoop(callback) {
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const elapsedRef = useRef(0);
  const deltaRef = useRef(0);
  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const pauseOffsetRef = useRef(0);
  const callbackRef = useRef(callback);

  // Keep callback ref current without triggering re-renders
  callbackRef.current = callback;

  const [isRunning, setIsRunning] = useState(false);

  const loop = useCallback((timestamp) => {
    if (!runningRef.current || pausedRef.current) return;

    if (startTimeRef.current === 0) {
      startTimeRef.current = timestamp;
      lastFrameRef.current = timestamp;
    }

    const elapsed = (timestamp - startTimeRef.current - pauseOffsetRef.current) / 1000;
    const delta = (timestamp - lastFrameRef.current) / 1000;

    elapsedRef.current = elapsed;
    deltaRef.current = delta;
    lastFrameRef.current = timestamp;

    if (callbackRef.current) {
      callbackRef.current({ elapsed, delta });
    }

    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = useCallback(() => {
    if (runningRef.current) return;
    runningRef.current = true;
    pausedRef.current = false;
    pauseOffsetRef.current = 0;
    startTimeRef.current = 0;
    lastFrameRef.current = 0;
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
    pausedRef.current = false;
    setIsRunning(false);
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stop();
    elapsedRef.current = 0;
    deltaRef.current = 0;
    startTimeRef.current = 0;
    lastFrameRef.current = 0;
    pauseOffsetRef.current = 0;
  }, [stop]);

  // Pause/resume when tab visibility changes
  useEffect(() => {
    let pauseStart = 0;

    function handleVisibility() {
      if (!runningRef.current) return;

      if (document.hidden) {
        pausedRef.current = true;
        pauseStart = performance.now();
        if (rafRef.current !== null) {
          cancelAnimationFrame(rafRef.current);
          rafRef.current = null;
        }
      } else {
        if (pausedRef.current && pauseStart > 0) {
          pauseOffsetRef.current += performance.now() - pauseStart;
        }
        pausedRef.current = false;
        lastFrameRef.current = performance.now();
        rafRef.current = requestAnimationFrame(loop);
      }
    }

    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [loop]);

  return {
    get elapsed() { return elapsedRef.current; },
    get delta() { return deltaRef.current; },
    start,
    stop,
    reset,
    isRunning,
  };
}
