"use client";

import { initCanvasResize, registerCanvas, useBanner } from "@/lib/fx";
import { dismissToast, useToast } from "@/lib/ui";
import { useEffect, useRef } from "react";

export function FxLayer() {
  const ref = useRef<HTMLCanvasElement>(null);
  const banner = useBanner();

  useEffect(() => {
    registerCanvas(ref.current);
    const off = initCanvasResize();
    return () => {
      off();
      registerCanvas(null);
    };
  }, []);

  return (
    <>
      <canvas
        ref={ref}
        aria-hidden="true"
        tabIndex={-1}
        className="pointer-events-none fixed inset-0 z-[59] h-full w-full"
      />
      <output className={`banner ${banner.on ? "on" : ""}`} aria-live="polite">
        {banner.current && (
          <>
            <div className="bi">{banner.current.icon}</div>
            <b>{banner.current.title}</b>
            <span>{banner.current.sub}</span>
          </>
        )}
      </output>
    </>
  );
}

export function ToastHost() {
  const t = useToast();
  return (
    <output className={`toast ${t.on ? "on" : ""}`} aria-live="polite">
      <span>{t.msg}</span>
      {t.undo && (
        <button
          type="button"
          onClick={() => {
            t.undo?.();
            dismissToast();
          }}
        >
          Desfazer
        </button>
      )}
    </output>
  );
}
