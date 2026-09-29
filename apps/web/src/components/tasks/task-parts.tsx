"use client";

import {
  IconCheck,
  IconChevron,
  IconClock,
  IconHelp,
} from "@/components/ui/icons";
import { Bar, Group, StatusPill } from "@/components/ui/primitives";
import { completeTask, undoToday } from "@/lib/actions";
import { daysAgoPhrase, fmtTime } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  type Task,
  activeRoutine,
  derive,
  doneToday,
  isOff,
  memberName,
  statusLabel,
  taskStatus,
  taskTitle,
  tradeBadge,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { openSheet } from "@/lib/ui";
import { useState } from "react";

/** Selo compacto: mostra na lista que a tarefa tem um pedido de ajuda em aberto. */
function TradeBadge({ taskId }: { taskId: string }) {
  const s = useAppState();
  const badge = tradeBadge(s, taskId);
  if (!badge) return null;
  return (
    <span className={`trade-badge tb-${badge.kind}`}>
      {badge.kind === "incoming" ? (
        <IconHelp size={13} />
      ) : (
        <IconClock size={13} />
      )}
      {badge.kind === "requested" && `Aguardando ${badge.name}`}
      {badge.kind === "accepted" && `${badge.name} topou ajudar`}
      {badge.kind === "incoming" && `${badge.name} pediu ajuda`}
    </span>
  );
}

/* ---------- checklist da rotina diária ---------- */
export function RoutineBlock({
  block,
  label,
  hint,
  room,
}: {
  block: "manha" | "noite";
  label: string;
  hint?: string;
  room?: string | null;
}) {
  const s = useAppState();
  const now = useNow();
  const items = activeRoutine(s).filter(
    (t) => t.r === block && (!room || t.room === room),
  );
  if (!items.length) return null;
  const n = items.filter((t) => doneToday(s, t.id, now)).length;

  return (
    <section>
      <h2>
        {label}
        <small>
          {n} de {items.length}
          {hint ? ` · ${hint}` : ""}
        </small>
      </h2>
      <Bar pct={Math.round((n / items.length) * 100)} />
      <Group>
        {items.map((t) => (
          <ChecklistItem key={t.id} task={t} />
        ))}
      </Group>
    </section>
  );
}

function ChecklistItem({ task }: { task: Task }) {
  const s = useAppState();
  const now = useNow();
  const done = doneToday(s, task.id, now);
  const last = derive(s).lastByTask.get(task.id);
  const [pop, setPop] = useState(false);
  const title = taskTitle(s, task).replace(
    "das caixas",
    `das ${s.litter.boxes} caixas`,
  );

  return (
    <div className={`chk ${done ? "done" : ""} ${pop ? "pop" : ""}`}>
      <button
        type="button"
        className="box"
        aria-pressed={done}
        aria-label={title}
        onClick={(e) => {
          if (done) undoToday(task.id);
          else {
            completeTask(task.id, {
              rect: e.currentTarget.getBoundingClientRect(),
            });
            setPop(true);
            setTimeout(() => setPop(false), 700);
          }
        }}
      >
        {done && <IconCheck />}
      </button>
      <div className="min-w-0 flex-1">
        <button
          type="button"
          className="tt more text-left"
          style={{ background: "none", border: 0, padding: 0 }}
          onClick={() => openSheet({ kind: "task", id: task.id })}
        >
          <span>{title}</span>
          <IconChevron size={15} className="chev" />
        </button>
        {done && last && (
          <div className="meta">
            {memberName(s, last.who)} às {fmtTime(new Date(last.at))}
          </div>
        )}
        <TradeBadge taskId={task.id} />
      </div>
    </div>
  );
}

/* ---------- tile de prioridade ---------- */
export function TaskTile({ task }: { task: Task }) {
  const s = useAppState();
  const now = useNow();
  const st = taskStatus(s, task, now);
  const title = taskTitle(s, task);

  return (
    <div className="tile">
      <button
        type="button"
        className="tbody"
        onClick={() => openSheet({ kind: "task", id: task.id })}
      >
        <IconChevron size={16} className="chev chev-corner" />
        <StatusPill state={st.state}>{statusLabel(st)}</StatusPill>
        <span className="ttl">{title}</span>
        <span className="meta">
          {task.roomLabel} · {task.mins} min
        </span>
        <TradeBadge taskId={task.id} />
      </button>
      <div className="tfoot">
        <span className="pts">+{5 + task.mins} XP</span>
        <button
          type="button"
          className="cbtn"
          aria-label={`Marcar como feito: ${title}`}
          onClick={(e) =>
            completeTask(task.id, {
              rect: e.currentTarget.getBoundingClientRect(),
            })
          }
        >
          <IconCheck size={22} />
        </button>
      </div>
    </div>
  );
}

/* ---------- linha da lista de recorrentes ---------- */
export function TaskRow({ task }: { task: Task }) {
  const s = useAppState();
  const now = useNow();
  const st = taskStatus(s, task, now);
  const off = isOff(s, task);
  const when =
    st.state === "nunca" || !st.last || st.d == null
      ? ""
      : `${daysAgoPhrase(st.d)} · ${memberName(s, st.last.who)}`;
  const freq = `a cada ${st.mn}${st.mn !== st.mx ? `–${st.mx}` : ""} dias`;
  const late = st.state === "late" && st.d != null ? st.d - st.mx : 0;
  const lbl =
    st.state === "late"
      ? `Atrasada ${late} dia${late > 1 ? "s" : ""}`
      : statusLabel(st);

  return (
    <div className={`task st-${off ? "nunca" : st.state}`}>
      <button
        type="button"
        className="tmain"
        onClick={() => openSheet({ kind: "task", id: task.id })}
      >
        <span className="tt">
          {taskTitle(s, task)}
          <span className="pts">+{5 + task.mins}</span>
        </span>
        <span className="meta">
          <span className={`lbl lbl-${st.state}`}>{lbl}</span>
          {when ? ` · ${when}` : ""} · {freq} · {task.mins} min
        </span>
        <TradeBadge taskId={task.id} />
        <IconChevron size={17} className="chev chev-tmain" />
      </button>
      <button
        type="button"
        className="btn btn-small"
        onClick={(e) =>
          completeTask(task.id, {
            rect: e.currentTarget.getBoundingClientRect(),
          })
        }
      >
        Feito
      </button>
    </div>
  );
}
