"use client";

import { NumberInput, StatusPill } from "@/components/ui/primitives";
import { Sheet, SheetHead } from "@/components/ui/sheet";
import {
  completeTask,
  requestTrade,
  setFrequency,
  togglePause,
} from "@/lib/actions";
import { TASK_MAP } from "@/lib/catalog";
import { WEEKDAYS, addDays, dayKey, daysAgoPhrase, fromKey } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  currentMember,
  isOff,
  isRecurring,
  memberName,
  partnerOf,
  statusLabel,
  taskStatus,
  taskTitle,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { closeSheet } from "@/lib/ui";
import { ROOM_NAMES } from "@ocafy/core";
import { useRef } from "react";

export function TaskSheet({ id }: { id: string }) {
  const s = useAppState();
  const now = useNow();
  const dateRef = useRef<HTMLInputElement>(null);
  const t = TASK_MAP[id];
  if (!t) return null;

  const st = taskStatus(s, t, now);
  const off = isOff(s, t);
  const yesterday = dayKey(addDays(now, -1));
  const me = currentMember(s);
  const partner = partnerOf(s, me?.id);
  const when =
    st.state === "nunca" || !st.last || st.d == null
      ? "Ainda sem registro"
      : `Última vez ${daysAgoPhrase(st.d)}, por ${memberName(s, st.last.who)}`;
  const how = "how" in t ? t.how : "";
  const pendingTrade = s.trades.some(
    (x) => x.taskId === id && x.status === "pending",
  );

  const doneAt = () => {
    const v = dateRef.current?.value;
    if (!v) return;
    const d = fromKey(v);
    const today = dayKey(now) === v;
    d.setHours(today ? now.getHours() : 12, today ? now.getMinutes() : 0);
    closeSheet();
    completeTask(id, { at: d });
  };

  return (
    <Sheet onClose={closeSheet} label={taskTitle(s, t)}>
      <SheetHead onClose={closeSheet}>
        <StatusPill state={st.state}>{statusLabel(st)}</StatusPill>
      </SheetHead>
      <h3 className="mt-2.5">{taskTitle(s, t)}</h3>
      <p className="meta">
        {ROOM_NAMES[t.room]} · ~{t.mins} min · +{5 + t.mins} XP
      </p>
      <p className="meta">{when}</p>
      {how && (
        <div className="how">
          <b>Como fazer</b>
          <p>{how}</p>
        </div>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          closeSheet();
          completeTask(id, { rect });
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

      <div className="mt-2 flex flex-wrap gap-x-5">
        {partner && (
          <button
            type="button"
            className="link"
            disabled={pendingTrade}
            onClick={() => requestTrade(id)}
          >
            {pendingTrade
              ? `Pedido já enviado para ${partner.name}`
              : `Pedir para ${partner.name} fazer`}
          </button>
        )}
        {isRecurring(t) && (
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
        )}
      </div>
    </Sheet>
  );
}
