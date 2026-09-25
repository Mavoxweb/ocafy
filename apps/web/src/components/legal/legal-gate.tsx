"use client";

import { acceptLegalUpdate } from "@/lib/actions";
import { authClient } from "@/lib/auth/client";
import { errorMessage } from "@/lib/trpc";
import { useState } from "react";
import { LegalCheck } from "./legal-check";

/** Tela que bloqueia o app quando os Termos/Política mudaram e a pessoa ainda não aceitou a nova versão. */
export function LegalGate() {
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function accept() {
    setBusy(true);
    setError("");
    try {
      await acceptLegalUpdate();
    } catch (e) {
      setError(errorMessage(e, "Não foi possível registrar o aceite."));
      setBusy(false);
    }
  }

  async function leave() {
    setBusy(true);
    try {
      await authClient.signOut();
    } finally {
      window.location.assign("/entrar");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[480px] flex-col justify-center gap-4 px-4 py-8">
      <h1 className="text-[1.4rem]">Atualizamos nossos documentos</h1>
      <p className="meta">
        Os Termos de Uso e a Política de Privacidade do Ocafy foram atualizados.
        Leia e aceite a nova versão para continuar usando o aplicativo. Seus
        dados continuam guardados.
      </p>
      <LegalCheck checked={ok} onChange={setOk} />
      {error && (
        <p role="alert" className="text-[0.9rem] font-bold text-late-t">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="btn btn-primary"
          disabled={!ok || busy}
          onClick={accept}
        >
          Aceitar e continuar
        </button>
        <button type="button" className="link" disabled={busy} onClick={leave}>
          Não concordo — sair
        </button>
      </div>
    </main>
  );
}
