import { useRef, useCallback, useState } from 'react';

export default function useGameLoop(callback) {
  const rafRef = useRef(null);
  const startTimeRef = useRef(0);
  const lastFrameRef = useRef(0);
  const elapsedRef = useRef(0);
  const deltaRef = useRef(0);
  const runningRef = useRef(false);
  const callbackRef = useRef(callback);

  // Keep callback ref current without triggering re-renders
  callbackRef.current = callback;

  const [isRunning, setIsRunning] = useState(false);

  const loop = useCallback((timestamp) => {
    if (!runningRef.current) return;

    if (startTimeRef.current === 0) {
      startTimeRef.current = timestamp;
      lastFrameRef.current = timestamp;
    }

    const elapsed = (timestamp - startTimeRef.current) / 1000;
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
    startTimeRef.current = 0;
    lastFrameRef.current = 0;
    setIsRunning(true);
    rafRef.current = requestAnimationFrame(loop);
  }, [loop]);

  const stop = useCallback(() => {
    runningRef.current = false;
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
  }, [stop]);

  return {
    get elapsed() { return elapsedRef.current; },
    get delta() { return deltaRef.current; },
    start,
    stop,
    reset,
    isRunning,
  };
}
