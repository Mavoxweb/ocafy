"use client";

import { ensureInvite } from "@/lib/actions";
import { useAppState } from "@/lib/store";
import { errorMessage } from "@/lib/trpc";
import { toast } from "@/lib/ui";
import { useEffect, useState } from "react";

/** Código + link de convite para a segunda pessoa da casa. */
export function InvitePanel() {
  const s = useAppState();
  const [error, setError] = useState("");
  const code = s.invite?.code;

  useEffect(() => {
    if (!code) {
      ensureInvite().catch((e) =>
        setError(errorMessage(e, "Não foi possível gerar o convite.")),
      );
    }
  }, [code]);

  const link = code
    ? `${typeof window === "undefined" ? "" : window.location.origin}/entrar?convite=${code}`
    : "";

  async function copy(text: string, what: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copiado.`);
    } catch {
      toast("Não consegui copiar. Selecione e copie manualmente.");
    }
  }

  return (
    <div className="panel" style={{ margin: "14px 0 4px" }}>
      <b>Convide a outra pessoa</b>
      <p className="meta">
        Ela cria a própria conta e entra na casa com este código (vale 7 dias).
      </p>
      {code ? (
        <>
          <div
            className="my-2 text-center font-extrabold tracking-[0.18em]"
            style={{ fontSize: "1.9rem" }}
            aria-label={`Código de convite ${code}`}
          >
            {code}
          </div>
          <div className="frow" style={{ justifyContent: "center" }}>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => copy(code, "Código")}
            >
              Copiar código
            </button>
            <button
              type="button"
              className="btn btn-small"
              onClick={() => copy(link, "Link")}
            >
              Copiar link
            </button>
          </div>
        </>
      ) : error ? (
        <p role="alert" className="meta">
          {error}
        </p>
      ) : (
        <p className="meta">Gerando convite…</p>
      )}
    </div>
  );
}
