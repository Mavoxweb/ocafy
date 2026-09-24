"use client";

import { AvatarFace } from "@/components/ui/avatar";
import { Bar, Group, Panel } from "@/components/ui/primitives";
import { removeCompletion, toggleReaction } from "@/lib/actions";
import {
  CATEGORY_NAMES,
  REACTIONS,
  type ReactionKey,
  TASK_MAP,
} from "@/lib/catalog";
import {
  addDays,
  capitalize,
  dayKey,
  fmtTime,
  fromKey,
  mondayKey,
  relDay,
} from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  achievements,
  activeRecurring,
  activeRoutine,
  currentMember,
  derive,
  levelOf,
  memberById,
  memberBySlot,
  ptsSince,
  streaks,
  taskStatus,
  taskTitle,
  weeklyGoal,
  xpOf,
} from "@/lib/selectors";
import type { Slot } from "@/lib/store";
import { useAppState } from "@/lib/store";

/* ---------- desafio da semana ---------- */
export function WeeklyDuel() {
  const s = useAppState();
  const now = useNow();
  const [a, b] = [memberBySlot(s, "a"), memberBySlot(s, "b")];
  const mk = mondayKey(now);
  const A = a ? ptsSince(s, a.id, mk) : 0;
  const B = b ? ptsSince(s, b.id, mk) : 0;
  const goal = weeklyGoal(s, now);
  const lead =
    A === B
      ? "Empatados — bora desempatar"
      : `${(A > B ? a : b)?.name} está na frente por ${Math.abs(A - B)} XP`;

  if (!b) {
    return (
      <>
        <h2>
          Sua semana<small>desde segunda</small>
        </h2>
        <Panel>
          <div className="duel" style={{ gridTemplateColumns: "1fr" }}>
            <div>
              <span className="tag a">{a?.name}</span>
              <div className="v mt-2">{A}</div>
            </div>
          </div>
          <p className="meta text-center">
            O desafio da dupla começa quando a outra pessoa entrar na casa.
          </p>
        </Panel>
      </>
    );
  }

  return (
    <>
      <h2>
        Desafio da semana<small>desde segunda</small>
      </h2>
      <Panel>
        <div className="duel">
          <div>
            <span className="tag a">{a?.name}</span>
            <div className="v mt-2">{A}</div>
          </div>
          <div className="vs">×</div>
          <div>
            <span className="tag b">{b?.name}</span>
            <div className="v mt-2">{B}</div>
          </div>
        </div>
        <div className="split" style={{ height: 12, marginTop: 14 }}>
          <div
            className="pa"
            style={{
              width: `${A + B ? (A / (A + B)) * 100 : 50}%`,
              padding: 0,
            }}
          />
          <div
            className="pb"
            style={{
              width: `${A + B ? (B / (A + B)) * 100 : 50}%`,
              padding: 0,
            }}
          />
        </div>
        <p className="meta text-center">
          {lead}. Somando: {A + B} XP juntos.
        </p>
        <div className="mt-3">
          <div className="flex items-baseline justify-between text-[0.82rem] font-bold">
            <span>
              {goal.isReached ? "🏆 Dupla implacável!" : "Meta da dupla"}
            </span>
            <span className="text-muted">
              {goal.currentXp} / {goal.targetXp} XP
            </span>
          </div>
          <div className="mt-1.5">
            <Bar pct={goal.progressPercent} />
          </div>
          <p className="meta">
            {goal.isReached
              ? `Meta batida: +${goal.coinsReward} moedas para cada um.`
              : `Bata a meta e ganhe +${goal.coinsReward} moedas cada.`}
          </p>
        </div>
      </Panel>
      <div className="lvcards">
        {s.members.map((m) => {
          const L = levelOf(xpOf(s, m.id));
          return (
            <div key={m.id} className="stat">
              <span className={`tag ${m.slot}`}>{m.name}</span>
              <div className="lvn mt-2.5">Nv {L.level}</div>
              <div className="k">
                {L.name} · {xpOf(s, m.id)} XP
              </div>
              <div className={`xpbar ${m.slot}`}>
                <i
                  style={{
                    width: `${Math.round((L.xpInCurrentLevel / L.xpForNextLevel) * 100)}%`,
                  }}
                />
              </div>
              <div className="k">
                faltam {L.xpForNextLevel - L.xpInCurrentLevel} XP
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

/* ---------- feed social ---------- */
export function Feed() {
  const s = useAppState();
  const now = useNow();
  const me = currentMember(s);
  const items = derive(s).entries.slice(0, 20);

  return (
    <>
      <h2>
        Feed da casa<small>últimas conquistas</small>
      </h2>
      {items.length ? (
        <Group>
          {items.map((e) => {
            const t = TASK_MAP[e.taskId];
            const who = memberById(s, e.who);
            const mine = s.reactions.filter((r) => r.completionId === e.id);
            return (
              <article key={e.id} className="feed-item">
                <span className={`pav ${who?.slot ?? "a"}`}>
                  <AvatarFace member={who} />
                </span>
                <div className="min-w-0">
                  <div className="text-[0.95rem] leading-snug">
                    <b>{who?.name ?? "Alguém"}</b> fez{" "}
                    <b>{t ? taskTitle(s, t) : e.taskId}</b>
                    {e.note ? (
                      <span className="text-muted"> — {e.note}</span>
                    ) : null}
                  </div>
                  <div className="meta">
                    {capitalize(relDay(fromKey(e.dateKey), now))} ·{" "}
                    {fmtTime(new Date(e.at))} ·{" "}
                    <span className="font-bold text-accent-strong">
                      +{e.pts} XP
                    </span>
                  </div>
                  <div className="reacts">
                    {(Object.keys(REACTIONS) as ReactionKey[]).map((k) => {
                      const list = mine.filter((r) => r.emoji === k);
                      const pressed = list.some((r) => r.memberId === me?.id);
                      return (
                        <button
                          type="button"
                          key={k}
                          className="react"
                          aria-pressed={pressed}
                          aria-label={`${REACTIONS[k].label}${list.length ? `, ${list.length}` : ""}`}
                          onClick={() => toggleReaction(e.id, k)}
                        >
                          <span aria-hidden="true">{REACTIONS[k].emoji}</span>
                          {list.length > 0 && <span>{list.length}</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </article>
            );
          })}
        </Group>
      ) : (
        <p className="empty">
          Nada por aqui ainda. Cada tarefa registrada aparece no feed.
        </p>
      )}
    </>
  );
}

/* ---------- conquistas ---------- */
export function Achievements() {
  const s = useAppState();
  const now = useNow();
  const list = achievements(s, now);
  const n = list.filter((b) => b.unlocked).length;
  const sk = streaks(s, now);

  return (
    <>
      <h2>
        Conquistas
        <small>
          {n} de {list.length} · recorde 🔥 {sk.best} dias
        </small>
      </h2>
      <div className="badges">
        {list.map((b) => (
          <div key={b.id} className={`badge stat ${b.unlocked ? "" : "lock"}`}>
            <div className="ic">{b.icon}</div>
            <b>{b.name}</b>
            <span>
              {b.unlocked ? b.description : `${b.description} · ${b.progress}`}
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- relatório ---------- */
export function Report({ days }: { days: 7 | 30 }) {
  const s = useAppState();
  const now = useNow();
  const from = dayKey(addDays(now, -(days - 1)));
  const es = derive(s).entries.filter((e) => e.dateKey >= from);
  const routine = activeRoutine(s);
  const [a, b] = [memberBySlot(s, "a"), memberBySlot(s, "b")];

  const tot: Record<Slot, { n: number; m: number }> = {
    a: { n: 0, m: 0 },
    b: { n: 0, m: 0 },
  };
  const byCat: Record<string, { a: number; b: number }> = {};
  for (const e of es) {
    const t = TASK_MAP[e.taskId];
    const slot = memberById(s, e.who)?.slot;
    if (!t || !slot) continue;
    tot[slot].n++;
    tot[slot].m += t.mins;
    byCat[t.cat] ??= { a: 0, b: 0 };
    byCat[t.cat][slot] += t.mins;
  }
  const allM = tot.a.m + tot.b.m;
  const pa = allM ? Math.round((tot.a.m / allM) * 100) : 50;

  const miss = new Map<string, number>(routine.map((t) => [t.id, 0]));
  const heat: { key: string; n: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const dk = dayKey(addDays(now, -i));
    const done = new Set(
      es.filter((e) => e.dateKey === dk).map((e) => e.taskId),
    );
    const n = routine.filter((t) => done.has(t.id)).length;
    for (const t of routine)
      if (!done.has(t.id)) miss.set(t.id, (miss.get(t.id) ?? 0) + 1);
    heat.push({ key: dk, n });
  }
  const worst = routine
    .map((t) => ({ t, m: miss.get(t.id) ?? 0 }))
    .filter((x) => x.m > 0)
    .sort((x, y) => y.m - x.m)
    .slice(0, 3);
  const late = activeRecurring(s)
    .map((t) => ({ t, st: taskStatus(s, t, now) }))
    .filter((x) => x.st.state === "late")
    .sort((x, y) => (y.st.d ?? 0) - y.st.mx - ((x.st.d ?? 0) - x.st.mx));

  const hours = (m: number) => Math.round((m / 60) * 10) / 10;

  return (
    <>
      <h2>
        Divisão do trabalho<small>{es.length} registros</small>
      </h2>
      {allM ? (
        <>
          <div className="split">
            <div className="pa" style={{ width: `${pa}%` }}>
              {a?.name} {pa}%
            </div>
            <div className="pb" style={{ width: `${100 - pa}%` }}>
              {b?.name} {100 - pa}%
            </div>
          </div>
          <p className="meta">
            {a?.name}: {tot.a.n} tarefas, ~{hours(tot.a.m)} h · {b?.name}:{" "}
            {tot.b.n} tarefas, ~{hours(tot.b.m)} h. Medido em minutos estimados,
            não em número de tarefas.
          </p>
          <Panel>
            {Object.entries(byCat).map(([c, v]) => {
              const sum = v.a + v.b;
              return (
                <div key={c} className="cat">
                  <span>
                    {CATEGORY_NAMES[c as keyof typeof CATEGORY_NAMES] ?? c}
                  </span>
                  <div className="cbar">
                    <i
                      className="pa"
                      style={{ width: `${(v.a / sum) * 100}%` }}
                    />
                    <i
                      className="pb"
                      style={{ width: `${(v.b / sum) * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </Panel>
        </>
      ) : (
        <p className="empty">Ainda não há registros neste período.</p>
      )}

      <h2>Constância das rotinas diárias</h2>
      <Panel>
        <div className="heat">
          {heat.map((h) => (
            <i
              key={h.key}
              title={`${h.key}: ${h.n} de ${routine.length}`}
              style={{
                background: `color-mix(in srgb, var(--fresh) ${routine.length ? Math.round((h.n / routine.length) * 100) : 0}%, var(--soft))`,
              }}
            />
          ))}
        </div>
        <p className="meta">
          Cada quadrado é um dia; mais verde = mais itens da manhã e da noite
          feitos.
        </p>
      </Panel>

      {worst.length > 0 && (
        <>
          <h2>Onde a rotina está falhando</h2>
          <Group>
            {worst.map((x) => (
              <div key={x.t.id} className="logrow">
                <span>{taskTitle(s, x.t)}</span>
                <span className="lbl lbl-late">
                  faltou em {x.m} de {days} dias
                </span>
              </div>
            ))}
          </Group>
        </>
      )}

      {late.length > 0 && (
        <>
          <h2>
            Atrasadas agora<small>{late.length}</small>
          </h2>
          <Group>
            {late.map((x) => (
              <div key={x.t.id} className="logrow">
                <div>
                  <div>{taskTitle(s, x.t)}</div>
                  <div className="meta">
                    Última vez: {memberById(s, x.st.last?.who)?.name}, há{" "}
                    {x.st.d} dias
                  </div>
                </div>
                <span className="lbl lbl-late">
                  +{(x.st.d ?? 0) - x.st.mx}d
                </span>
              </div>
            ))}
          </Group>
        </>
      )}

      <Panel className="mt-[18px]">
        <b>Revisão de domingo (15 min, juntos)</b>
        <p className="meta">
          Olhem esta tela sem procurar culpado: o que atrasou foi falta de
          tempo, de dia definido ou de dono? Ajustem a divisão ou a frequência —
          o método se adapta à casa, não o contrário.
        </p>
      </Panel>
    </>
  );
}

/* ---------- registros (com desfazer) ---------- */
export function EntryLog() {
  const s = useAppState();
  const now = useNow();
  const entries = derive(s).entries.slice(0, 60);
  let lastDay = "";

  if (!entries.length) return <p className="empty">Nada registrado ainda.</p>;
  return (
    <Group>
      {entries.map((e) => {
        const t = TASK_MAP[e.taskId];
        const header =
          e.dateKey !== lastDay
            ? capitalize(relDay(fromKey(e.dateKey), now))
            : null;
        lastDay = e.dateKey;
        const who = memberById(s, e.who);
        return (
          <div key={e.id}>
            {header && <div className="dayh">{header}</div>}
            <div className="logrow">
              <div>
                <div>
                  {t ? taskTitle(s, t) : e.taskId}
                  {e.note ? ` — ${e.note}` : ""}
                </div>
                <div className="meta">
                  {fmtTime(new Date(e.at))} · +{e.pts} XP
                </div>
              </div>
              <div className="mbtns">
                <span className={`tag ${who?.slot ?? "a"}`}>{who?.name}</span>
                <button
                  type="button"
                  className="x-btn"
                  aria-label="Apagar registro"
                  onClick={() => {
                    if (confirm("Apagar este registro?"))
                      removeCompletion(e.id);
                  }}
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </Group>
  );
}
