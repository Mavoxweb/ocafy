"use client";

import { IconHelp } from "@/components/ui/icons";
import { Chip, NumberInput, StatusPill } from "@/components/ui/primitives";
import { Sheet, SheetHead } from "@/components/ui/sheet";
import {
  assignTask,
  completeTask,
  requestTrade,
  respondTrade,
  setFrequency,
  togglePause,
} from "@/lib/actions";
import { WEEKDAYS, addDays, dayKey, daysAgoPhrase, fromKey } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  assigneeOf,
  currentMember,
  incomingTradeFor,
  isOff,
  isRecurring,
  memberName,
  myTradesFor,
  otherAdults,
  statusLabel,
  suitableFor,
  taskOf,
  taskStatus,
  taskTitle,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { closeSheet } from "@/lib/ui";
import { AGE_BANDS } from "@ocafy/core";
import { useRef, useState } from "react";

export function TaskSheet({ id }: { id: string }) {
  const s = useAppState();
  const now = useNow();
  const dateRef = useRef<HTMLInputElement>(null);
  const t = taskOf(s, id);
  // "Quem fez?": padrão = quem cuida da tarefa se for criança, senão eu.
  const [whoKid, setWhoKid] = useState<string | null>(null);
  if (!t) return null;

  const st = taskStatus(s, t, now);
  const off = isOff(s, t);
  const yesterday = dayKey(addDays(now, -1));
  const me = currentMember(s);
  const adults = otherAdults(s, me?.id);
  const assignee = assigneeOf(s, id);
  const when =
    st.state === "nunca" || !st.last || st.d == null
      ? "Ainda sem registro"
      : `Última vez ${daysAgoPhrase(st.d)}, por ${memberName(s, st.last.who)}`;
  const how = t.how;
  const incoming = incomingTradeFor(s, id);
  const { pending: pendingFor, accepted: acceptedFor } = myTradesFor(s, id);

  const kids = s.members.filter((m) => m.kind === "profile");
  const kidFor = whoKid ?? (assignee?.kind === "profile" ? assignee.id : null);

  const doneAt = () => {
    const v = dateRef.current?.value;
    if (!v) return;
    const d = fromKey(v);
    const today = dayKey(now) === v;
    d.setHours(today ? now.getHours() : 12, today ? now.getMinutes() : 0);
    closeSheet();
    completeTask(id, { at: d, ...(kidFor ? { forMemberId: kidFor } : {}) });
  };

  return (
    <Sheet onClose={closeSheet} label={taskTitle(s, t)}>
      <SheetHead onClose={closeSheet}>
        <StatusPill state={st.state}>{statusLabel(st)}</StatusPill>
      </SheetHead>
      <h3 className="mt-2.5">{taskTitle(s, t)}</h3>
      <p className="meta">
        {t.roomLabel} · ~{t.mins} min · +{5 + t.mins} XP
      </p>
      <p className="meta">{when}</p>
      {how && (
        <div className="how">
          <b>Como fazer</b>
          <p>{how}</p>
        </div>
      )}
      {incoming && (
        <div className="ask-banner">
          <IconHelp size={22} />
          <div className="flex-1">
            <b>{memberName(s, incoming.requesterId)} pediu sua ajuda</b>
            <p className="meta mb-0">
              Você decide — pode aceitar ou recusar, sem problema.
            </p>
            <div className="frow">
              <button
                type="button"
                className="btn btn-small btn-primary"
                onClick={() => respondTrade(incoming.id, true)}
              >
                Aceitar
              </button>
              <button
                type="button"
                className="btn btn-small"
                onClick={() => respondTrade(incoming.id, false)}
              >
                Recusar
              </button>
            </div>
          </div>
        </div>
      )}
      {kids.length > 0 && (
        <div className="mt-2.5">
          <div className="qlabel">Quem fez?</div>
          <div className="chips wrap">
            <Chip pressed={!kidFor} onClick={() => setWhoKid("")}>
              Eu
            </Chip>
            {kids.map((k) => (
              <Chip
                key={k.id}
                pressed={kidFor === k.id}
                onClick={() => setWhoKid(k.id)}
              >
                {k.name}
              </Chip>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          closeSheet();
          completeTask(id, {
            rect,
            ...(kidFor ? { forMemberId: kidFor } : {}),
          });
        }}
      >
        Marcar como feito
      </button>

      {isRecurring(t) &&
        (t.id === "area_troca" ? (
          <p className="meta">
            A frequência desta tarefa é ajustada na aba Gatos.
          </p>
        ) : (
          <>
            <h4>Frequência</h4>
            <div className="frow">
              <span className="meta">A cada</span>
              <NumberInput
                label="Mínimo de dias"
                value={st.mn}
                min={1}
                max={365}
                onCommit={(v) => setFrequency(id, v, Math.max(v, st.mx))}
              />
              <span className="meta">a</span>
              <NumberInput
                label="Máximo de dias"
                value={st.mx}
                min={1}
                max={365}
                onCommit={(v) => setFrequency(id, Math.min(v, st.mn), v)}
              />
              <span className="meta">
                dias{t.day != null ? ` · sugerido: ${WEEKDAYS[t.day]}` : ""}
              </span>
            </div>
          </>
        ))}

      {s.members.length > 1 && (
        <>
          <h4>Quem cuida desta tarefa?</h4>
          <div className="chips wrap">
            <Chip pressed={!assignee} onClick={() => assignTask(id, null)}>
              Ninguém fixo
            </Chip>
            {s.members.map((m) => {
              const ok = suitableFor(t, m);
              return (
                <Chip
                  key={m.id}
                  pressed={assignee?.id === m.id}
                  onClick={() => assignTask(id, m.id)}
                >
                  {m.name}
                  {!ok && (
                    <small className="text-muted">
                      {" "}
                      · a partir de{" "}
                      {t.suitableFrom ? AGE_BANDS[t.suitableFrom].label : ""}
                    </small>
                  )}
                </Chip>
              );
            })}
          </div>
          <p className="meta">
            {t.suitableFrom
              ? `Sugestão: crianças a partir de ${AGE_BANDS[t.suitableFrom].label}. `
              : ""}
            É só um lembrete de quem costuma cuidar — qualquer pessoa pode
            marcar como feito.
          </p>
        </>
      )}

      {adults.length > 0 && (
        <>
          <h4>
            <span className="help-chip">
              <IconHelp size={16} /> Precisa de uma força?
            </span>
          </h4>
          <p className="meta">
            Peça ajuda para hoje — a pessoa decide se aceita, não é uma
            atribuição.
          </p>
          <div className="chips wrap">
            {adults.map((a) => {
              const isPending = pendingFor.has(a.id);
              const isAccepted = acceptedFor.has(a.id);
              return (
                <Chip
                  key={a.id}
                  pressed={isPending || isAccepted}
                  disabled={isPending || isAccepted}
                  onClick={() =>
                    requestTrade(id, adults.length > 1 ? a.id : undefined)
                  }
                >
                  <span className="help-chip">
                    {isAccepted && "✓ "}
                    {isAccepted
                      ? `${a.name} topou ajudar`
                      : isPending
                        ? `Aguardando ${a.name}`
                        : `Pedir ajuda a ${a.name}`}
                  </span>
                </Chip>
              );
            })}
          </div>
        </>
      )}

      <h4>Fez em outro dia?</h4>
      <div className="frow">
        <input
          ref={dateRef}
          type="date"
          max={dayKey(now)}
          defaultValue={yesterday}
          aria-label="Data em que foi feito"
        />
        <button type="button" className="btn" onClick={doneAt}>
          Registrar
        </button>
      </div>

      {isRecurring(t) && (
        <div className="mt-2">
          <button
            type="button"
            className="link"
            onClick={() => {
              closeSheet();
              togglePause(id);
            }}
          >
            {off ? "Reativar esta tarefa" : "Pausar esta tarefa"}
          </button>
        </div>
      )}
    </Sheet>
  );
}
