"use client";

import { InvitePanel } from "@/components/shell/invite-panel";
import { AvatarFace } from "@/components/ui/avatar";
import { IconCheck, IconFlame, RoomIcon } from "@/components/ui/icons";
import { Group } from "@/components/ui/primitives";
import { completeTask, pullMeal, respondTrade, undoToday } from "@/lib/actions";
import { OFFICE_GOALS, SLOT_INFO } from "@/lib/catalog";
import { dayKey, fromKey, relDay } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  ADULT_LIMIT,
  type RoomGroup,
  activeRecurring,
  activeRoutine,
  adultsOf,
  currentMember,
  doneToday,
  houseHealth,
  levelOf,
  mealAlert,
  memberById,
  officeCurrent,
  officeDoneCount,
  officeStatus,
  officeStepsPct,
  officeWeek,
  proteinName,
  ptsSince,
  roomGroups,
  roomSummary,
  streaks,
  taskOf,
  taskStatus,
  taskTitle,
  xpOf,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { openSheet } from "@/lib/ui";
import Link from "next/link";
import { useEffect, useState } from "react";

/* ---------- herói: anel de progresso da rotina ---------- */
export function TodayHero() {
  const s = useAppState();
  const now = useNow();
  const routine = activeRoutine(s);
  const done = routine.filter((t) => doneToday(s, t.id, now)).length;
  const pct = routine.length ? Math.round((done / routine.length) * 100) : 0;
  const sk = streaks(s, now);

  return (
    <div className="hero">
      <span className="hico">
        <IconFlame />
      </span>
      <div className="htx">
        <b>{pct}%</b>
        <span>
          Rotina de hoje · {done} de {routine.length}
        </span>
      </div>
      <span className="hpill">
        🔥 {sk.cur} {sk.cur === 1 ? "dia" : "dias"}
      </span>
      <div className="hbar">
        <i style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/* ---------- nível e XP de cada pessoa ---------- */
export function PeopleCards() {
  const s = useAppState();
  const now = useNow();
  const me = currentMember(s);
  const td = dayKey(now);

  return (
    <div className="people">
      {s.members.map((m) => {
        const L = levelOf(xpOf(s, m.id));
        return (
          <div key={m.id} className={`person ${m.id === me?.id ? "me" : ""}`}>
            <span className={`pav ${m.slot}`}>
              <AvatarFace member={m} />
            </span>
            <div className="pinfo">
              <b>{m.name}</b>
              <span>
                Nv {L.level} · {L.name}
              </span>
              <div className={`xpbar ${m.slot}`}>
                <i
                  style={{
                    width: `${Math.round((L.xpInCurrentLevel / L.xpForNextLevel) * 100)}%`,
                  }}
                />
              </div>
            </div>
            <span className="ptoday">+{ptsSince(s, m.id, td)}</span>
          </div>
        );
      })}
    </div>
  );
}

/* ---------- convite (enquanto a casa tem só uma pessoa) ---------- */
export function InviteCard() {
  const s = useAppState();
  const limit = ADULT_LIMIT[s.profile.mode as keyof typeof ADULT_LIMIT] ?? 2;
  // Solo nunca convida; Casal até 2 adultos; Família até 4.
  if (s.profile.mode === "solo" || adultsOf(s).length >= limit) return null;
  return <InvitePanel />;
}

/* ---------- convite para ligar os lembretes (uma vez; dispensável) ---------- */
export function ReminderNudge() {
  const s = useAppState();
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    try {
      setHidden(localStorage.getItem("ocafy-nudge-reminders") === "1");
    } catch {
      setHidden(false);
    }
  }, []);
  const n = s.notifications;
  if (hidden || !n.pushConfigured || n.prefs.enabled) return null;
  return (
    <div className="panel flex items-center gap-3">
      <span aria-hidden="true" className="text-[1.6rem]">
        🔔
      </span>
      <div className="min-w-0 flex-1">
        <b className="text-[0.92rem]">Quer lembretes no celular?</b>
        <div className="meta m-0">
          Antes de sair de casa e na hora de retirar a proteína.
        </div>
      </div>
      <Link href="/lembretes" className="btn btn-small">
        Ativar
      </Link>
      <button
        type="button"
        className="x-btn"
        aria-label="Agora não"
        onClick={() => {
          try {
            localStorage.setItem("ocafy-nudge-reminders", "1");
          } catch {}
          setHidden(true);
        }}
      >
        ×
      </button>
    </div>
  );
}

