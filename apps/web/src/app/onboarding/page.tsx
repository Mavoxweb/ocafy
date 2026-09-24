"use client";

import {
  HouseFields,
  ModePicker,
  PetsEditor,
  PlanPreview,
  RhythmFields,
  RoomGrid,
} from "@/components/casa/house-editor";
import { Splash } from "@/components/shell/splash";
import { OcafySymbol } from "@/components/ui/logo";
import { Field } from "@/components/ui/primitives";
import { createHousehold, joinHousehold, trackOnboarding } from "@/lib/actions";
import { authClient } from "@/lib/auth/client";
import {
  type HouseDraft,
  draftFromTemplate,
  initialDraft,
} from "@/lib/house-draft";
import { useAppState } from "@/lib/store";
import { errorMessage } from "@/lib/trpc";
import { HOUSE_TEMPLATES, defaultRoomCounts } from "@ocafy/core";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

type StepId =
  | "inicio"
  | "convite"
  | "modelo"
  | "nomes"
  | "casa"
  | "comodos"
  | "pets"
  | "ritmo"
  | "previa";

const STEPS: StepId[] = [
  "modelo",
  "nomes",
  "casa",
  "comodos",
  "pets",
  "ritmo",
  "previa",
];

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

  const [step, setStep] = useState<StepId>(
    inviteFromLink ? "convite" : "inicio",
  );
  const [draft, setDraft] = useState<HouseDraft>(initialDraft);
  const [roomsTouched, setRoomsTouched] = useState(false);
  const [fromTemplate, setFromTemplate] = useState(false);
  const [houseName, setHouseName] = useState("");
  const [myName, setMyName] = useState("");
  const [code, setCode] = useState(inviteFromLink);
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

  // Mede em que passo as pessoas desistem (só depois de a sessão estar pronta).
  const ready = s.status === "nohousehold";
  useEffect(() => {
    if (ready) trackOnboarding(step);
  }, [step, ready]);

  const patch = (fn: (d: HouseDraft) => HouseDraft) => setDraft(fn);
  const patchRooms = (fn: (d: HouseDraft) => HouseDraft) => {
    setRoomsTouched(true);
    setDraft(fn);
  };
  const resetRooms = (
    dwelling: HouseDraft["profile"]["dwelling"],
    size: HouseDraft["profile"]["size"],
  ) => {
    if (!roomsTouched)
      setDraft((d) => ({ ...d, counts: defaultRoomCounts(dwelling, size) }));
  };

  const creating = STEPS.includes(step);
  const idx = STEPS.indexOf(step);
  const nRooms = Object.values(draft.counts).reduce((a, b) => a + (b ?? 0), 0);

  const valid =
    step === "nomes"
      ? houseName.trim().length >= 2 && myName.trim().length >= 2
      : step === "convite"
        ? code.trim().length >= 4 && myName.trim().length >= 2
        : step === "pets"
          ? draft.pets.every((p) => p.name.trim().length > 0)
          : step === "comodos"
            ? nRooms > 0
            : true;

  function pickTemplate(id: string | null) {
    setFromTemplate(id !== null);
    setRoomsTouched(false);
    setDraft(id ? draftFromTemplate(id) : initialDraft());
    setStep("nomes");
  }

  async function finish() {
    setBusy(true);
    setError("");
    try {
      await createHousehold({
        houseName: houseName.trim(),
        memberName: myName.trim(),
        draft,
      });
      trackOnboarding("concluido");
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
      trackOnboarding("entrou_convite");
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
    else if (step === "previa") void finish();
    else if (creating) setStep(STEPS[idx + 1]);
  };

  const back = () => {
    setError("");
    if (step === "convite" || step === "modelo") setStep("inicio");
    else if (creating) setStep(STEPS[idx - 1]);
  };

  if (s.status === "loading" || s.status === "ready" || s.status === "anon") {
    return <Splash ready={false} />;
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[560px] flex-col justify-center px-4 py-8">
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
            Etapa {idx + 1} de {STEPS.length}
          </p>
          <div className="mb-3 flex justify-center gap-1.5" aria-hidden="true">
            {STEPS.map((st, i) => (
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
        {step === "inicio" && (
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
                onClick={() => setStep("modelo")}
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

        {step === "modelo" && (
          <>
            <h1 className="text-[1.5rem]">Como é a sua casa?</h1>
            <p className="meta">
              Escolha um modelo pronto para começar rápido — você ajusta tudo
              nos próximos passos.
            </p>
            <div className="tpl-list mt-3.5">
              {HOUSE_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="mode-card"
                  onClick={() => pickTemplate(t.id)}
                >
                  <b>{t.name}</b>
                  <span className="meta">{t.hint}</span>
                </button>
              ))}
              <button
                type="button"
                className="mode-card"
                onClick={() => pickTemplate(null)}
              >
                <b>Montar do zero</b>
                <span className="meta">Escolho cômodos, pets e ritmo</span>
              </button>
            </div>
          </>
        )}

        {step === "nomes" && (
          <>
            <h1 className="text-[1.5rem]">Quem mora aí?</h1>
            <p className="meta">Dois nomes e a rotina já começa a se montar.</p>
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
              <ModePicker draft={draft} patch={patch} />
            </div>
            {draft.profile.mode === "couple" && (
              <p className="meta mt-3">
                A outra pessoa entra depois, com a própria conta, por um código
                de convite — cada uma usa o seu aparelho.
              </p>
            )}
          </>
        )}

        {step === "casa" && (
          <>
            <h1 className="text-[1.5rem]">Onde vocês moram?</h1>
            <p className="meta">
              Casa e apartamento têm tarefas diferentes (quintal, calçada, caixa
              d’água…).
            </p>
            <div className="mt-3.5">
              <HouseFields
                draft={draft}
                patch={patch}
                onResetRooms={resetRooms}
              />
            </div>
          </>
        )}

        {step === "comodos" && (
          <>
            <h1 className="text-[1.5rem]">Quais cômodos existem?</h1>
            <p className="meta">
              Use − e + para dizer quantos de cada. Cada banheiro e cada quarto
              ganha as suas próprias tarefas.
            </p>
            <div className="mt-3.5">
              <RoomGrid draft={draft} patch={patchRooms} />
            </div>
            <p className="meta mt-3">
              “Casa toda” (lixo, aspirar, organização…) sempre entra.
            </p>
          </>
        )}

        {step === "pets" && (
          <>
            <h1 className="text-[1.5rem]">Tem pets?</h1>
            <p className="meta">
              Cães, gatos e outros bichos geram tarefas próprias: passeio,
              banho, areia, vacinas…
            </p>
            <div className="mt-3.5">
              <PetsEditor draft={draft} patch={patch} />
            </div>
          </>
        )}

        {step === "ritmo" && (
          <>
            <h1 className="text-[1.5rem]">Qual o ritmo da casa?</h1>
            <p className="meta">
              Isso ajusta quantas tarefas aparecem e o tamanho das janelas de
              dias.
            </p>
            <div className="mt-3.5">
              <RhythmFields draft={draft} patch={patch} />
            </div>
          </>
        )}

        {step === "previa" && (
          <>
            <h1 className="text-[1.5rem]">
              Tudo pronto, {myName.trim() || "você"}!
            </h1>
            <p className="meta">
              Esta é a rotina que o Ocafy montou para {houseName.trim()}:
            </p>
            <div className="mt-3.5">
              <PlanPreview draft={draft} />
            </div>
            <p className="meta mt-3">
              Ao começar, tudo está “sem registro”: informe quando cada coisa
              foi feita pela última vez em Rotinas para o método calcular os
              prazos. Você muda cômodos, pets e ritmo quando quiser em Ajustes →
              Minha casa.
            </p>
          </>
        )}

        {error && (
          <p role="alert" className="mt-3 text-[0.9rem] font-bold text-late-t">
            {error}
          </p>
        )}

        {step !== "inicio" && (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <button type="button" className="btn" onClick={back}>
              Voltar
            </button>
            {step !== "modelo" && (
              <button
                type="submit"
                className="btn btn-primary"
                disabled={!valid || busy}
              >
                {busy
                  ? "Aguarde…"
                  : step === "previa"
                    ? "Começar"
                    : step === "convite"
                      ? "Entrar na casa"
                      : "Continuar"}
              </button>
            )}
          </div>
        )}
        {fromTemplate && creating && step !== "previa" && step !== "modelo" && (
          <div className="mt-3 text-center">
            <button
              type="button"
              className="link"
              disabled={houseName.trim().length < 2 || myName.trim().length < 2}
              onClick={() => setStep("previa")}
            >
              Pular para o resumo
            </button>
          </div>
        )}
      </form>
    </main>
  );
}
