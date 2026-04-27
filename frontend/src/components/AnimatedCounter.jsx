import { useEffect, useRef, useState } from 'react';

/**
 * AnimatedCounter — count-up animation with subtle glow flash on value change.
 *
 * @param {number} value     target value
 * @param {string} prefix    text before number (e.g. "$")
 * @param {string} suffix    text after number
 * @param {number} duration  ms for animation
 * @param {number} decimals  decimals to render
 * @param {string} className extra classes
 * @param {string} glowColor css color for the flash glow
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
  const [display, setDisplay] = useState(0);
  const [flash, setFlash] = useState(false);
  const fromRef = useRef(0);
  const startRef = useRef(0);
  const rafRef = useRef(null);
  const lastTargetRef = useRef(0);

  useEffect(() => {
    const target = Number(value) || 0;
    if (target === lastTargetRef.current) return;
    fromRef.current = display;
    startRef.current = performance.now();
    lastTargetRef.current = target;

    // glow flash on update (skip on first mount when display=0 and target=0)
    if (target !== fromRef.current) {
      setFlash(true);
      const t = setTimeout(() => setFlash(false), 700);
      // continue
      const tick = (now) => {
        const elapsed = now - startRef.current;
        const p = Math.min(1, elapsed / duration);
        // easeOutCubic
        const eased = 1 - Math.pow(1 - p, 3);
        const next = fromRef.current + (target - fromRef.current) * eased;
        setDisplay(next);
        if (p < 1) {
          rafRef.current = requestAnimationFrame(tick);
        } else {
          setDisplay(target);
        }
      };
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(tick);
      return () => {
        clearTimeout(t);
        cancelAnimationFrame(rafRef.current);
      };
    }
    setDisplay(target);
    return undefined;
  }, [value, duration]);

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
