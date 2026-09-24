"use client";

import type { CompletionEntry, RoomId } from "@ocafy/core";
import {
  DEFAULT_REWARDS,
  INVENTORY_DEST,
  type InventoryDest,
  OFFICE_GOALS,
  type ReactionKey,
  TASK_MAP,
} from "./catalog";
import { dayKey, fmtTime, mondayKey, relDay, uid } from "./dates";
import { banner, confetti, floatXP, vibrate } from "./fx";
import {
  achievements,
  blockDone,
  coinsOf,
  currentMember,
  levelOf,
  litterBagsPerChange,
  mealAlert,
  memberName,
  officeCurrent,
  officeStepDone,
  officeStepsPct,
  partnerOf,
  pointsFor,
  proteinName,
  taskTitle,
  xpOf,
} from "./selectors";
import {
  type AppState,
  DEFAULT_LITTER,
  type Member,
  type Reward,
  store,
} from "./store";
import { closeSheet, toast } from "./ui";

const get = () => store.getState();

/* ================= onboarding ================= */

export interface SetupInput {
  houseName: string;
  nameA: string;
  nameB: string;
  rooms: RoomId[];
  litter: AppState["litter"];
  litterStock: number | null;
}

export function createHousehold(input: SetupInput) {
  const a: Member = { id: uid(), name: input.nameA.trim(), slot: "a" };
  const b: Member = { id: uid(), name: input.nameB.trim(), slot: "b" };
  const rewards: Reward[] = DEFAULT_REWARDS.map((r) => ({ ...r, id: uid() }));
  store.set((s) => ({
    ...s,
    household: {
      id: uid(),
      name: input.houseName.trim(),
      createdAt: new Date().toISOString(),
    },
    members: [a, b],
    meId: a.id,
    rooms: Array.from(new Set<RoomId>([...input.rooms, "casa"])),
    litter: input.litter,
    litterStock: input.litterStock,
    rewards,
  }));
}

export function resetAll() {
  store.reset();
}

/* ================= tarefas ================= */

interface CompleteOptions {
  at?: Date;
  note?: string;
  rect?: DOMRect | null;
  /** Desfaz efeitos extras (ex.: refeição marcada como retirada). */
  undoExtra?: () => void;
  silentToast?: boolean;
}

export function completeTask(taskId: string, opts: CompleteOptions = {}) {
  const s0 = get();
  const t = TASK_MAP[taskId];
  const me = currentMember(s0);
  if (!t || !me) return;

  const now = new Date();
  const at = opts.at ?? now;
  const { pts, bonus } = pointsFor(s0, t, now, !!opts.at);

  const beforeLevel = levelOf(xpOf(s0, me.id)).level;
  const beforeBadges = new Set(
    achievements(s0, now)
      .filter((b) => b.unlocked)
      .map((b) => b.id),
  );
  const beforeMorning = blockDone(s0, "manha", now);
  const beforeNight = blockDone(s0, "noite", now);

  const entry: CompletionEntry = {
    id: uid(),
    taskId,
    who: me.id,
    at: at.toISOString(),
    pts,
    dateKey: dayKey(at),
    ...(opts.note ? { note: opts.note } : {}),
  };

  store.set((s) => ({
    ...s,
    completions: [...s.completions, entry],
    litterStock:
      taskId === "area_troca" && s.litterStock != null
        ? Math.max(0, s.litterStock - litterBagsPerChange(s))
        : s.litterStock,
  }));

  const s1 = get();
  floatXP(opts.rect, `+${pts} XP`);
  if (opts.rect)
    confetti(
      opts.rect.left + opts.rect.width / 2,
      opts.rect.top,
      bonus ? 22 : 12,
      0.8,
    );
  vibrate(15);

  if (!opts.silentToast) {
    toast(`${taskTitle(s1, t)}${bonus ? " · bônus no prazo" : ""}`, () => {
      opts.undoExtra?.();
      removeCompletion(entry.id);
    });
  }

  const lv = levelOf(xpOf(s1, me.id));
  if (lv.level > beforeLevel)
    banner("⭐", `${me.name} subiu para o nível ${lv.level}`, lv.name);
  if (!beforeMorning && blockDone(s1, "manha", now))
    banner("☀️", "Manhã completa!", "Rotina da manhã fechada");
  if (!beforeNight && blockDone(s1, "noite", now))
    banner("🌙", "Reset da noite completo!", "A casa vai amanhecer pronta");
  for (const b of achievements(s1, now))
    if (b.unlocked && !beforeBadges.has(b.id))
      banner(b.icon, `Conquista: ${b.name}`, b.description);
}

