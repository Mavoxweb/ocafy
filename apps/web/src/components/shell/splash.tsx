"use client";

import { OcafySymbol } from "@/components/ui/logo";
import { useEffect, useState } from "react";

export function Splash({ ready }: { ready: boolean }) {
  const [out, setOut] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => {
    if (!ready) return;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const t1 = setTimeout(() => setOut(true), reduced ? 200 : 1000);
    const t2 = setTimeout(() => setGone(true), reduced ? 700 : 1500);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [ready]);

  if (gone) return null;
  return (
    <div className={`splash ${out ? "out" : ""}`} aria-hidden="true">
      <div className="sp-in">
        <OcafySymbol size={92} />
        <div className="owm" style={{ fontSize: 46, marginTop: 14 }}>
          ocafy
        </div>
        <div className="mt-2 text-base font-semibold text-muted">
          Deixa a casa ok.
        </div>
      </div>
    </div>
  );
}
