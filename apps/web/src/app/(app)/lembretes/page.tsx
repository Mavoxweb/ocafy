"use client";

import { Chip, Panel, Segmented } from "@/components/ui/primitives";
import {
  addAbsence,
  disablePush,
  enablePush,
  removeAbsence,
  sendTestPush,
  setDaySchedule,
  setNotifPrefs,
} from "@/lib/actions";
import { WEEKDAYS, capitalize } from "@/lib/dates";
import { type PushSupport, pushSupport } from "@/lib/push";
import { useAppState } from "@/lib/store";
import { errorMessage } from "@/lib/trpc";
import { toast } from "@/lib/ui";
import {
  DAY_MODE_LABELS,
  type DayMode,
  type DaySchedule,
  type NotifPrefs,
} from "@ocafy/core";
import { useEffect, useState } from "react";

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

const KINDS: { key: keyof NotifPrefs; label: string; hint: string }[] = [
  { key: "morning", label: "Rotina da manhã", hint: "Antes de você sair" },
  {
    key: "night",
    label: "Reset da noite",
    hint: "Quando você já está em casa",
  },
  { key: "due", label: "Tarefas na janela", hint: "Resumo do dia" },
  { key: "defrost", label: "Congelador", hint: "Hora de retirar a proteína" },
  { key: "partner", label: "Pedidos da casa", hint: "Trocas e resgates" },
  {
    key: "shopping",
    label: "Compras",
    hint: "Itens urgentes e dia de mercado",
  },
];

const SUPPORT_TEXT: Record<Exclude<PushSupport, "ok">, string> = {
  unsupported: "Este navegador não recebe avisos. Tente o Chrome ou o Edge.",
  ios_install:
    "No iPhone, os avisos só funcionam com o Ocafy instalado: toque em Compartilhar → Adicionar à Tela de Início e abra por lá.",
  denied:
    "As notificações estão bloqueadas neste navegador. Libere nas configurações do site e volte aqui.",
};