export function removeCompletion(id: string) {
  store.set((s) => {
    const e = s.completions.find((c) => c.id === id);
    if (!e) return s;
    const office = { ...s.office };
    if (e.taskId === "escritorio") {
      const g = OFFICE_GOALS.find((x) => x.t === e.note);
      if (g) {
        const { [g.id]: _removed, ...rest } = office.done;
        office.done = rest;
      }
    }
    return {
      ...s,
      completions: s.completions.filter((c) => c.id !== id),
      reactions: s.reactions.filter((r) => r.completionId !== id),
      office,
      litterStock:
        e.taskId === "area_troca" && s.litterStock != null
          ? s.litterStock + litterBagsPerChange(s)
          : s.litterStock,
    };
  });
}

/** Desmarca a conclusão de hoje (checklist de rotina). */
export function undoToday(taskId: string) {
  const td = dayKey(new Date());
  const e = get()
    .completions.filter((c) => c.taskId === taskId && c.dateKey === td)
    .sort((a, b) => (a.at < b.at ? 1 : -1))[0];
  if (e) removeCompletion(e.id);
}

export function setFrequency(taskId: string, mn: number, mx: number) {
  store.set((s) => ({
    ...s,
    overrides: {
      ...s.overrides,
      [taskId]: { ...s.overrides[taskId], min: mn, max: mx },
    },
  }));
}

export function togglePause(taskId: string) {
  store.set((s) => ({
    ...s,
    overrides: {
      ...s.overrides,
      [taskId]: { ...s.overrides[taskId], off: !s.overrides[taskId]?.off },
    },
  }));
}

/* ================= pessoas / ajustes ================= */

export function switchMe() {
  const s = get();
  const other = partnerOf(s, s.meId);
  if (!other) return;
  store.set((st) => ({ ...st, meId: other.id }));
  toast(`Agora registrando como ${other.name}`);
}

export function setMe(id: string) {
  store.set((s) => ({ ...s, meId: id }));
}

export function renameMember(id: string, name: string) {
  const v = name.trim().slice(0, 24);
  if (!v) return;
  store.set((s) => ({
    ...s,
    members: s.members.map((m) => (m.id === id ? { ...m, name: v } : m)),
  }));
}

export function toggleRoom(room: RoomId) {
  if (room === "casa") return;
  store.set((s) => ({
    ...s,
    rooms: s.rooms.includes(room)
      ? s.rooms.filter((r) => r !== room)
      : [...s.rooms, room],
  }));
}

/* ================= gatos ================= */

export function setLitter(patch: Partial<AppState["litter"]>) {
  store.set((s) => {
    const next = { ...s.litter, ...patch };
    if (patch.minDays != null && next.minDays > next.maxDays)
      next.maxDays = next.minDays;
    if (patch.maxDays != null && next.maxDays < next.minDays)
      next.minDays = next.maxDays;
    return { ...s, litter: { ...DEFAULT_LITTER, ...next } };
  });
}

export function adjustStock(delta: number) {
  store.set((s) => ({
    ...s,
    litterStock: Math.max(0, (s.litterStock ?? 0) + delta),
  }));
}

/* ================= cozinha ================= */

export interface MealDraft {
  date: string;
  slot: "almoco" | "jantar";
  dish: string;
  protein: string;
}

