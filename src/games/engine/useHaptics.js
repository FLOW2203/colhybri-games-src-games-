import { useCallback, useRef } from 'react';

const CAN_VIBRATE = typeof navigator !== 'undefined' && 'vibrate' in navigator;

export default function useHaptics() {
  const enabledRef = useRef(true);

  const vibrate = useCallback((pattern) => {
    if (!enabledRef.current || !CAN_VIBRATE) return;
    try { navigator.vibrate(pattern); } catch {}
  }, []);

  // Light tap feedback - button press, token collect
  const tapFeedback = useCallback(() => vibrate(10), [vibrate]);

  // Medium impact - score, hit, collision
  const impactFeedback = useCallback(() => vibrate(25), [vibrate]);

  // Heavy impact - explosion, game over, new record
  const heavyFeedback = useCallback(() => vibrate(50), [vibrate]);

  // Success pattern - win, achievement
  const successFeedback = useCallback(() => vibrate([20, 60, 20, 60, 40]), [vibrate]);

  // Fail pattern - lose, miss
  const failFeedback = useCallback(() => vibrate([80, 30, 80]), [vibrate]);

  // Heartbeat pulse
  const heartbeatFeedback = useCallback(() => vibrate([15, 80, 25]), [vibrate]);

  // Rapid burst - combo, multiplier
  const comboFeedback = useCallback((count = 3) => {
    const pattern = [];
    for (let i = 0; i < count; i++) {
      pattern.push(8, 30);
    }
    vibrate(pattern);
  }, [vibrate]);

  // Warning - countdown, low time
  const warningFeedback = useCallback(() => vibrate([30, 50, 30]), [vibrate]);

  const setEnabled = useCallback((enabled) => {
    enabledRef.current = enabled;
    if (!enabled && CAN_VIBRATE) navigator.vibrate(0);
  }, []);

  return {
    tapFeedback,
    impactFeedback,
    heavyFeedback,
    successFeedback,
    failFeedback,
    heartbeatFeedback,
    comboFeedback,
    warningFeedback,
    setEnabled,
  };
}
