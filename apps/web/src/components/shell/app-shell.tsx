"use client";

import { NowProvider } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
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
  const ready = s.hydrated && !!s.household;

  useEffect(() => {
    if (s.hydrated && !s.household) router.replace("/onboarding");
  }, [s.hydrated, s.household, router]);

  return (
    <>
      <Splash ready={ready} />
      {ready && (
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
