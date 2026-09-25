"use client";

import {
  type CompletionEntry,
  type DaySchedule,
  LEGAL_VERSION,
  type NotifPrefs,
  type ShopCadence,
  type ShopUrgency,
  guessCategory,
} from "@ocafy/core";
import {
  INVENTORY_DEST,
  type InventoryDest,
  OFFICE_GOALS,
  type ReactionKey,
} from "./catalog";
import { dayKey, fmtTime, mondayKey, relDay, uid } from "./dates";
import { banner, confetti, floatXP, vibrate } from "./fx";
import { type HouseDraft, draftToInput, familyKids } from "./house-draft";
import {
  currentSubscription,
  pushSupport,
  registerWorker,
  urlBase64ToUint8Array,
} from "./push";
import {
  achievements,
  assigneeOf,
  blockDone,
  coinsOf,
  currentMember,
  levelOf,
  litterBagsPerChange,
  mealAlert,
  memberById,
  memberName,
  officeCurrent,
  officeStepDone,
  officeStepsPct,
  otherAdults,
  partnerOf,
  pointsFor,
  proteinName,
  taskOf,
  taskTitle,
  xpOf,
} from "./selectors";
import { type AppState, type ShoppingItem, store } from "./store";
import { mutate, mutateStrict, refresh } from "./sync";
import { errorMessage, trpc } from "./trpc";
import { closeSheet, toast } from "./ui";

/**
 * Padrão de todas as ações: 1) atualiza o cache local na hora (otimista);
 * 2) envia ao servidor via `mutate`, que reconcilia com o snapshot depois.
 */

const get = () => store.getState();

/* ================= casa / convite ================= */

export interface SetupInput {
  houseName: string;
  memberName: string;
  draft: HouseDraft;
}

/** Lança em caso de erro (a tela de onboarding mostra a mensagem). */
export async function createHousehold(input: SetupInput) {
  await mutateStrict(async () => {
    await trpc.household.create.mutate({
      houseName: input.houseName,
      memberName: input.memberName,
      acceptedLegalVersion: LEGAL_VERSION,
      ...draftToInput(input.draft),
    });
    for (const k of familyKids(input.draft)) {
      await trpc.members.addProfile.mutate({
        guardianDeclaration: true,
        name: k.name.trim() || "Criança",
        ageBand: k.ageBand,
      });
    }
  });
  await refresh({ force: true });
}

/**
 * Salva perfil, cômodos, pets e crianças ("Minha casa"). Lança em caso de erro.
 * A ordem importa: ao sair do modo Família as crianças saem antes; ao entrar, o modo vem antes.
 */
export async function saveHouseProfile(draft: HouseDraft) {
  const current = get().members.filter((m) => m.kind === "profile");
  const kids = familyKids(draft);
  const keep = new Set(kids.map((k) => k.id).filter(Boolean));
  const removed = current.filter((c) => !keep.has(c.id));
  const changed = kids.filter((k) => {
    const c = current.find((x) => x.id === k.id);
    return !!c && (c.name !== k.name.trim() || c.ageBand !== k.ageBand);
  });
  const added = kids.filter((k) => !k.id);
  const family = draft.profile.mode === "family";

  await mutateStrict(async () => {
    if (!family) {
      for (const c of removed)
        await trpc.members.removeProfile.mutate({ id: c.id });
    }
    await trpc.household.updateProfile.mutate(draftToInput(draft));
    if (family) {
      for (const c of removed)
        await trpc.members.removeProfile.mutate({ id: c.id });
      for (const k of changed)
        await trpc.members.updateProfile.mutate({
          id: k.id as string,
          name: k.name.trim() || "Criança",
          ageBand: k.ageBand,
        });
      for (const k of added)
        await trpc.members.addProfile.mutate({
          guardianDeclaration: true,
          name: k.name.trim() || "Criança",
          ageBand: k.ageBand,
        });
    }
  });
  await refresh({ force: true });
}

/** Mede em que passo do onboarding as pessoas desistem. Nunca atrapalha o fluxo. */
export function trackOnboarding(step: string) {
  void trpc.household.onboardingStep.mutate({ step }).catch(() => {});
}

