import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  durationMs?: number;
}

export const AnimatedCounter = ({ value, durationMs = 600 }: AnimatedCounterProps) => {
  const [displayValue, setDisplayValue] = useState(0);
  const frameRef = useRef<number | null>(null);

  useEffect(() => {
    const start = performance.now();
    const from = displayValue;
    const delta = value - from;

    const step = (now: number) => {
      const progress = Math.min((now - start) / durationMs, 1);
      const next = Math.round(from + delta * progress);
      setDisplayValue(next);
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step);
      }
    };

    frameRef.current = requestAnimationFrame(step);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
      }
    };
  }, [value]);

  return <span>{displayValue.toLocaleString()}</span>;
};
