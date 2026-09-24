"use client";

import { Splash } from "@/components/shell/splash";
import { OcafySymbol } from "@/components/ui/logo";
import { Chip, Chips, Field } from "@/components/ui/primitives";
import { createHousehold, joinHousehold } from "@/lib/actions";
import { authClient } from "@/lib/auth/client";
import { ROOM_ORDER } from "@/lib/catalog";
import { DEFAULT_LITTER, useAppState } from "@/lib/store";
import { errorMessage } from "@/lib/trpc";
import {
  RECURRING_TASKS,
  ROOM_NAMES,
  ROUTINE_TASKS,
  type RoomId,
} from "@ocafy/core";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type StepId = "modo" | "casa" | "convite" | "comodos" | "gatos" | "resumo";

const NUM_FIELDS = [
  { key: "cats", label: "Gatos", min: 1, max: 10, step: 1 },
  { key: "boxes", label: "Caixas de areia", min: 1, max: 10, step: 1 },
  {
    key: "kgPerBox",
    label: "Kg de areia por caixa",
    min: 1,
    max: 20,
    step: 0.5,
  },
  { key: "bagKg", label: "Kg por saco", min: 1, max: 30, step: 0.5 },
  { key: "minDays", label: "Troca: mínimo de dias", min: 1, max: 60, step: 1 },
  { key: "maxDays", label: "Troca: máximo de dias", min: 1, max: 60, step: 1 },
] as const;

export default function OnboardingPage() {
  return (
    <Suspense fallback={null}>
      <Onboarding />
    </Suspense>
  );
}

