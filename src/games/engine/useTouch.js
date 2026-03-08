import { useEffect, useRef } from 'react';

const HOLD_THRESHOLD = 300;
const SWIPE_THRESHOLD = 30;
const DOUBLE_TAP_THRESHOLD = 300;

export default function useTouch(elementRef, config = {}) {
  const {
    onTap,
    onDoubleTap,
    onHoldStart,
    onHoldEnd,
    onSwipe,
    onDrag,
  } = config;

  const stateRef = useRef({
    isDown: false,
    startX: 0,
    startY: 0,
    lastX: 0,
    lastY: 0,
    holdTimer: null,
    isHolding: false,
    lastTapTime: 0,
    hasMoved: false,
  });

  useEffect(() => {
    const el = elementRef.current;
    if (!el) return;

    const state = stateRef.current;

    function handlePointerDown(e) {
      e.preventDefault();
      state.isDown = true;
      state.startX = e.clientX;
      state.startY = e.clientY;
      state.lastX = e.clientX;
      state.lastY = e.clientY;
      state.hasMoved = false;
      state.isHolding = false;

      // Set up hold detection
      if (state.holdTimer) clearTimeout(state.holdTimer);
      state.holdTimer = setTimeout(() => {
        if (state.isDown && !state.hasMoved) {
          state.isHolding = true;
          if (onHoldStart) onHoldStart({ x: state.startX, y: state.startY });
        }
      }, HOLD_THRESHOLD);

      el.setPointerCapture(e.pointerId);
    }

    function handlePointerMove(e) {
      e.preventDefault();
      if (!state.isDown) return;

      const dx = e.clientX - state.lastX;
      const dy = e.clientY - state.lastY;
      const totalDx = e.clientX - state.startX;
      const totalDy = e.clientY - state.startY;

      if (Math.abs(totalDx) > 5 || Math.abs(totalDy) > 5) {
        state.hasMoved = true;
      }

      state.lastX = e.clientX;
      state.lastY = e.clientY;

      if (state.hasMoved && onDrag) {
        onDrag({ x: e.clientX, y: e.clientY, dx, dy });
      }
    }

    function handlePointerUp(e) {
      e.preventDefault();
      if (!state.isDown) return;
      state.isDown = false;

      if (state.holdTimer) {
        clearTimeout(state.holdTimer);
        state.holdTimer = null;
      }

      if (state.isHolding) {
        state.isHolding = false;
        if (onHoldEnd) onHoldEnd({ x: e.clientX, y: e.clientY });
        return;
      }

      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Swipe detection
      if (absDx > SWIPE_THRESHOLD || absDy > SWIPE_THRESHOLD) {
        if (onSwipe) {
          let direction;
          if (absDx > absDy) {
            direction = dx > 0 ? 'right' : 'left';
          } else {
            direction = dy > 0 ? 'down' : 'up';
          }
          onSwipe(direction);
        }
        return;
      }

      // Tap / double tap detection (only if no significant movement)
      if (!state.hasMoved) {
        const now = Date.now();
        const timeSinceLastTap = now - state.lastTapTime;

        if (timeSinceLastTap < DOUBLE_TAP_THRESHOLD && onDoubleTap) {
          onDoubleTap({ x: e.clientX, y: e.clientY });
          state.lastTapTime = 0;
        } else {
          state.lastTapTime = now;
          if (onTap) onTap({ x: e.clientX, y: e.clientY });
        }
      }
    }

    function handlePointerCancel(e) {
      e.preventDefault();
      if (state.holdTimer) {
        clearTimeout(state.holdTimer);
        state.holdTimer = null;
      }
      if (state.isHolding) {
        state.isHolding = false;
        if (onHoldEnd) onHoldEnd({ x: e.clientX, y: e.clientY });
      }
      state.isDown = false;
    }

    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', handlePointerDown, { passive: false });
    el.addEventListener('pointermove', handlePointerMove, { passive: false });
    el.addEventListener('pointerup', handlePointerUp, { passive: false });
    el.addEventListener('pointercancel', handlePointerCancel, { passive: false });

    return () => {
      if (state.holdTimer) clearTimeout(state.holdTimer);
      el.removeEventListener('pointerdown', handlePointerDown);
      el.removeEventListener('pointermove', handlePointerMove);
      el.removeEventListener('pointerup', handlePointerUp);
      el.removeEventListener('pointercancel', handlePointerCancel);
    };
  }, [elementRef, onTap, onDoubleTap, onHoldStart, onHoldEnd, onSwipe, onDrag]);
}
