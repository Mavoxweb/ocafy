import {
  type Achievement,
  type AgeBand,
  type CompletionEntry,
  type Kid,
  type LevelInfo,
  type Meal,
  PROTEIN_MAP,
  PSEUDO_TASKS,
  type PlannedTask,
  ROOM_NAMES,
  type RoomKind,
  type TaskStatusState,
  ageAtLeast,
  bagsPerLitterChange,
  calculateDefrostAlert,
  calculateLevel,
  calculatePoints,
  calculateTaskStatus,
  calculateWeeklyGoalProgress,
  computeCoins,
  daysBetween,
  generatePlan,
  getMealTime,
  parseTaskKey,
  templateOfKey,
} from "@ocafy/core";
import { OFFICE_GOALS } from "./catalog";
import { addDays, dayKey, fmtTime, fromKey, mondayKey, relDay } from "./dates";
import type { AppState, MealRecord, Member, Slot } from "./store";

/* ================= derivados em cache ================= */

interface Derived {
  entries: CompletionEntry[]; // mais recentes primeiro
  lastByTask: Map<string, CompletionEntry>;
  dayMap: Map<string, Set<string>>;
  xp: Map<string, number>;
}

const cache = new WeakMap<AppState, Derived>();

export function derive(s: AppState): Derived {
  const hit = cache.get(s);
  if (hit) return hit;
  const entries = [...s.completions].sort((a, b) => (a.at < b.at ? 1 : -1));
  const lastByTask = new Map<string, CompletionEntry>();
  const dayMap = new Map<string, Set<string>>();
  const xp = new Map<string, number>();
  for (const e of entries) {
    if (!lastByTask.has(e.taskId)) lastByTask.set(e.taskId, e);
    let set = dayMap.get(e.dateKey);
    if (!set) {
      set = new Set();
      dayMap.set(e.dateKey, set);
    }
    set.add(e.taskId);
    xp.set(e.who, (xp.get(e.who) ?? 0) + e.pts);
  }
  const d = { entries, lastByTask, dayMap, xp };
  cache.set(s, d);
  return d;
}

/* ================= pessoas ================= */

export const memberById = (s: AppState, id: string | null | undefined) =>
  s.members.find((m) => m.id === id);

export const memberName = (s: AppState, id: string | null | undefined) =>
  memberById(s, id)?.name ?? "Alguém";

export const currentMember = (s: AppState): Member | undefined =>
  memberById(s, s.meId) ?? s.members[0];

/** Adultos com conta (quem pode aprovar, trocar tarefas e entrar por convite). */
export const adultsOf = (s: AppState): Member[] =>
  s.members.filter((m) => m.kind === "account");

/** Perfis de criança. */
export const childrenOf = (s: AppState): Member[] =>
  s.members.filter((m) => m.kind === "profile");

export const kidsOf = (s: AppState): Kid[] =>
  childrenOf(s)
    .filter((m): m is Member & { ageBand: AgeBand } => !!m.ageBand)
    .map((m) => ({ id: m.id, ageBand: m.ageBand }));

/** Outros adultos da casa (nunca crianças). */
export const otherAdults = (
  s: AppState,
  id: string | null | undefined,
): Member[] => adultsOf(s).filter((m) => m.id !== id);

/** A outra pessoa da casa (no modo Casal). Com vários adultos, o primeiro. */
export const partnerOf = (s: AppState, id: string | null | undefined) =>
  otherAdults(s, id)[0];

/** Quem cuida da tarefa (se alguém foi atribuído). */
export const assigneeOf = (s: AppState, taskId: string): Member | undefined => {
  const id = s.assignments[taskId];
  return id ? memberById(s, id) : undefined;
};

/** A criança tem idade para a tarefa? (adultos sempre podem) */
export const suitableFor = (t: Task, m: Member): boolean =>
  m.kind === "account" ||
  !t.suitableFrom ||
  (!!m.ageBand && ageAtLeast(m.ageBand, t.suitableFrom));

/** Máximo de adultos com conta que o modo permite. */
export const ADULT_LIMIT = { solo: 1, couple: 2, family: 4 } as const;

export const memberBySlot = (s: AppState, slot: Slot) =>
  s.members.find((m) => m.slot === slot);

/* ================= tarefas ================= */

/** Tarefa da casa (do plano) ou gerada por ações do app (descongelar, cozinhar, escritório). */
export type Task = PlannedTask;