export function addMeal(d: MealDraft) {
  const me = currentMember(get());
  if (!me) return;
  const m = {
    id: uid(),
    date: d.date,
    slot: d.slot,
    dish: d.dish.trim().slice(0, 80),
    protein: d.protein,
    by: me.id,
  };
  store.set((s) => ({ ...s, meals: [...s.meals, m] }));
  const a = mealAlert(m, new Date());
  toast(
    a
      ? `Adicionado. Alerta para retirar ${relDay(a.pullTime, new Date())} às ${fmtTime(a.pullTime)}.`
      : "Refeição adicionada.",
  );
}

export function pullMeal(id: string, rect?: DOMRect | null) {
  const me = currentMember(get());
  const m = get().meals.find((x) => x.id === id);
  if (!me || !m) return;
  store.set((s) => ({
    ...s,
    meals: s.meals.map((x) => (x.id === id ? { ...x, pulledBy: me.id } : x)),
  }));
  completeTask("desc", {
    note: m.dish || proteinName(m.protein),
    rect,
    undoExtra: () =>
      store.set((s) => ({
        ...s,
        meals: s.meals.map((x) =>
          x.id === id ? { ...x, pulledBy: undefined } : x,
        ),
      })),
  });
}

export function cookMeal(id: string, rect?: DOMRect | null) {
  const me = currentMember(get());
  const m = get().meals.find((x) => x.id === id);
  if (!me || !m) return;
  store.set((s) => ({
    ...s,
    meals: s.meals.map((x) => (x.id === id ? { ...x, cookedBy: me.id } : x)),
  }));
  completeTask("cozinhar", {
    note: m.dish || (m.slot === "almoco" ? "Almoço" : "Jantar"),
    rect,
    undoExtra: () =>
      store.set((s) => ({
        ...s,
        meals: s.meals.map((x) =>
          x.id === id ? { ...x, cookedBy: undefined } : x,
        ),
      })),
  });
}

export function deleteMeal(id: string) {
  store.set((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) }));
}

/* ================= escritório ================= */

function currentMonday() {
  return mondayKey(new Date());
}

export function startOffice() {
  store.set((s) => ({ ...s, office: { ...s.office, start: currentMonday() } }));
  banner("📦", "Projeto Escritório começou!", "Um objetivo por semana");
}

export function toggleOfficeStep(
  goalId: string,
  i: number,
  rect?: DOMRect | null,
) {
  const was = officeStepDone(get(), goalId, i);
  store.set((s) => ({
    ...s,
    office: {
      ...s.office,
      start: s.office.start ?? currentMonday(),
      steps: {
        ...s.office.steps,
        [goalId]: { ...s.office.steps[goalId], [i]: !was },
      },
    },
  }));
  vibrate(10);
  if (!was) floatXP(rect, "✓");
}

export function finishOfficeGoal(goalId: string, rect?: DOMRect | null) {
  const g = OFFICE_GOALS.find((x) => x.id === goalId);
  const me = currentMember(get());
  if (!g || !me || officeStepsPct(get(), goalId) < 100) return;
  closeSheet();
  store.set((s) => ({
    ...s,
    office: {
      ...s.office,
      done: {
        ...s.office.done,
        [g.id]: { at: new Date().toISOString(), who: me.id },
      },
    },
  }));
  completeTask("escritorio", { note: g.t, rect });
  banner("🏆", "Objetivo concluído!", g.t);
  if (!officeCurrent(get()))
    setTimeout(
      () => banner("🏢", "Escritório pronto!", "9 de 9 objetivos"),
      300,
    );
}

export function addInventoryItem(
  name: string,
  category: string,
  dest: InventoryDest,
) {
  const me = currentMember(get());
  const n = name.trim();
  if (!me || !n) return false;
  store.set((s) => ({
    ...s,
    office: {
      ...s.office,
      inventory: [
        ...s.office.inventory,
        {
          id: uid(),
          name: n.slice(0, 60),
          category,
          dest,
          who: me.id,
          at: new Date().toISOString(),
        },
      ],
    },
  }));
  toast(`${n} → ${INVENTORY_DEST[dest]}`);
  return true;
}

