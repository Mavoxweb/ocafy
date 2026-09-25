"use client";

import { NowProvider } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import { refresh } from "@/lib/sync";
import { useRouter } from "next/navigation";
import { type ReactNode, useEffect } from "react";
import { AppBar } from "./app-bar";
import { BottomNav } from "./bottom-nav";
import { FxLayer, ToastHost } from "./fx-layer";
import { SheetHost } from "./sheet-host";
import { Splash } from "./splash";

export function AppShell({ children }: { children: ReactNode }) {
  const s = useAppState();
  const router = useRouter();
  const ready = s.status === "ready" && !!s.household;

  useEffect(() => {
    if (s.status === "anon") router.replace("/entrar");
    if (s.status === "nohousehold") router.replace("/onboarding");
  }, [s.status, router]);

  return (
    <>
      <Splash ready={ready} />
      {s.status === "error" && (
        <main className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-[1.4rem]">Sem conexão com o Ocafy</h1>
          <p className="meta">
            Não consegui carregar a sua casa. Confira a internet e tente de
            novo.
          </p>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => void refresh({ force: true })}
          >
            Tentar de novo
          </button>
        </main>
      )}
      {ready && s.suspended && (
        <main className="mx-auto flex min-h-screen max-w-[420px] flex-col items-center justify-center gap-3 px-4 text-center">
          <h1 className="text-[1.4rem]">Esta casa está suspensa</h1>
          <p className="meta">
            {s.suspended.reason ? `Motivo: ${s.suspended.reason}. ` : ""}
            Seus dados continuam guardados. Fale com o suporte para resolver.
          </p>
        </main>
      )}
      {ready && !s.suspended && (
        <NowProvider>
          <div className="mx-auto max-w-[640px] px-4 pb-40 md:max-w-[760px]">
            <AppBar />
            <main>{children}</main>
          </div>
          <BottomNav />
          <ToastHost />
          <FxLayer />
          <SheetHost />
        </NowProvider>
      )}
    </>
  );
}