export interface Plan {
  list: PlannedTask[];
  map: Map<string, PlannedTask>;
  routine: PlannedTask[];
  recurring: PlannedTask[];
}

const planCache = new WeakMap<AppState, Plan>();
let lastPlanKey = "";
let lastPlan: Plan | null = null;

/**
 * Plano de tarefas da casa: o mesmo cálculo do servidor (motor de rotinas do core) a partir do
 * perfil, cômodos e pets. Em cache por estado e reaproveitado enquanto a entrada não muda.
 */
export function planOf(s: AppState): Plan {
  const hit = planCache.get(s);
  if (hit) return hit;
  const kids = kidsOf(s);
  const key = JSON.stringify([s.profile, s.rooms, s.pets, kids]);
  if (!lastPlan || key !== lastPlanKey) {
    const list = generatePlan({
      profile: s.profile,
      rooms: s.rooms,
      pets: s.pets,
      kids,
    });
    lastPlan = {
      list,
      map: new Map(list.map((t) => [t.id, t])),
      routine: list.filter((t) => t.kind === "routine"),
      recurring: list.filter((t) => t.kind === "recurring"),
    };
    lastPlanKey = key;
  }
  planCache.set(s, lastPlan);
  return lastPlan;
}

const PSEUDO = new Map<string, Task>(
  PSEUDO_TASKS.map((p) => [
    p.id,
    {
      id: p.id,
      templateId: p.id,
      kind: "routine",
      t: p.t,
      room: p.room,
      roomLabel: ROOM_NAMES[p.room],
      cat: p.cat,
      mins: p.mins,
      min: 1,
      max: 1,
      how: "",
      level: "core",
    },
  ]),
);

/** Tarefa que já não está no plano (ex.: o pet saiu), mas continua no histórico. */
function orphanTask(id: string): Task | undefined {
  const tpl = templateOfKey(id);
  if (!tpl) return undefined;
  return {
    id,
    templateId: tpl.id,
    kind: tpl.kind,
    ...(tpl.block ? { r: tpl.block } : {}),
    t: tpl.title
      .replace(/\{(pet|room)\}/g, "")
      .replace(/\s+/g, " ")
      .replace(/\s+—\s*$/, "")
      .trim(),
    room: "casa",
    roomLabel: "Casa toda",
    cat: tpl.cat,
    mins: tpl.mins,
    min: tpl.min,
    max: tpl.max,
    how: tpl.how,
    level: tpl.level,
  };
}

export const taskOf = (s: AppState, id: string): Task | undefined =>
  planOf(s).map.get(id) ?? PSEUDO.get(id) ?? orphanTask(id);

/** Quantas vezes um modelo de tarefa foi feito (somando todos os cômodos/pets). */
export const templateCount = (s: AppState, templateId: string): number =>
  derive(s).entries.filter(
    (e) => parseTaskKey(e.taskId).templateId === templateId,
  ).length;

export const hasPetOf = (s: AppState, species: string) =>
  s.pets.some((p) => p.species === species);

export function taskTitle(s: AppState, t: Task): string {
  const a = memberBySlot(s, "a")?.name ?? "Pessoa 1";
  const b = memberBySlot(s, "b")?.name ?? "parceiro(a)";
  return t.t.replace("{A}", a).replace("{B}", b);
}

export const isRecurring = (t: Task) => t.kind === "recurring";
export const isRoutine = (t: Task) => t.kind === "routine" && !!t.r;

export function minMax(s: AppState, t: Task): [number, number] {
  if (t.id === "area_troca") return [s.litter.minDays, s.litter.maxDays];
  if (!isRecurring(t)) return [1, 1];
  const o = s.overrides[t.id] ?? {};
  return [o.min ?? t.min, o.max ?? t.max];
}

export const isOff = (s: AppState, t: Task) => !!s.overrides[t.id]?.off;

export const activeRoutine = (s: AppState): Task[] => planOf(s).routine;

/** Recorrentes da casa (inclui pausadas). */
export const recurringInHouse = (s: AppState): Task[] => planOf(s).recurring;

export const activeRecurring = (s: AppState): Task[] =>
  recurringInHouse(s).filter((t) => !isOff(s, t));

export interface TaskStat {
  state: TaskStatusState;
  d: number | null; // dias desde a última vez
  mn: number;
  mx: number;
  last: CompletionEntry | null;
}

