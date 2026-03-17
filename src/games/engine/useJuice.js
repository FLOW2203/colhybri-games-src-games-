import { useRef, useCallback } from 'react';

/**
 * Screen shake + Canvas glow/bloom post-processing utilities.
 * Usage:
 *   const juice = useJuice();
 *   // Trigger shake: juice.shake(intensity, duration)
 *   // In draw loop: juice.applyShake(ctx), draw(), juice.applyGlow(ctx), juice.update(delta)
 */
export default function useJuice() {
  const shakeRef = useRef({ x: 0, y: 0, intensity: 0, duration: 0, elapsed: 0 });
  const flashRef = useRef({ alpha: 0, color: '#FFFFFF', decay: 4 });

  // --- SCREEN SHAKE ---
  const shake = useCallback((intensity = 8, duration = 0.3) => {
    shakeRef.current.intensity = intensity;
    shakeRef.current.duration = duration;
    shakeRef.current.elapsed = 0;
  }, []);

  // Apply shake transform BEFORE drawing — call ctx.save() first
  const applyShake = useCallback((ctx) => {
    const s = shakeRef.current;
    if (s.elapsed < s.duration && s.intensity > 0) {
      const progress = s.elapsed / s.duration;
      const decay = 1 - progress;
      const amp = s.intensity * decay;
      s.x = (Math.random() * 2 - 1) * amp;
      s.y = (Math.random() * 2 - 1) * amp;
      ctx.translate(s.x, s.y);
    }
  }, []);

  // --- SCREEN FLASH ---
  const flash = useCallback((color = '#FFFFFF', alpha = 0.6) => {
    flashRef.current.alpha = alpha;
    flashRef.current.color = color;
  }, []);

  const drawFlash = useCallback((ctx, w, h) => {
    const f = flashRef.current;
    if (f.alpha > 0.01) {
      ctx.globalAlpha = f.alpha;
      ctx.fillStyle = f.color;
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
  }, []);

  // --- GLOW / BLOOM POST-PROCESSING ---
  // Draw a radial glow around a point
  const drawGlow = useCallback((ctx, x, y, radius, color, alpha = 0.4) => {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    grad.addColorStop(0, color);
    grad.addColorStop(0.4, color + '80');
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, []);

  // Full-screen bloom overlay (additive blend of bright areas)
  const applyBloom = useCallback((ctx, w, h, intensity = 0.15) => {
    if (intensity <= 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = intensity;
    ctx.filter = `blur(${Math.round(8 * intensity)}px)`;
    ctx.drawImage(ctx.canvas, 0, 0, w, h);
    ctx.filter = 'none';
    ctx.restore();
  }, []);

  // Neon text with glow
  const drawNeonText = useCallback((ctx, text, x, y, color, fontSize = 24) => {
    ctx.save();
    ctx.font = `bold ${fontSize}px 'Outfit', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Outer glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 20;
    ctx.fillStyle = color;
    ctx.fillText(text, x, y);
    // Inner bright
    ctx.shadowBlur = 10;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(text, x, y);
    ctx.restore();
  }, []);

  // Animated trail / motion line
  const drawTrail = useCallback((ctx, points, color, lineWidth = 3) => {
    if (points.length < 2) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < points.length; i++) {
      const alpha = i / points.length;
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth * alpha;
      ctx.beginPath();
      ctx.moveTo(points[i - 1].x, points[i - 1].y);
      ctx.lineTo(points[i].x, points[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }, []);

  // --- UPDATE (call every frame) ---
  const update = useCallback((delta) => {
    // Update shake
    const s = shakeRef.current;
    if (s.elapsed < s.duration) {
      s.elapsed += delta;
    } else {
      s.x = 0;
      s.y = 0;
      s.intensity = 0;
    }
    // Update flash
    const f = flashRef.current;
    if (f.alpha > 0) {
      f.alpha -= f.decay * delta;
      if (f.alpha < 0) f.alpha = 0;
    }
  }, []);

  return {
    shake,
    applyShake,
    flash,
    drawFlash,
    drawGlow,
    applyBloom,
    drawNeonText,
    drawTrail,
    update,
  };
}