export default function RemindersPage() {
  const s = useAppState();
  const n = s.notifications;
  const [support, setSupport] = useState<PushSupport>("ok");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  // biome-ignore lint/correctness/useExhaustiveDependencies: recalcula ao mudar o estado dos avisos
  useEffect(() => setSupport(pushSupport()), [n.prefs.enabled]);

  async function turnOn() {
    setBusy(true);
    setMsg("");
    const r = await enablePush();
    setBusy(false);
    if (r === "ok") toast("Avisos ligados neste aparelho.");
    else if (r === "not_configured")
      setMsg("Os avisos ainda não estão ligados neste servidor.");
    else if (r === "denied") setSupport("denied");
    else if (r === "error") setMsg("Não foi possível ativar. Tente de novo.");
    else setSupport(r);
  }

  return (
    <>
      <h2 className="mt-4">Lembretes e agenda</h2>
      <p className="meta">
        O Ocafy avisa no horário certo e só quando você está em casa. Tudo é
        opcional e você desliga quando quiser.
      </p>

      <h2>Avisos</h2>
      <Panel>
        {!n.pushConfigured ? (
          <p className="meta m-0">
            Os avisos ainda não estão ligados neste servidor. Assim que forem,
            você ativa por aqui.
          </p>
        ) : support !== "ok" && !n.prefs.enabled ? (
          <p className="meta m-0">{SUPPORT_TEXT[support]}</p>
        ) : n.prefs.enabled && n.devices > 0 ? (
          <div className="grid gap-3.5">
            <div className="flex items-center justify-between gap-3">
              <b>Avisos ligados</b>
              <span className="meta m-0">
                {n.devices} {n.devices === 1 ? "aparelho" : "aparelhos"}
              </span>
            </div>

            <div className="chips wrap">
              {KINDS.map((k) => (
                <Chip
                  key={k.key}
                  pressed={!!n.prefs[k.key]}
                  onClick={() => setNotifPrefs({ [k.key]: !n.prefs[k.key] })}
                >
                  {k.label}
                </Chip>
              ))}
            </div>
            <p className="meta m-0">
              {KINDS.filter((k) => n.prefs[k.key])
                .map((k) => `${k.label}: ${k.hint.toLowerCase()}`)
                .join(" · ") || "Nenhum tipo de aviso escolhido."}
            </p>

            <div className="grid2">
              <label className="f">
                Silêncio a partir de
                <input
                  type="time"
                  value={n.prefs.quietStart}
                  onChange={(e) =>
                    e.target.value &&
                    setNotifPrefs({ quietStart: e.target.value })
                  }
                />
              </label>
              <label className="f">
                até
                <input
                  type="time"
                  value={n.prefs.quietEnd}
                  onChange={(e) =>
                    e.target.value &&
                    setNotifPrefs({ quietEnd: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="f">
              Avisar antes de sair de casa
              <select
                value={n.prefs.remindBeforeMin}
                onChange={(e) =>
                  setNotifPrefs({ remindBeforeMin: Number(e.target.value) })
                }
              >
                {[5, 10, 15, 20, 30, 45, 60].map((m) => (
                  <option key={m} value={m}>
                    {m} minutos antes
                  </option>
                ))}
              </select>
            </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="btn btn-small"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  setMsg(await sendTestPush());
                  setBusy(false);
                }}
              >
                Enviar aviso de teste
              </button>
              <button
                type="button"
                className="link"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await disablePush();
                  setBusy(false);
                }}
              >
                Desligar avisos
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2.5">
            <b>Receba lembretes no celular</b>
            <p className="meta m-0">
              Rotina da manhã antes de sair, reset da noite, retirar a proteína
              do congelador e pedidos da casa. Nada de aviso quando você está
              fora.
            </p>
            {n.prefs.enabled && n.devices === 0 && (
              <p className="meta m-0">
                Este aparelho ainda não está registrado. Ative de novo.
              </p>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={turnOn}
            >
              {busy ? "Ativando…" : "Ativar avisos neste aparelho"}
            </button>
          </div>
        )}
        {msg && <output className="meta mt-2 mb-0 block">{msg}</output>}
      </Panel>

      <h2>Sua semana</h2>
      <p className="meta">
        Diga como é cada dia. Nos dias “fora” você não recebe lembretes da casa;
        em “sai e volta”, eles chegam antes da saída e depois da volta.
      </p>
      <Panel>
        <div className="grid gap-3.5">
          {DAY_ORDER.map((wd) => (
            <DayRow
              key={wd}
              weekday={wd}
              day={n.schedule.find((d) => d.weekday === wd)}
            />
          ))}
        </div>
      </Panel>

      <h2>Ausências</h2>
      <p className="meta">
        Viagem, plantão, curso… Nesses dias os lembretes ficam em silêncio.
      </p>
      <AbsencesPanel />
      <p className="meta mt-3">
        Horários no fuso {n.timezone.replace("_", " ")}.
      </p>
    </>
  );
}

function DayRow({ weekday, day }: { weekday: number; day?: DaySchedule }) {
  const mode: DayMode = day?.mode ?? "home";
  const set = (next: Partial<DaySchedule>) =>
    setDaySchedule({
      weekday,
      mode,
      leave: day?.leave ?? null,
      back: day?.back ?? null,
      ...next,
    });

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <b className="w-24">{capitalize(WEEKDAYS[weekday])}</b>
        <Segmented<DayMode>
          label={`Como é ${WEEKDAYS[weekday]}`}
          value={mode}
          onChange={(m) =>
            m === "partial"
              ? set({
                  mode: m,
                  leave: day?.leave ?? "08:00",
                  back: day?.back ?? "18:00",
                })
              : set({ mode: m, leave: null, back: null })
          }
          options={(Object.keys(DAY_MODE_LABELS) as DayMode[]).map((m) => ({
            value: m,
            label: DAY_MODE_LABELS[m],
          }))}
        />
      </div>
      {mode === "partial" && (
        <div className="grid2">
          <label className="f">
            Sai às
            <input
              type="time"
              value={day?.leave ?? "08:00"}
              onChange={(e) => e.target.value && set({ leave: e.target.value })}
            />
          </label>
          <label className="f">
            Volta às
            <input
              type="time"
              value={day?.back ?? "18:00"}
              onChange={(e) => e.target.value && set({ back: e.target.value })}
            />
          </label>
        </div>
      )}
    </div>
  );
}

function AbsencesPanel() {
  const s = useAppState();
  const list = s.notifications.absences;
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    setError("");
    try {
      await addAbsence(from, until || from, note);
      setFrom("");
      setUntil("");
      setNote("");
    } catch (e) {
      setError(errorMessage(e, "Não foi possível salvar."));
    } finally {
      setBusy(false);
    }
  }

  const fmt = (k: string) => k.split("-").reverse().join("/");
  return (
    <Panel>
      {list.length > 0 && (
        <div className="group mb-3">
          {list.map((a) => (
            <div key={a.id} className="logrow">
              <div>
                <div className="tt">
                  {fmt(a.from)}
                  {a.until !== a.from ? ` a ${fmt(a.until)}` : ""}
                </div>
                {a.note && <div className="meta">{a.note}</div>}
              </div>
              <button
                type="button"
                className="link"
                onClick={() => removeAbsence(a.id)}
              >
                Remover
              </button>
            </div>
          ))}
        </div>
      )}
      <div className="grid2">
        <label className="f">
          De
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label className="f">
          Até
          <input
            type="date"
            value={until}
            min={from}
            onChange={(e) => setUntil(e.target.value)}
          />
        </label>
      </div>
      <label className="f mt-2.5">
        Motivo (opcional)
        <input
          type="text"
          maxLength={60}
          placeholder="Ex.: Viagem"
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </label>
      {error && (
        <p role="alert" className="mt-2 text-[0.88rem] font-bold text-late-t">
          {error}
        </p>
      )}
      <button
        type="button"
        className="btn btn-small mt-2.5"
        disabled={!from || busy}
        onClick={add}
      >
        Adicionar ausência
      </button>
    </Panel>
  );
}