export async function joinHousehold(code: string, memberName: string) {
  await mutateStrict(() =>
    trpc.household.join.mutate({
      code,
      memberName,
      acceptedLegalVersion: LEGAL_VERSION,
    }),
  );
  await refresh({ force: true });
}

/** Aceite da versão vigente dos Termos e da Política (quem já usa o app). */
export async function acceptLegalUpdate() {
  await mutateStrict(() =>
    trpc.account.acceptLegal.mutate({ version: LEGAL_VERSION }),
  );
  await refresh({ force: true });
}

/** Gera (ou reaproveita) o convite e o coloca no cache. */
export async function ensureInvite() {
  const inv = await mutateStrict(() => trpc.household.createInvite.mutate());
  store.set((s) => ({ ...s, invite: inv }));
  return inv;
}

export async function deleteHousehold() {
  await mutateStrict(() => trpc.household.delete.mutate());
  await refresh({ force: true });
}

/* ================= tarefas ================= */

interface CompleteOptions {
  at?: Date;
  note?: string;
  rect?: DOMRect | null;
  /** Desfaz efeitos extras (ex.: refeição marcada como retirada). */
  undoExtra?: () => void;
  /** false = o chamador registra no servidor por outro endpoint. */
  remote?: boolean;
  /** Perfil de criança que fez a tarefa (o responsável registra por ela). */
  forMemberId?: string;
}

export function completeTask(
  taskId: string,
  opts: CompleteOptions = {},
): CompletionEntry | undefined {
  const s0 = get();
  const t = taskOf(s0, taskId);
  const me = currentMember(s0);
  if (!t || !me) return;
  // Tarefa atribuída a uma criança: o responsável confirma e o XP vai para ela.
  const assignee = assigneeOf(s0, taskId);
  const kidId =
    opts.forMemberId ??
    (assignee?.kind === "profile" ? assignee.id : undefined);
  const kid = kidId ? memberById(s0, kidId) : undefined;
  const who = kid?.kind === "profile" ? kid : me;

  const now = new Date();
  const at = opts.at ?? now;
  const { pts, bonus } = pointsFor(s0, t, now, !!opts.at);

  const beforeLevel = levelOf(xpOf(s0, who.id)).level;
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
    who: who.id,
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

  if (opts.remote !== false) {
    void mutate(() =>
      trpc.tasks.complete.mutate({
        id: entry.id,
        taskKey: taskId,
        at: entry.at,
        dateKey: entry.dateKey,
        pts,
        note: opts.note,
        ...(who.id !== me.id ? { forMemberId: who.id } : {}),
      }),
    );
  }

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

  const prefix = who.id !== me.id ? `${who.name}: ` : "";
  toast(
    `${prefix}${taskTitle(s1, t)}${bonus ? " · bônus no prazo" : ""}`,
    () => {
      opts.undoExtra?.();
      removeCompletion(entry.id);
    },
  );

  const lv = levelOf(xpOf(s1, who.id));
  if (lv.level > beforeLevel)
    banner("⭐", `${who.name} subiu para o nível ${lv.level}`, lv.name);
  if (!beforeMorning && blockDone(s1, "manha", now))
    banner("☀️", "Manhã completa!", "Rotina da manhã fechada");
  if (!beforeNight && blockDone(s1, "noite", now))
    banner("🌙", "Reset da noite completo!", "A casa vai amanhecer pronta");
  for (const b of achievements(s1, now))
    if (b.unlocked && !beforeBadges.has(b.id))
      banner(b.icon, `Conquista: ${b.name}`, b.description);
  return entry;
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
  void mutate(() => trpc.tasks.remove.mutate({ id }));
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
  void mutate(() =>
    trpc.tasks.setOverride.mutate({ taskKey: taskId, min: mn, max: mx }),
  );
}

export function togglePause(taskId: string) {
  const off = !get().overrides[taskId]?.off;
  store.set((s) => ({
    ...s,
    overrides: { ...s.overrides, [taskId]: { ...s.overrides[taskId], off } },
  }));
  void mutate(() =>
    trpc.tasks.setOverride.mutate({ taskKey: taskId, paused: off }),
  );
}