function Onboarding() {
  const s = useAppState();
  const router = useRouter();
  const params = useSearchParams();
  const inviteFromLink =
    params
      .get("convite")
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, "") ?? "";

  const [step, setStep] = useState<StepId>(inviteFromLink ? "convite" : "modo");
  const [houseName, setHouseName] = useState("");
  const [myName, setMyName] = useState("");
  const [code, setCode] = useState(inviteFromLink);
  const [rooms, setRooms] = useState<RoomId[]>(
    ROOM_ORDER.filter((r) => r !== "casa"),
  );
  const [litter, setLitter] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(DEFAULT_LITTER).map(([k, v]) => [k, String(v)]),
    ),
  );
  const [stock, setStock] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // Já tem casa → início; sem sessão → login (preservando o convite).
  useEffect(() => {
    if (s.status === "ready") router.replace("/");
    if (s.status === "anon")
      router.replace(
        inviteFromLink ? `/entrar?convite=${inviteFromLink}` : "/entrar",
      );
  }, [s.status, router, inviteFromLink]);

  // Nome sugerido a partir do cadastro.
  useEffect(() => {
    void authClient.getSession().then((r) => {
      const n = r.data?.user?.name?.trim().split(/\s+/)[0];
      if (n) setMyName((cur) => cur || n.slice(0, 24));
    });
  }, []);

  const creating = step !== "modo" && step !== "convite";
  const hasCats = rooms.includes("gatos");
  const steps: StepId[] = hasCats
    ? ["casa", "comodos", "gatos", "resumo"]
    : ["casa", "comodos", "resumo"];
  const idx = steps.indexOf(step);

  const enabled = new Set<RoomId>([...rooms, "casa"]);
  const nRoutine = ROUTINE_TASKS.filter((t) => enabled.has(t.room)).length;
  const nRecurring = RECURRING_TASKS.filter((t) => enabled.has(t.room)).length;

  const valid =
    step === "casa"
      ? houseName.trim().length >= 2 && myName.trim().length >= 2
      : step === "convite"
        ? code.trim().length >= 4 && myName.trim().length >= 2
        : step === "comodos"
          ? rooms.length > 0
          : true;

  const num = (k: string, d: number) => {
    const v = Number(litter[k]);
    return v > 0 ? v : d;
  };

  async function finish() {
    setBusy(true);
    setError("");
    try {
      const minDays = Math.round(num("minDays", 5));
      await createHousehold({
        houseName: houseName.trim(),
        memberName: myName.trim(),
        rooms,
        litter: {
          cats: Math.round(num("cats", 3)),
          boxes: Math.round(num("boxes", 2)),
          kgPerBox: num("kgPerBox", 4),
          bagKg: num("bagKg", 4),
          minDays,
          maxDays: Math.max(minDays, Math.round(num("maxDays", 7))),
        },
        litterStock:
          hasCats && stock !== ""
            ? Math.max(0, Math.round(Number(stock)))
            : null,
      });
      router.replace("/");
    } catch (e) {
      setError(
        errorMessage(e, "Não foi possível criar a casa. Tente de novo."),
      );
    } finally {
      setBusy(false);
    }
  }

  async function join() {
    setBusy(true);
    setError("");
    try {
      await joinHousehold(code.trim(), myName.trim());
      router.replace("/");
    } catch (e) {
      setError(
        errorMessage(e, "Não foi possível entrar na casa. Confira o código."),
      );
    } finally {
      setBusy(false);
    }
  }

  const next = () => {
    if (!valid || busy) return;
    if (step === "convite") void join();
    else if (step === "resumo") void finish();
    else setStep(steps[idx + 1]);
  };

  if (s.status === "loading" || s.status === "ready" || s.status === "anon") {
    return <Splash ready={false} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <OcafySymbol size={72} />
        <div className="owm mt-2.5" style={{ fontSize: 38 }}>
          ocafy
        </div>
        <p className="meta mb-0 mt-2">Deixa a casa ok.</p>
      </div>

      {creating && (
        <>
          <p className="sr-only">
            Etapa {idx + 1} de {steps.length}
          </p>
          <div className="mb-3 flex justify-center gap-1.5" aria-hidden="true">
            {steps.map((st, i) => (
              <span
                key={st}
                className="h-1.5 rounded-pill transition-all"
                style={{
                  width: i === idx ? 28 : 10,
                  background: i <= idx ? "var(--accent-strong)" : "var(--line)",
                }}
              />
            ))}
          </div>
        </>
      )}

      <form
        className="panel glass"
        style={{ padding: 20, borderRadius: 28 }}
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {step === "modo" && (
          <>
            <h1 className="text-[1.5rem]">Bem-vindo(a)!</h1>
            <p className="meta">
              Comece uma casa nova ou entre na casa de quem te convidou.
            </p>
            <div className="mt-4 grid gap-3">
              <button
                type="button"
                className="btn btn-primary btn-block"
                style={{ margin: 0 }}
                onClick={() => setStep("casa")}
              >
                Criar uma casa
              </button>
              <button
                type="button"
                className="btn btn-block"
                style={{ margin: 0 }}
                onClick={() => setStep("convite")}
              >
                Tenho um código de convite
              </button>
            </div>
          </>
        )}

        {step === "convite" && (
          <>
            <h1 className="text-[1.5rem]">Entrar na casa</h1>
            <p className="meta">
              Digite o código que a outra pessoa te enviou.
            </p>
            <div className="mt-3 grid gap-3">
              <Field label="Código do convite">
                <input
                  type="text"
                  maxLength={16}
                  autoCapitalize="characters"
                  autoComplete="off"
                  placeholder="Ex.: K7M4XQ2R"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </Field>
              <Field label="Seu nome na casa">
                <input
                  type="text"
                  maxLength={24}
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        {step === "casa" && (
          <>
            <h1 className="text-[1.5rem]">Vamos montar a casa</h1>
            <p className="meta">Dois nomes e a rotina já nasce pronta.</p>
            <div className="mt-3 grid gap-3">
              <Field label="Nome da casa">
                <input
                  type="text"
                  maxLength={40}
                  placeholder="Ex.: Nosso Cantinho"
                  value={houseName}
                  onChange={(e) => setHouseName(e.target.value)}
                />
              </Field>
              <Field label="Seu nome">
                <input
                  type="text"
                  maxLength={24}
                  value={myName}
                  onChange={(e) => setMyName(e.target.value)}
                />
              </Field>
            </div>
            <p className="meta mt-3">
              A outra pessoa entra depois, com a própria conta, por um código de
              convite — cada uma usa o seu aparelho.
            </p>
          </>
        )}

        {step === "comodos" && (
          <>
            <h1 className="text-[1.5rem]">Quais cômodos existem?</h1>
            <p className="meta">
              Só entram na rotina os cômodos marcados. Dá para mudar depois nos
              Ajustes.
            </p>
            <div className="mt-3.5">
              <Chips>
                {ROOM_ORDER.filter((r) => r !== "casa").map((r) => (
                  <Chip
                    key={r}
                    pressed={rooms.includes(r)}
                    onClick={() =>
                      setRooms((cur) =>
                        cur.includes(r)
                          ? cur.filter((x) => x !== r)
                          : [...cur, r],
                      )
                    }
                  >
                    {ROOM_NAMES[r]}
                  </Chip>
                ))}
              </Chips>
            </div>
            <p className="meta mt-3">
              “Casa toda” (lixo, aspirar, organização…) sempre entra.
            </p>
          </>
        )}

        {step === "gatos" && (
          <>
            <h1 className="text-[1.5rem]">Gatos e caixa de areia</h1>
            <p className="meta">
              Usado para calcular a troca de areia e o estoque de sacos.
            </p>
            <div className="grid2 mt-3">
              {NUM_FIELDS.map((f) => (
                <Field key={f.key} label={f.label}>
                  <input
                    type="number"
                    min={f.min}
                    max={f.max}
                    step={f.step}
                    inputMode="decimal"
                    value={litter[f.key]}
                    onChange={(e) =>
                      setLitter({ ...litter, [f.key]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
            <div className="mt-3">
              <Field label="Sacos de areia em casa (opcional)">
                <input
                  type="number"
                  min={0}
                  inputMode="numeric"
                  placeholder="Ex.: 10"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                />
              </Field>
            </div>
          </>
        )}

        {step === "resumo" && (
          <>
            <h1 className="text-[1.5rem]">
              Tudo pronto, {myName.trim() || "você"}!
            </h1>
            <p className="meta">
              Isto é o que vai ser criado para {houseName.trim()}:
            </p>
            <div className="stats mt-3">
              <div className="stat">
                <div className="v">{nRoutine}</div>
                <div className="k">rotinas diárias (manhã e noite)</div>
              </div>
              <div className="stat">
                <div className="v">{nRecurring}</div>
                <div className="k">tarefas recorrentes com janela de dias</div>
              </div>
              <div className="stat">
                <div className="v">{rooms.length + 1}</div>
                <div className="k">cômodos acompanhados</div>
              </div>
              <div className="stat">
                <div className="v">6</div>
                <div className="k">prêmios iniciais na lojinha</div>
              </div>
            </div>
            <p className="meta mt-3">
              Ao começar, tudo está “sem registro”: informe quando cada coisa
              foi feita pela última vez em Rotinas para o método calcular os
              prazos. Depois, convide a outra pessoa pela tela inicial.
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[0.9rem] font-bold text-late-t">
            {error}
          </p>
        )}

        {step !== "modo" && (
          <div className="mt-5 flex items-center justify-between gap-3">
            <button
              type="button"
              className="btn"
              onClick={() => {
                setError("");
                setStep(
                  step === "convite" || step === "casa"
                    ? "modo"
                    : steps[idx - 1],
                );
              }}
            >
              Voltar
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!valid || busy}
            >
              {busy
                ? "Aguarde…"
                : step === "resumo"
                  ? "Começar"
                  : step === "convite"
                    ? "Entrar na casa"
                    : "Continuar"}
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