export function taskStatus(s: AppState, t: Task, now: Date): TaskStat {
  const [mn, mx] = minMax(s, t);
  const last = derive(s).lastByTask.get(t.id) ?? null;
  const st = calculateTaskStatus(mn, mx, last?.at ?? null, now);
  return { state: st.state, d: st.daysSinceLast, mn, mx, last };
}

export function doneToday(s: AppState, id: string, now: Date): boolean {
  const last = derive(s).lastByTask.get(id);
  return !!last && daysBetween(new Date(last.at), now) === 0;
}

export const STATUS_LABEL: Record<TaskStatusState, string> = {
  ok: "Em dia",
  due: "Pode fazer",
  late: "Atrasada",
  nunca: "Sem registro",
};

export function statusLabel(st: TaskStat): string {
  if (st.state === "late" && st.d != null) return `Atrasada ${st.d - st.mx}d`;
  return STATUS_LABEL[st.state];
}

/** XP de uma tarefa registrada agora (`backdated` = registro de outro dia, sem bônus). */
export function pointsFor(
  s: AppState,
  t: Task,
  now: Date,
  backdated: boolean,
): { pts: number; bonus: boolean } {
  if (backdated) return { pts: calculatePoints(t.mins, false), bonus: false };
  let extra = 0;
  let windowBonus = false;
  if (isRecurring(t) && taskStatus(s, t, now).state === "due")
    windowBonus = true;
  if (isRoutine(t)) {
    if (t.r === "manha" && now.getHours() < 11) extra = 3;
    if (t.r === "noite" && now.getHours() >= 18) extra = 3;
  }
  return {
    pts: calculatePoints(t.mins, windowBonus) + extra,
    bonus: windowBonus || extra > 0,
  };
}

/* ================= cômodos ================= */

export interface RoomSummary {
  cls: "ok" | "due" | "late";
  text: string;
  ok: number;
  total: number;
}

export function roomSummary(s: AppState, room: string, now: Date): RoomSummary {
  const ts = activeRecurring(s).filter((t) => t.room === room);
  const sts = ts.map((t) => taskStatus(s, t, now).state);
  const ok = sts.filter((x) => x === "ok").length;
  const late = sts.filter((x) => x === "late").length;
  const due = sts.length - ok - late;
  return {
    cls: late ? "late" : due ? "due" : "ok",
    text: late
      ? `${late} atrasada${late > 1 ? "s" : ""}`
      : due
        ? `${due} para fazer`
        : "Tudo em dia",
    ok,
    total: ts.length,
  };
}

/** % das recorrentes ativas (já registradas) que não estão atrasadas. */
export function houseHealth(s: AppState, now: Date): number {
  const sts = activeRecurring(s)
    .map((t) => taskStatus(s, t, now).state)
    .filter((x) => x !== "nunca");
  return sts.length
    ? Math.round((sts.filter((x) => x !== "late").length / sts.length) * 100)
    : 0;
}

export type RoomIconKey = RoomKind | "casa" | "pets";

export interface RoomGroup {
  slug: string;
  label: string;
  icon: RoomIconKey;
}

/** Cômodos (e "Casa toda"/"Pets") que têm tarefas no plano, na ordem de exibição. */
export function roomGroups(s: AppState): RoomGroup[] {
  const used = new Set(planOf(s).list.map((t) => t.room));
  const out: RoomGroup[] = s.rooms
    .filter((r) => used.has(r.slug))
    .map((r) => ({ slug: r.slug, label: r.label, icon: r.kind }));
  if (used.has("casa"))
    out.push({ slug: "casa", label: "Casa toda", icon: "casa" });
  if (used.has("pets")) out.push({ slug: "pets", label: "Pets", icon: "pets" });
  return out;
}

/* ================= refeições ================= */

export const toCoreMeal = (m: MealRecord): Meal => ({
  id: m.id,
  date: m.date,
  slot: m.slot,
  dish: m.dish,
  protein: m.protein,
  cooked: !!m.cookedBy,
  pulled: !!m.pulledBy,
});

export const mealTime = (m: MealRecord) => getMealTime(m.date, m.slot);

export interface MealAlertInfo {
  level: "ok" | "due" | "late";
  text: string;
  pullTime: Date;
}

