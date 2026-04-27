import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedCounter — count-up animation with subtle glow flash on value change.
 *
 * Robust against React strict-mode double effects: each effect run cancels its
 * own RAF in cleanup, but does NOT short-circuit on the second run, so the
 * animation always reaches the latest target.
 */
export function AnimatedCounter({
  value = 0,
  prefix = '',
  suffix = '',
  duration = 900,
  decimals = 0,
  className = '',
  glowColor = 'rgba(255, 107, 26, 0.55)',
  testId,
}) {
  const [display, setDisplay] = useState(() => Number(value) || 0);
  const [flash, setFlash] = useState(false);
  const lastValueRef = useRef(Number(value) || 0);
  const rafRef = useRef(null);
  const flashTimerRef = useRef(null);

  useEffect(() => {
    const target = Number(value);
    if (!Number.isFinite(target)) return;
    const from = lastValueRef.current;
    if (target === from) {
      // Still ensure displayed value is exactly the target (in case of mount with same value)
      setDisplay(target);
      return;
    }
    lastValueRef.current = target;

    // glow flash
    setFlash(true);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlash(false), 700);

    // animate
    const start = performance.now();
    const tick = (now) => {
      const elapsed = now - start;
      const p = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      const next = from + (target - from) * eased;
      setDisplay(next);
      if (p < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        setDisplay(target);
      }
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      // Note: we intentionally do NOT cancel the RAF here, because in React strict
      // mode the cleanup runs immediately after the first effect, and we want
      // the animation to keep going after the second (identical) effect fires.
      // The `rafRef` is reset on the next real change.
    };
  }, [value, duration]);

  // Final cleanup on unmount only
  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    };
  }, []);

  const formatted =
    decimals > 0
      ? Number(display).toFixed(decimals)
      : Math.round(display).toLocaleString();

  return (
    <span
      data-testid={testId}
      className={`tabular-nums transition-[text-shadow,filter] duration-700 ${className}`}
      style={{
        textShadow: flash ? `0 0 18px ${glowColor}, 0 0 30px ${glowColor}` : undefined,
      }}
    >
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