/** Define quem cuida da tarefa (`null` desfaz). */
export function assignTask(taskId: string, memberId: string | null) {
  store.set((s) => {
    const { [taskId]: _old, ...rest } = s.assignments;
    return {
      ...s,
      assignments: memberId ? { ...rest, [taskId]: memberId } : rest,
    };
  });
  void mutate(() => trpc.tasks.assign.mutate({ taskKey: taskId, memberId }));
}

/* ================= pessoas / ajustes ================= */

export function renameMe(name: string) {
  const v = name.trim().slice(0, 24);
  const me = currentMember(get());
  if (v.length < 2 || !me) return;
  store.set((s) => ({
    ...s,
    members: s.members.map((m) => (m.id === me.id ? { ...m, name: v } : m)),
  }));
  void mutate(() => trpc.household.rename.mutate({ name: v }));
}

/** Foto de perfil já recortada (data URL). Aparece na hora e é enviada em seguida. */
export function setMyAvatar(dataUrl: string) {
  const me = currentMember(get());
  if (!me) return;
  store.set((s) => ({
    ...s,
    members: s.members.map((m) =>
      m.id === me.id ? { ...m, avatar: dataUrl } : m,
    ),
  }));
  void mutate(() => trpc.household.setAvatar.mutate({ dataUrl }));
}

export function removeMyAvatar() {
  const me = currentMember(get());
  if (!me) return;
  store.set((s) => ({
    ...s,
    members: s.members.map((m) =>
      m.id === me.id ? { ...m, avatar: null } : m,
    ),
  }));
  void mutate(() => trpc.household.removeAvatar.mutate());
}

/* ================= gatos ================= */

export function setLitter(patch: Partial<AppState["litter"]>) {
  store.set((s) => {
    const next = { ...s.litter, ...patch };
    if (patch.minDays != null && next.minDays > next.maxDays)
      next.maxDays = next.minDays;
    if (patch.maxDays != null && next.maxDays < next.minDays)
      next.minDays = next.maxDays;
    return { ...s, litter: next };
  });
  void mutate(() => trpc.litter.update.mutate(patch));
}

export function adjustStock(delta: number) {
  store.set((s) => ({
    ...s,
    litterStock: Math.max(0, (s.litterStock ?? 0) + delta),
  }));
  void mutate(() => trpc.litter.adjustStock.mutate({ delta }));
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
  void mutate(() =>
    trpc.meals.add.mutate({
      id: m.id,
      dateKey: m.date,
      slot: m.slot,
      dish: m.dish,
      protein: m.protein,
    }),
  );
  const a = mealAlert(m, new Date());
  toast(
    a
      ? `Adicionado. Alerta para retirar ${relDay(a.pullTime, new Date())} às ${fmtTime(a.pullTime)}.`
      : "Refeição adicionada.",
  );
}

function setMealFlag(id: string, flag: "pulledBy" | "cookedBy", on: boolean) {
  const me = currentMember(get());
  store.set((s) => ({
    ...s,
    meals: s.meals.map((x) =>
      x.id === id ? { ...x, [flag]: on ? me?.id : undefined } : x,
    ),
  }));
  void mutate(() =>
    flag === "pulledBy"
      ? trpc.meals.setPulled.mutate({ id, value: on })
      : trpc.meals.setCooked.mutate({ id, value: on }),
  );
}

export function pullMeal(id: string, rect?: DOMRect | null) {
  const m = get().meals.find((x) => x.id === id);
  if (!m) return;
  setMealFlag(id, "pulledBy", true);
  completeTask("desc", {
    note: m.dish || proteinName(m.protein),
    rect,
    undoExtra: () => setMealFlag(id, "pulledBy", false),
  });
}

export function cookMeal(id: string, rect?: DOMRect | null) {
  const m = get().meals.find((x) => x.id === id);
  if (!m) return;
  setMealFlag(id, "cookedBy", true);
  completeTask("cozinhar", {
    note: m.dish || (m.slot === "almoco" ? "Almoço" : "Jantar"),
    rect,
    undoExtra: () => setMealFlag(id, "cookedBy", false),
  });
}

