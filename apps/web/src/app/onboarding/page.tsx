"use client";

import { Splash } from "@/components/shell/splash";
import { OcafySymbol } from "@/components/ui/logo";
import { Chip, Chips, Field } from "@/components/ui/primitives";
import { createHousehold } from "@/lib/actions";
import { ROOM_ORDER } from "@/lib/catalog";
import { DEFAULT_LITTER, useAppState } from "@/lib/store";
import {
  RECURRING_TASKS,
  ROOM_NAMES,
  ROUTINE_TASKS,
  type RoomId,
} from "@ocafy/core";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

type StepId = "casa" | "comodos" | "gatos" | "resumo";

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
  const s = useAppState();
  const router = useRouter();
  const [step, setStep] = useState<StepId>("casa");
  const [houseName, setHouseName] = useState("");
  const [nameA, setNameA] = useState("");
  const [nameB, setNameB] = useState("");
  const [rooms, setRooms] = useState<RoomId[]>(
    ROOM_ORDER.filter((r) => r !== "casa"),
  );
  const [litter, setLitter] = useState<Record<string, string>>(
    Object.fromEntries(
      Object.entries(DEFAULT_LITTER).map(([k, v]) => [k, String(v)]),
    ),
  );
  const [stock, setStock] = useState("");

  useEffect(() => {
    if (s.hydrated && s.household) router.replace("/");
  }, [s.hydrated, s.household, router]);

  const hasCats = rooms.includes("gatos");
  const steps: StepId[] = hasCats
    ? ["casa", "comodos", "gatos", "resumo"]
    : ["casa", "comodos", "resumo"];
  const idx = steps.indexOf(step);
  const valid =
    step === "casa"
      ? houseName.trim().length >= 2 &&
        nameA.trim().length >= 2 &&
        nameB.trim().length >= 2
      : step === "comodos"
        ? rooms.length > 0
        : true;

  const enabled = new Set<RoomId>([...rooms, "casa"]);
  const nRoutine = ROUTINE_TASKS.filter((t) => enabled.has(t.room)).length;
  const nRecurring = RECURRING_TASKS.filter((t) => enabled.has(t.room)).length;

  const finish = () => {
    const num = (k: string, d: number) => {
      const v = Number(litter[k]);
      return v > 0 ? v : d;
    };
    const minDays = num("minDays", 5);
    createHousehold({
      houseName,
      nameA,
      nameB,
      rooms,
      litter: {
        cats: Math.round(num("cats", 3)),
        boxes: Math.round(num("boxes", 2)),
        kgPerBox: num("kgPerBox", 4),
        bagKg: num("bagKg", 4),
        minDays,
        maxDays: Math.max(minDays, num("maxDays", 7)),
      },
      litterStock:
        hasCats && stock !== "" ? Math.max(0, Math.round(Number(stock))) : null,
    });
    router.replace("/");
  };

  const next = () => {
    if (!valid) return;
    if (step === "resumo") finish();
    else setStep(steps[idx + 1]);
  };

  if (!s.hydrated || s.household) return <Splash ready={false} />;

  return (
    <main className="mx-auto flex min-h-screen max-w-[520px] flex-col justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <OcafySymbol size={72} />
        <div className="owm mt-2.5" style={{ fontSize: 38 }}>
          ocafy
        </div>
        <p className="meta mt-2 mb-0">Deixa a casa ok.</p>
      </div>

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

      <form
        className="panel glass"
        style={{ padding: 20, borderRadius: 28 }}
        onSubmit={(e) => {
          e.preventDefault();
          next();
        }}
      >
        {step === "casa" && (
          <>
            <h1 className="text-[1.5rem]">Vamos montar a casa</h1>
            <p className="meta">Três nomes e a rotina já nasce pronta.</p>
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
              <div className="grid2">
                <Field label="Seu nome">
                  <input
                    type="text"
                    maxLength={24}
                    value={nameA}
                    onChange={(e) => setNameA(e.target.value)}
                  />
                </Field>
                <Field label="Nome da outra pessoa">
                  <input
                    type="text"
                    maxLength={24}
                    value={nameB}
                    onChange={(e) => setNameB(e.target.value)}
                  />
                </Field>
              </div>
            </div>
            <p className="meta mt-3">
              Vocês dividem o mesmo aparelho ou alternam pelo botão do avatar;
              cada “Feito” vai para o nome de quem está usando.
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
              Tudo pronto, {nameA.trim() || "vocês"}!
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
              prazos.
            </p>
          </>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          {idx > 0 ? (
            <button
              type="button"
              className="btn"
              onClick={() => setStep(steps[idx - 1])}
            >
              Voltar
            </button>
          ) : (
            <span />
          )}
          <button type="submit" className="btn btn-primary" disabled={!valid}>
            {step === "resumo" ? "Começar" : "Continuar"}
          </button>
        </div>
      </form>
    </main>
  );
}