export function removeInventoryItem(id: string) {
  store.set((s) => ({
    ...s,
    office: {
      ...s.office,
      inventory: s.office.inventory.filter((i) => i.id !== id),
    },
  }));
}

export function setInventoryDest(id: string, dest: InventoryDest) {
  store.set((s) => ({
    ...s,
    office: {
      ...s.office,
      inventory: s.office.inventory.map((i) =>
        i.id === id ? { ...i, dest } : i,
      ),
    },
  }));
}

/* ================= social ================= */

export function toggleReaction(completionId: string, emoji: ReactionKey) {
  const me = currentMember(get());
  if (!me) return;
  store.set((s) => {
    const existing = s.reactions.find(
      (r) =>
        r.completionId === completionId &&
        r.memberId === me.id &&
        r.emoji === emoji,
    );
    return {
      ...s,
      reactions: existing
        ? s.reactions.filter((r) => r.id !== existing.id)
        : [...s.reactions, { id: uid(), completionId, memberId: me.id, emoji }],
    };
  });
  vibrate(8);
}

export function requestTrade(taskId: string) {
  const s = get();
  const me = currentMember(s);
  const other = partnerOf(s, me?.id);
  const t = TASK_MAP[taskId];
  if (!me || !other || !t) return;
  store.set((st) => ({
    ...st,
    trades: [
      ...st.trades,
      {
        id: uid(),
        taskId,
        requesterId: me.id,
        assigneeId: other.id,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ],
  }));
  closeSheet();
  toast(`Pedido enviado para ${other.name}: ${taskTitle(s, t)}`);
}

export function respondTrade(id: string, accept: boolean) {
  store.set((s) => ({
    ...s,
    trades: s.trades.map((t) =>
      t.id === id
        ? {
            ...t,
            status: accept ? "accepted" : "rejected",
            resolvedAt: new Date().toISOString(),
          }
        : t,
    ),
  }));
  toast(accept ? "Combinado! A tarefa fica com você." : "Pedido recusado.");
}

/* ================= loja ================= */

export function addReward(title: string, costCoins: number, icon: string) {
  const t = title.trim();
  if (t.length < 2 || !(costCoins >= 1)) return false;
  store.set((s) => ({
    ...s,
    rewards: [
      ...s.rewards,
      {
        id: uid(),
        title: t.slice(0, 60),
        costCoins: Math.round(costCoins),
        icon: icon || "🎁",
      },
    ],
  }));
  toast(`“${t}” entrou na lojinha.`);
  return true;
}

export function buyReward(rewardId: string) {
  const s = get();
  const me = currentMember(s);
  const r = s.rewards.find((x) => x.id === rewardId);
  if (!me || !r) return;
  if (coinsOf(s, me.id) < r.costCoins) {
    toast("Moedas da casa insuficientes.");
    return;
  }
  store.set((st) => ({
    ...st,
    purchases: [
      ...st.purchases,
      {
        id: uid(),
        rewardId,
        memberId: me.id,
        costCoins: r.costCoins,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ],
  }));
  confetti(window.innerWidth / 2, window.innerHeight * 0.4, 50, 1);
  toast(
    `Pedido enviado: ${r.title}. ${partnerOf(s, me.id)?.name ?? "A outra pessoa"} precisa aprovar.`,
  );
}

export function resolvePurchase(id: string, approved: boolean) {
  const s = get();
  const p = s.purchases.find((x) => x.id === id);
  if (!p) return;
  store.set((st) => ({
    ...st,
    purchases: st.purchases.map((x) =>
      x.id === id
        ? {
            ...x,
            status: approved ? "approved" : "rejected",
            resolvedAt: new Date().toISOString(),
          }
        : x,
    ),
  }));
  toast(
    approved
      ? `Aprovado para ${memberName(s, p.memberId)}!`
      : `Recusado — as moedas voltaram para ${memberName(s, p.memberId)}.`,
  );
}