export function deleteMeal(id: string) {
  store.set((s) => ({ ...s, meals: s.meals.filter((m) => m.id !== id) }));
  void mutate(() => trpc.meals.remove.mutate({ id }));
}

/* ================= escritório ================= */

const currentMonday = () => mondayKey(new Date());

export function startOffice() {
  const startDate = currentMonday();
  store.set((s) => ({ ...s, office: { ...s.office, start: startDate } }));
  void mutate(() => trpc.office.start.mutate({ startDate }));
  banner("📦", "Projeto Escritório começou!", "Um objetivo por semana");
}

export function toggleOfficeStep(
  goalId: string,
  i: number,
  rect?: DOMRect | null,
) {
  const was = officeStepDone(get(), goalId, i);
  const startDate = get().office.start ?? currentMonday();
  store.set((s) => ({
    ...s,
    office: {
      ...s.office,
      start: s.office.start ?? startDate,
      steps: {
        ...s.office.steps,
        [goalId]: { ...s.office.steps[goalId], [i]: !was },
      },
    },
  }));
  void mutate(() =>
    trpc.office.setStep.mutate({
      goalKey: goalId,
      index: i,
      value: !was,
      startDate,
    }),
  );
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
  const entry = completeTask("escritorio", {
    note: g.t,
    rect,
    remote: false,
  });
  if (entry) {
    void mutate(() =>
      trpc.office.finishGoal.mutate({
        goalKey: g.id,
        completion: {
          id: entry.id,
          at: entry.at,
          dateKey: entry.dateKey,
          pts: entry.pts,
        },
      }),
    );
  }
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
  const item = {
    id: uid(),
    name: n.slice(0, 60),
    category,
    dest,
    who: me.id,
    at: new Date().toISOString(),
  };
  store.set((s) => ({
    ...s,
    office: { ...s.office, inventory: [...s.office.inventory, item] },
  }));
  void mutate(() =>
    trpc.office.addItem.mutate({
      id: item.id,
      name: item.name,
      category,
      dest,
    }),
  );
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
  void mutate(() => trpc.office.removeItem.mutate({ id }));
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
  void mutate(() => trpc.office.setItemDest.mutate({ id, dest }));
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
  void mutate(() => trpc.social.toggleReaction.mutate({ completionId, emoji }));
  vibrate(8);
}