export function mealAlert(m: MealRecord, now: Date): MealAlertInfo | null {
  const a = calculateDefrostAlert(toCoreMeal(m), now);
  if (!a?.pullTime) return null;
  const when = `${relDay(a.pullTime, now)} às ${fmtTime(a.pullTime)}`;
  let text: string;
  if (now > mealTime(m)) text = "Passou do horário sem retirar";
  else if (now >= a.pullTime) text = `Retirar agora (era ${when})`;
  else text = `Retirar ${when}`;
  return { level: a.level, text, pullTime: a.pullTime };
}

export const proteinName = (key: string) => PROTEIN_MAP[key]?.name ?? key;

/* ================= gamificação ================= */

export const xpOf = (s: AppState, memberId: string): number =>
  derive(s).xp.get(memberId) ?? 0;

export const levelOf = (xp: number): LevelInfo => calculateLevel(xp);

export function ptsSince(
  s: AppState,
  memberId: string,
  fromDayKey: string,
): number {
  return derive(s)
    .entries.filter((e) => e.who === memberId && e.dateKey >= fromDayKey)
    .reduce((a, e) => a + e.pts, 0);
}

function routinePct(s: AppState, dk: string): number {
  const routine = activeRoutine(s);
  if (!routine.length) return 0;
  const set = derive(s).dayMap.get(dk);
  if (!set) return 0;
  return routine.filter((t) => set.has(t.id)).length / routine.length;
}

export function streaks(s: AppState, now: Date): { cur: number; best: number } {
  const key = (i: number) => dayKey(addDays(now, -i));
  let best = 0;
  let run = 0;
  for (let i = 59; i >= 0; i--) {
    if (routinePct(s, key(i)) >= 0.7) {
      run++;
      best = Math.max(best, run);
    } else if (i > 0) run = 0;
  }
  let cur = 0;
  let i = routinePct(s, key(0)) >= 0.7 ? 0 : 1;
  while (i < 60 && routinePct(s, key(i)) >= 0.7) {
    cur++;
    i++;
  }
  return { cur, best: Math.max(best, cur) };
}

export function blockDone(
  s: AppState,
  r: "manha" | "noite",
  now: Date,
): boolean {
  const items = activeRoutine(s).filter((t) => t.r === r);
  return items.length > 0 && items.every((t) => doneToday(s, t.id, now));
}

/** XP somado da dupla na semana (desde segunda) — base do desafio semanal. */
export function weeklyXp(s: AppState, now: Date): number {
  const mk = mondayKey(now);
  return derive(s)
    .entries.filter((e) => e.dateKey >= mk)
    .reduce((a, e) => a + e.pts, 0);
}

export const weeklyGoal = (s: AppState, now: Date) =>
  calculateWeeklyGoalProgress(weeklyXp(s, now));

