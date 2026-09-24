"use client";

import { InvitePanel } from "@/components/shell/invite-panel";
import { AvatarFace } from "@/components/ui/avatar";
import { IconFlame, RoomIcon } from "@/components/ui/icons";
import { Group } from "@/components/ui/primitives";
import { completeTask, pullMeal, respondTrade } from "@/lib/actions";
import { OFFICE_GOALS, ROOM_ORDER, SLOT_INFO, TASK_MAP } from "@/lib/catalog";
import { dayKey, fromKey, relDay } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  activeRecurring,
  activeRoutine,
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
  roomSummary,
  streaks,
  taskStatus,
  taskTitle,
  xpOf,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { ROOM_NAMES, type RoomId } from "@ocafy/core";
import Link from "next/link";

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
  if (s.members.length >= 2) return null;
  return <InvitePanel />;
}

/* ---------- Projeto Escritório (atalho) ---------- */
export function OfficeShortcut() {
  const s = useAppState();
  const now = useNow();
  const cur = officeCurrent(s);
  if (!cur || !s.rooms.includes("quarto2")) return null;
  const week = officeWeek(s, now);

  return (
    <Link href="/escritorio" className="projc">
      <span className="ricon pc">
        <RoomIcon room="quarto2" />
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
  const rooms = ROOM_ORDER.filter((r) => s.rooms.includes(r));

  return (
    <>
      <h2>
        Cômodos<small>casa {hp}% em dia</small>
      </h2>
      <div className="rooms">
        {rooms.map((r) => (
          <RoomCard key={r} room={r} />
        ))}
      </div>
    </>
  );
}

function RoomCard({ room }: { room: RoomId }) {
  const s = useAppState();
  const now = useNow();

  if (room === "quarto2") {
    const n = officeDoneCount(s);
    const st = officeStatus(s, now);
    const cls = st.cls === "late" ? "late" : st.cls === "ok" ? "ok" : "due";
    return (
      <Link href="/escritorio" className={`rcard st-${cls}`}>
        <span className="rtop">
          <span className="rname">{ROOM_NAMES[room]}</span>
          <span className="ricon">
            <RoomIcon room={room} />
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

  const sum = roomSummary(s, room, now);
  return (
    <Link href={`/rotinas?room=${room}`} className={`rcard st-${sum.cls}`}>
      <span className="rtop">
        <span className="rname">{ROOM_NAMES[room]}</span>
        <span className="ricon">
          <RoomIcon room={room} />
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
          const task = TASK_MAP[t.taskId];
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
          const task = TASK_MAP[t.taskId];
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
