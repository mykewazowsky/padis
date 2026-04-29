"use client";
import { useEffect, useRef, useState } from "react";
import { useInView } from "@/hooks/useInView";

type Props = {
  to: number;
  duration?: number;
  className?: string;
};

export default function CountUp({ to, duration = 800, className }: Props) {
  const { ref, inView } = useInView<HTMLSpanElement>();
  const started = useRef(false);
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!inView || started.current) return;
    started.current = true;
    const startTime = performance.now();
    function tick(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * to));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }, [inView, to, duration]);

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  );
}
