"use client";

import { AnimatedLogo } from "@/components/brand/animated-logo";
import { useEffect, useState } from "react";

/**
 * Abertura do app: logo animada + espera pelos dados. A splash só sai quando
 * a animação terminou E os dados estão prontos (`ready`).
 */
export function Splash({ ready }: { ready: boolean }) {
  const [animated, setAnimated] = useState(false);
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready || !animated) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setOut(true), reduced ? 0 : 250);
    const t2 = setTimeout(() => setGone(true), reduced ? 500 : 900);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready, animated]);

  if (gone) return null;
  return (
    <div className={`splash ${out ? "out" : ""}`} aria-hidden="true">
      <AnimatedLogo size={112} onDone={() => setAnimated(true)} />
    </div>
  );
}