/* ---------- tarefas atribuídas (crianças e as minhas) ---------- */
export function AssignedTasks() {
  const s = useAppState();
  const now = useNow();
  const me = currentMember(s);
  const groups = s.members
    .filter((m) => m.kind === "profile" || m.id === me?.id)
    .map((m) => ({
      m,
      items: Object.entries(s.assignments)
        .filter(([, who]) => who === m.id)
        .map(([key]) => taskOf(s, key))
        .filter((t): t is NonNullable<typeof t> => !!t),
    }))
    .filter((g) => g.items.length > 0);
  if (!groups.length) return null;

  return (
    <>
      {groups.map(({ m, items }) => (
        <section key={m.id}>
          <h2>
            {m.id === me?.id ? "Suas tarefas" : `Tarefas de ${m.name}`}
            <small>{items.length}</small>
          </h2>
          <Group>
            {items.map((t) => {
              const done =
                t.kind === "routine"
                  ? doneToday(s, t.id, now)
                  : taskStatus(s, t, now).state === "ok";
              return (
                <div key={t.id} className={`chk ${done ? "done" : ""}`}>
                  <button
                    type="button"
                    className="box"
                    aria-pressed={done}
                    aria-label={`${done ? "Desfazer" : "Marcar"}: ${taskTitle(s, t)}`}
                    onClick={(e) => {
                      if (done && t.kind === "routine") undoToday(t.id);
                      else if (!done)
                        completeTask(t.id, {
                          rect: e.currentTarget.getBoundingClientRect(),
                        });
                    }}
                  >
                    {done && <IconCheck />}
                  </button>
                  <button
                    type="button"
                    className="tt text-left"
                    style={{ background: "none", border: 0, padding: 0 }}
                    onClick={() => openSheet({ kind: "task", id: t.id })}
                  >
                    {taskTitle(s, t)}
                  </button>
                </div>
              );
            })}
          </Group>
        </section>
      ))}
    </>
  );
}

/* ---------- Projeto Escritório (atalho) ---------- */
export function OfficeShortcut() {
  const s = useAppState();
  const now = useNow();
  const cur = officeCurrent(s);
  if (!cur || !s.profile.officeProject) return null;
  const week = officeWeek(s, now);

  return (
    <Link href="/escritorio" className="projc">
      <span className="ricon pc">
        <RoomIcon room="escritorio" />
      </span>
      <span>
        <span className="meta">
          Projeto Escritório ·{" "}
          {s.office.start ? `semana ${week}` : "não iniciado"} ·{" "}
          {officeDoneCount(s)}/{OFFICE_GOALS.length}
        </span>
        <b>{cur.t}</b>
        <span className="pbar">
          <i style={{ width: `${officeStepsPct(s, cur.id)}%` }} />
        </span>
      </span>
      <span
        className="chev text-[1.7rem] leading-none text-muted"
        aria-hidden="true"
      >
        ›
      </span>
    </Link>
  );
}

/* ---------- carrossel de cômodos ---------- */
export function RoomsCarousel() {
  const s = useAppState();
  const now = useNow();
  const hp = houseHealth(s, now);
  const groups = roomGroups(s);

  return (
    <>
      <h2>
        Cômodos<small>casa {hp}% em dia</small>
      </h2>
      <div className="rooms">
        {s.profile.officeProject && <OfficeCard />}
        {groups.map((g) => (
          <RoomCard key={g.slug} group={g} />
        ))}
      </div>
    </>
  );
}

function OfficeCard() {
  const s = useAppState();
  const now = useNow();
  const n = officeDoneCount(s);
  const st = officeStatus(s, now);
  const cls = st.cls === "late" ? "late" : st.cls === "ok" ? "ok" : "due";
  return (
    <Link href="/escritorio" className={`rcard st-${cls}`}>
      <span className="rtop">
        <span className="rname">Escritório</span>
        <span className="ricon">
          <RoomIcon room="escritorio" />
        </span>
      </span>
      <span className="rbot">
        <span>
          <span className="rbig">
            {n}
            <small>/{OFFICE_GOALS.length}</small>
          </span>
          <span className="rsub">objetivos do escritório</span>
        </span>
        <span className="rpill">
          <i className={`dot d-${st.cls}`} />
          {st.text}
        </span>
      </span>
      <span className="rprog">
        <i
          style={{ width: `${Math.round((n / OFFICE_GOALS.length) * 100)}%` }}
        />
      </span>
    </Link>
  );
}

function RoomCard({ group }: { group: RoomGroup }) {
  const s = useAppState();
  const now = useNow();
  const sum = roomSummary(s, group.slug, now);
  return (
    <Link
      href={`/rotinas?room=${group.slug}`}
      className={`rcard st-${sum.cls}`}
    >
      <span className="rtop">
        <span className="rname">{group.label}</span>
        <span className="ricon">
          <RoomIcon room={group.icon} />
        </span>
      </span>
      <span className="rbot">
        <span>
          <span className="rbig">
            {sum.ok}
            <small>/{sum.total}</small>
          </span>
          <span className="rsub">tarefas em dia</span>
        </span>
        <span className="rpill">
          <i className={`dot d-${sum.cls}`} />
          {sum.text}
        </span>
      </span>
      <span className="rprog">
        <i
          style={{
            width: `${sum.total ? Math.round((sum.ok / sum.total) * 100) : 0}%`,
          }}
        />
      </span>
    </Link>
  );
}

