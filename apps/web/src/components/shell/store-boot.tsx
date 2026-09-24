"use client";

import { store } from "@/lib/store";
import { applyTheme, readTheme } from "@/lib/ui";
import { useEffect } from "react";

/** Carrega o estado salvo e o tema no navegador (uma vez, no layout raiz). */
export function StoreBoot() {
  useEffect(() => {
    store.hydrate();
    applyTheme(readTheme());
    const onStorage = (e: StorageEvent) => {
      if (e.key === "ocafy-web-v1") store.hydrate();
    };
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (readTheme() === "auto") applyTheme("auto");
    };
    window.addEventListener("storage", onStorage);
    mq.addEventListener("change", onScheme);
    return () => {
      window.removeEventListener("storage", onStorage);
      mq.removeEventListener("change", onScheme);
    };
  }, []);
  return null;
}