export function requestTrade(taskId: string, toMemberId?: string) {
  const s = get();
  const me = currentMember(s);
  const other = toMemberId
    ? otherAdults(s, me?.id).find((m) => m.id === toMemberId)
    : partnerOf(s, me?.id);
  const t = taskOf(s, taskId);
  if (!me || !t) return;
  if (!other) {
    toast("Convide a outra pessoa para pedir ajuda.");
    return;
  }
  const id = uid();
  store.set((st) => ({
    ...st,
    trades: [
      ...st.trades,
      {
        id,
        taskId,
        requesterId: me.id,
        assigneeId: other.id,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ],
  }));
  void mutate(() =>
    trpc.social.requestTrade.mutate({
      id,
      taskKey: taskId,
      ...(toMemberId ? { toMemberId } : {}),
    }),
  );
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
  void mutate(() => trpc.social.respondTrade.mutate({ id, accept }));
  toast(accept ? "Combinado! A tarefa fica com você." : "Pedido recusado.");
}

/* ================= compras ================= */

export function addShopItem(
  name: string,
  urgency: ShopUrgency = "soon",
  quantity = "",
) {
  const n = name.trim().slice(0, 60);
  const me = currentMember(get());
  if (!n || !me) return false;
  const item = {
    id: uid(),
    name: n,
    quantity: quantity.trim().slice(0, 24) || null,
    category: guessCategory(n),
    urgency,
    status: "open" as const,
    addedBy: me.id,
    createdAt: new Date().toISOString(),
  };
  store.set((s) => ({
    ...s,
    shopping: { ...s.shopping, items: [...s.shopping.items, item] },
  }));
  void mutate(() =>
    trpc.shopping.add.mutate({
      id: item.id,
      name: item.name,
      ...(item.quantity ? { quantity: item.quantity } : {}),
      urgency,
    }),
  );
  return true;
}

const patchItem = (id: string, next: Partial<ShoppingItem>) =>
  store.set((s) => ({
    ...s,
    shopping: {
      ...s.shopping,
      items: s.shopping.items.map((i) => (i.id === id ? { ...i, ...next } : i)),
    },
  }));

export function setShopUrgency(id: string, urgency: ShopUrgency) {
  patchItem(id, { urgency });
  void mutate(() => trpc.shopping.update.mutate({ id, urgency }));
}

export function renameShopItem(id: string, name: string, quantity: string) {
  const n = name.trim().slice(0, 60);
  if (!n) return;
  const q = quantity.trim().slice(0, 24) || null;
  patchItem(id, { name: n, quantity: q });
  void mutate(() =>
    trpc.shopping.update.mutate({ id, name: n, quantity: q ?? "" }),
  );
}

export function toggleBought(id: string) {
  const it = get().shopping.items.find((i) => i.id === id);
  if (!it) return;
  const bought = it.status === "open";
  patchItem(id, { status: bought ? "bought" : "open" });
  void mutate(() => trpc.shopping.setBought.mutate({ id, bought }));
  vibrate(8);
}

export function removeShopItem(id: string) {
  store.set((s) => ({
    ...s,
    shopping: {
      ...s.shopping,
      items: s.shopping.items.filter((i) => i.id !== id),
    },
  }));
  void mutate(() => trpc.shopping.remove.mutate({ id }));
}

/** "Terminei as compras": registra a ida e limpa o que foi comprado. */
export function finishShopping() {
  const bought = get().shopping.items.filter((i) => i.status === "bought");
  if (!bought.length) {
    toast("Marque o que você comprou primeiro.");
    return;
  }
  store.set((s) => ({
    ...s,
    shopping: {
      ...s.shopping,
      items: s.shopping.items.filter((i) => i.status !== "bought"),
      trips: [new Date().toISOString(), ...s.shopping.trips].slice(0, 12),
    },
  }));
  void mutate(() => trpc.shopping.finishTrip.mutate());
  toast(
    `Compras registradas: ${bought.length} ${bought.length === 1 ? "item" : "itens"}.`,
  );
}

export function setShopHabit(cadence: ShopCadence | null, day: number | null) {
  store.set((s) => ({
    ...s,
    shopping: { ...s.shopping, cadence, day: cadence ? day : null },
  }));
  void mutate(() => trpc.shopping.setHabit.mutate({ cadence, day }));
}

/* ================= avisos e agenda ================= */

const patchNotif = (next: Partial<AppState["notifications"]>) =>
  store.set((s) => ({ ...s, notifications: { ...s.notifications, ...next } }));

export function setNotifPrefs(patch: Partial<NotifPrefs>) {
  patchNotif({ prefs: { ...get().notifications.prefs, ...patch } });
  void mutate(() => trpc.notifications.setPrefs.mutate(patch));
}

export type EnablePushResult =
  | "ok"
  | "denied"
  | "unsupported"
  | "ios_install"
  | "not_configured"
  | "error";

/** Pede permissão, assina o push deste aparelho e liga os avisos. */
export async function enablePush(): Promise<EnablePushResult> {
  const support = pushSupport();
  if (support === "unsupported" || support === "ios_install") return support;
  if (support === "denied") return "denied";
  const key = get().notifications.vapidPublicKey;
  if (!key) return "not_configured";
  try {
    const perm = await Notification.requestPermission();
    if (perm !== "granted") return "denied";
    const reg = await registerWorker();
    if (!reg) return "unsupported";
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      }));
    const json = sub.toJSON();
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth)
      return "error";
    await mutateStrict(async () => {
      await trpc.notifications.subscribe.mutate({
        endpoint: json.endpoint as string,
        p256dh: json.keys?.p256dh as string,
        auth: json.keys?.auth as string,
        userAgent: navigator.userAgent.slice(0, 200),
      });
      await trpc.notifications.setPrefs.mutate({ enabled: true });
    });
    await refresh({ force: true });
    return "ok";
  } catch {
    return "error";
  }
}