/* ---------- alertas do congelador ---------- */
export function FreezerAlerts() {
  const s = useAppState();
  const now = useNow();
  const alerts = s.meals
    .map((m) => ({ m, a: mealAlert(m, now) }))
    .filter(
      (x): x is { m: typeof x.m; a: NonNullable<typeof x.a> } =>
        !!x.a && x.a.level !== "ok",
    )
    .sort((x, y) => x.a.pullTime.getTime() - y.a.pullTime.getTime());
  if (!alerts.length) return null;

  return (
    <section>
      <h2>Congelador</h2>
      {alerts.map(({ m, a }) => (
        <div key={m.id} className={`alert ${a.level}`}>
          <div>
            <div className="tt">
              {proteinName(m.protein)} — {m.dish || SLOT_INFO[m.slot].name}
            </div>
            <div className="meta">
              {a.text} · {SLOT_INFO[m.slot].name} de{" "}
              {relDay(fromKey(m.date), now)}
            </div>
          </div>
          <button
            type="button"
            className="btn btn-small"
            onClick={(e) =>
              pullMeal(m.id, e.currentTarget.getBoundingClientRect())
            }
          >
            Retirei
          </button>
        </div>
      ))}
      {alerts.some((x) => x.a.level === "late") && (
        <p className="meta">
          Atrasou? Saco bem fechado em água fria, trocando a água a cada 30 min
          — ou micro-ondas no modo descongelar e cozinhar em seguida.
        </p>
      )}
    </section>
  );
}

/* ---------- pedidos de troca recebidos e combinados ---------- */
export function TradeInbox() {
  const s = useAppState();
  const me = currentMember(s);
  if (!me) return null;
  const incoming = s.trades.filter(
    (t) => t.assigneeId === me.id && t.status === "pending",
  );
  const agreed = s.trades.filter(
    (t) => t.assigneeId === me.id && t.status === "accepted",
  );
  const open = agreed.filter((t) => {
    const last = s.completions
      .filter((c) => c.taskId === t.taskId && c.who === me.id)
      .some((c) => c.at > (t.resolvedAt ?? t.createdAt));
    return !last;
  });
  if (!incoming.length && !open.length) return null;

  return (
    <section>
      <h2>Combinados com a dupla</h2>
      <Group>
        {incoming.map((t) => {
          const task = taskOf(s, t.taskId);
          if (!task) return null;
          return (
            <div key={t.id} className="logrow">
              <div>
                <div className="tt">{taskTitle(s, task)}</div>
                <div className="meta">
                  {memberById(s, t.requesterId)?.name} pediu sua ajuda
                </div>
              </div>
              <div className="mbtns">
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => respondTrade(t.id, true)}
                >
                  Aceitar
                </button>
                <button
                  type="button"
                  className="btn btn-small"
                  onClick={() => respondTrade(t.id, false)}
                >
                  Recusar
                </button>
              </div>
            </div>
          );
        })}
        {open.map((t) => {
          const task = taskOf(s, t.taskId);
          if (!task) return null;
          return (
            <div key={t.id} className="logrow">
              <div>
                <div className="tt">{taskTitle(s, task)}</div>
                <div className="meta">Você combinou de fazer</div>
              </div>
              <button
                type="button"
                className="btn btn-small"
                onClick={(e) =>
                  completeTask(t.taskId, {
                    rect: e.currentTarget.getBoundingClientRect(),
                  })
                }
              >
                Feito
              </button>
            </div>
          );
        })}
      </Group>
    </section>
  );
}

/** Tarefas recorrentes ordenadas por urgência (atrasadas → na janela → do dia). */
export function usePriorityList() {
  const s = useAppState();
  const now = useNow();
  const wd = now.getDay();
  const act = activeRecurring(s).map((t) => ({ t, st: taskStatus(s, t, now) }));
  const ratio = (x: (typeof act)[number], over: boolean) =>
    ((x.st.d ?? 0) - (over ? x.st.mx : 0)) / x.st.mx;
  const late = act
    .filter((x) => x.st.state === "late")
    .sort((a, b) => ratio(b, true) - ratio(a, true));
  const due = act
    .filter((x) => x.st.state === "due")
    .sort((a, b) => ratio(b, false) - ratio(a, false));
  const today = act.filter((x) => x.st.state === "nunca" && x.t.day === wd);
  const nunca = act.filter((x) => x.st.state === "nunca").length;
  return { list: [...late, ...due, ...today].map((x) => x.t), nunca };
}