export function achievements(s: AppState, now: Date): Achievement[] {
  const { entries, dayMap } = derive(s);
  const count = (id: string) => templateCount(s, id);
  const sk = streaks(s, now);
  const routine = activeRoutine(s);
  const nights = new Set(
    entries.filter((e) => e.taskId === "n_louca").map((e) => e.dateKey),
  ).size;
  const morning = routine.filter((t) => t.r === "manha");
  const morn =
    morning.length > 0 &&
    [...dayMap.values()].some((set) => morning.every((t) => set.has(t.id)));
  const w7from = dayKey(addDays(now, -6));
  const w7 = entries.filter((e) => e.dateKey >= w7from);
  const [ma, mb] = [memberBySlot(s, "a"), memberBySlot(s, "b")];
  const wa = w7.filter((e) => e.who === ma?.id).reduce((a, e) => a + e.pts, 0);
  const wt = w7.reduce((a, e) => a + e.pts, 0);
  const level = Math.max(
    ...[ma, mb].map((m) => (m ? levelOf(xpOf(s, m.id)).level : 1)),
  );
  const rec = activeRecurring(s);
  const health = houseHealth(s, now);
  const balanced =
    w7.length >= 20 && wt > 0 && wa / wt >= 0.4 && wa / wt <= 0.6;

  const pr = (v: number, n: number) => ({
    unlocked: v >= n,
    progress: `${Math.min(v, n)}/${n}`,
  });

  return [
    {
      id: "primeiro",
      icon: "👣",
      name: "Primeiro passo",
      description: "Registrar a primeira tarefa",
      ...pr(entries.length, 1),
    },
    {
      id: "manha",
      icon: "☀️",
      name: "Manhã perfeita",
      description: "Toda a rotina da manhã num dia",
      unlocked: morn,
      progress: morn ? "1/1" : "0/1",
    },
    {
      id: "pia",
      icon: "🍽️",
      name: "Pia vazia",
      description: "Louça da noite em 7 dias",
      ...pr(nights, 7),
    },
    {
      id: "fogo",
      icon: "🔥",
      name: "Sequência de 7",
      description: "7 dias seguidos com 70% da rotina",
      ...pr(sk.best, 7),
    },
    {
      id: "fogo30",
      icon: "☄️",
      name: "Imparável",
      description: "30 dias seguidos",
      ...pr(sk.best, 30),
    },
    {
      id: "areia",
      icon: "🐾",
      name: "Guardião das caixas",
      description: "3 trocas completas de areia",
      ...pr(count("area_troca"), 3),
    },
    {
      id: "gelo",
      icon: "🧊",
      name: "Nada de última hora",
      description: "Retirar proteína 5 vezes",
      ...pr(count("desc"), 5),
    },
    {
      id: "chef",
      icon: "👨‍🍳",
      name: "Meal prep",
      description: "Cozinhar a semana 2 vezes",
      ...pr(count("mealprep"), 2),
    },
    {
      id: "banho",
      icon: "🛁",
      name: "Banheiro brilhando",
      description: "4 faxinas completas",
      ...pr(count("banheiro"), 4),
    },
    {
      id: "dupla",
      icon: "🤝",
      name: "Dupla equilibrada",
      description: "Semana dividida entre 40% e 60%",
      unlocked: balanced,
      progress:
        w7.length >= 20 && wt > 0
          ? `${Math.round((wa / wt) * 100)}%`
          : `${w7.length}/20`,
    },
    {
      id: "casa",
      icon: "🏡",
      name: "Casa em dia",
      description: "Nenhuma tarefa atrasada",
      unlocked:
        rec.every((t) => taskStatus(s, t, now).state !== "nunca") &&
        health === 100,
      progress: `${health}%`,
    },
    {
      id: "cem",
      icon: "💯",
      name: "Cem tarefas",
      description: "100 tarefas registradas",
      ...pr(entries.length, 100),
    },
    {
      id: "nv5",
      icon: "⭐",
      name: "Nível 5",
      description: "Alguém chegar ao nível 5",
      ...pr(level, 5),
    },
  ];
}

/* ================= moedas & loja ================= */

/** Mesma regra usada pelo servidor para validar resgates (@ocafy/core). */
export const coinsOf = (s: AppState, memberId: string): number =>
  computeCoins(
    s.completions.map((c) => ({ who: c.who, pts: c.pts, dateKey: c.dateKey })),
    s.purchases,
    memberId,
  ).balance;

/* ================= gatos ================= */

export const litterBagsPerChange = (s: AppState) =>
  bagsPerLitterChange({ ...s.litter, currentStock: s.litterStock ?? 0 });

/* ================= escritório ================= */

export const officeDoneCount = (s: AppState) =>
  OFFICE_GOALS.filter((g) => s.office.done[g.id]).length;

export const officeCurrent = (s: AppState) =>
  OFFICE_GOALS.find((g) => !s.office.done[g.id]);

export const officeStepDone = (s: AppState, goalId: string, i: number) =>
  !!s.office.steps[goalId]?.[i];

export const officeStepsPct = (s: AppState, goalId: string | undefined) => {
  const g = OFFICE_GOALS.find((x) => x.id === goalId);
  if (!g) return 100;
  return Math.round(
    (g.steps.filter((_, i) => officeStepDone(s, g.id, i)).length /
      g.steps.length) *
      100,
  );
};

export function officeWeek(s: AppState, now: Date): number {
  return s.office.start
    ? Math.floor(daysBetween(fromKey(s.office.start), now) / 7) + 1
    : 0;
}

export function officeStatus(
  s: AppState,
  now: Date,
): { cls: "nunca" | "ok" | "due" | "late"; text: string } {
  const n = officeDoneCount(s);
  const w = officeWeek(s, now);
  if (!s.office.start) return { cls: "nunca", text: "Ainda não começou" };
  if (n >= OFFICE_GOALS.length) return { cls: "ok", text: "Concluído" };
  if (n >= w) return { cls: "ok", text: "Adiantado" };
  if (n === w - 1) return { cls: "due", text: "No ritmo" };
  const b = w - 1 - n;
  return { cls: "late", text: `${b} semana${b > 1 ? "s" : ""} atrás` };
}

/* ================= social ================= */