/** Desliga os avisos e tira este aparelho da lista. */
export async function disablePush() {
  const sub = await currentSubscription();
  patchNotif({ prefs: { ...get().notifications.prefs, enabled: false } });
  await mutateStrict(async () => {
    if (sub) {
      await trpc.notifications.unsubscribe.mutate({ endpoint: sub.endpoint });
      await sub.unsubscribe().catch(() => {});
    }
    await trpc.notifications.setPrefs.mutate({ enabled: false });
  });
  await refresh({ force: true });
}

export async function sendTestPush(): Promise<string> {
  try {
    const r = await mutateStrict(() => trpc.notifications.sendTest.mutate());
    return r.sent > 0
      ? "Aviso enviado. Confira o aparelho."
      : "Não foi possível entregar. Tente ativar de novo.";
  } catch (e) {
    return errorMessage(e, "Não foi possível enviar o teste.");
  }
}

export function setDaySchedule(day: DaySchedule) {
  const cur = get().notifications.schedule.filter(
    (d) => d.weekday !== day.weekday,
  );
  patchNotif({ schedule: [...cur, day] });
  void mutate(() =>
    trpc.agenda.setDay.mutate({
      weekday: day.weekday,
      mode: day.mode,
      leave: day.leave,
      back: day.back,
    }),
  );
}

/** Lança em caso de erro (a tela mostra a mensagem). */
export async function addAbsence(from: string, until: string, note: string) {
  await mutateStrict(() =>
    trpc.agenda.addAbsence.mutate({
      from,
      until,
      ...(note.trim() ? { note: note.trim() } : {}),
    }),
  );
  await refresh({ force: true });
}

export function removeAbsence(id: string) {
  patchNotif({
    absences: get().notifications.absences.filter((a) => a.id !== id),
  });
  void mutate(() => trpc.agenda.removeAbsence.mutate({ id }));
}

/* ================= privacidade (LGPD) ================= */

/** Baixa uma cópia dos meus dados (JSON) gerada no servidor. */
export async function downloadMyData(): Promise<string> {
  try {
    const r = await mutateStrict(() => trpc.account.exportMyData.mutate());
    const blob = new Blob([JSON.stringify(r.data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = r.filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return "Cópia dos seus dados baixada.";
  } catch (e) {
    return errorMessage(e, "Não foi possível gerar a cópia agora.");
  }
}

/** Pede a exclusão da conta e dos dados (a equipe confirma em até 15 dias). */
export async function requestAccountDeletion(): Promise<string> {
  try {
    const r = await mutateStrict(() => trpc.account.requestDeletion.mutate({}));
    const due = new Date(r.dueAt).toLocaleDateString("pt-BR");
    return `Pedido registrado. Vamos concluir até ${due}.`;
  } catch (e) {
    return errorMessage(e, "Não foi possível registrar o pedido.");
  }
}

/* ================= loja ================= */

export function addReward(title: string, costCoins: number, icon: string) {
  const t = title.trim();
  if (t.length < 2 || !(costCoins >= 1)) return false;
  const r = {
    id: uid(),
    title: t.slice(0, 60),
    costCoins: Math.round(costCoins),
    icon: icon || "🎁",
  };
  store.set((s) => ({ ...s, rewards: [...s.rewards, r] }));
  void mutate(() => trpc.store.addReward.mutate(r));
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
  const id = uid();
  store.set((st) => ({
    ...st,
    purchases: [
      ...st.purchases,
      {
        id,
        rewardId,
        memberId: me.id,
        costCoins: r.costCoins,
        status: "pending",
        createdAt: new Date().toISOString(),
      },
    ],
  }));
  void mutate(() => trpc.store.buy.mutate({ id, rewardId }));
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
  void mutate(() => trpc.store.resolve.mutate({ id, approved }));
  toast(
    approved
      ? `Aprovado para ${memberName(s, p.memberId)}!`
      : `Recusado — as moedas voltaram para ${memberName(s, p.memberId)}.`,
  );
}
