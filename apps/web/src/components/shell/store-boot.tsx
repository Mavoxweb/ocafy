"use client";

import { startSync } from "@/lib/sync";
import { applyTheme, readTheme } from "@/lib/ui";
import { useEffect } from "react";

/** Liga o tema e a sincronização com o servidor (uma vez, no layout raiz). */
export function StoreBoot() {
  useEffect(() => {
    applyTheme(readTheme());
    // Nas telas de login não há sessão: evita um 401 inútil na abertura.
    const onAuthPage = [
      "/entrar",
      "/cadastro",
      "/esqueci-senha",
      "/redefinir-senha",
    ].includes(location.pathname);
    const stopSync = startSync({ initial: !onAuthPage });
    // Service worker (avisos push): registra em segundo plano, sem cache de páginas.
    if (!onAuthPage && "serviceWorker" in navigator)
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const onScheme = () => {
      if (readTheme() === "auto") applyTheme("auto");
    };
    mq.addEventListener("change", onScheme);
    return () => {
      stopSync();
      mq.removeEventListener("change", onScheme);
    };
  }, []);
  return null;
}
