import {
  type Absence,
  DEFAULT_PREFS,
  type DaySchedule,
  type MealAlertInput,
  type NotifKind,
  type NotifPrefs,
  PROTEIN_MAP,
  calculateTaskStatus,
  canSendEventNow,
  defrostPullLocal,
  localParts,
  nextShopDate,
  planNotifications,
} from "@ocafy/core";
import { generatePlan } from "@ocafy/core";
import {
  completions,
  db,
  householdMembers,
  households,
  meals,
  memberAbsences,
  memberSchedule,
  notificationLog,
  notificationPrefs,
  pushSubscriptions,
  shoppingItems,
  shoppingTrips,
  taskAssignments,
  taskOverrides,
} from "@ocafy/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { flag } from "./flags";
import { loadPlanInput } from "./plan";
import { type PushPayload, pushConfigured, sendPush } from "./push";

type PrefsRow = typeof notificationPrefs.$inferSelect;

export const prefsFromRow = (r: PrefsRow | undefined): NotifPrefs =>
  r
    ? {
        enabled: r.enabled,
        morning: r.morning,
        night: r.night,
        due: r.due,
        defrost: r.defrost,
        partner: r.partner,
        shopping: r.shopping,
        quietStart: r.quietStart,
        quietEnd: r.quietEnd,
        remindBeforeMin: r.remindBeforeMin,
      }
    : DEFAULT_PREFS;

export type DeliverResult = "sent" | "failed" | "no_device" | "duplicate";

/**
 * Entrega um aviso a uma pessoa em todos os aparelhos dela. O log com chave única garante
 * que o mesmo aviso não sai duas vezes (nem se o agendador rodar em paralelo).
 */
export async function deliver(
  householdId: string,
  memberId: string,
  kind: NotifKind,
  dedupeKey: string,
  payload: PushPayload,
): Promise<DeliverResult> {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.memberId, memberId));
  if (!subs.length) return "no_device";

  const claimed = await db
    .insert(notificationLog)
    .values({ householdId, memberId, kind, dedupeKey, status: "sent" })
    .onConflictDoNothing()
    .returning({ id: notificationLog.id });
  if (!claimed.length) return "duplicate";

  const results = await Promise.all(
    subs.map(async (s) => ({
      s,
      r: await sendPush(s, { tag: kind, ...payload }),
    })),
  );
  const gone = results.filter((x) => !x.r.ok && x.r.gone).map((x) => x.s.id);
  if (gone.length)
    await db
      .delete(pushSubscriptions)
      .where(inArray(pushSubscriptions.id, gone));
  const okIds = results.filter((x) => x.r.ok).map((x) => x.s.id);
  if (okIds.length) {
    await db
      .update(pushSubscriptions)
      .set({ lastSuccessAt: new Date(), failCount: 0 })
      .where(inArray(pushSubscriptions.id, okIds));
    return "sent";
  }
  const detail = results
    .map((x) => (!x.r.ok ? x.r.detail : ""))
    .filter(Boolean)
    .join(" | ")
    .slice(0, 300);
  await db
    .update(notificationLog)
    .set({ status: "failed", detail })
    .where(eq(notificationLog.id, claimed[0].id));
  return "failed";
}

/**
 * Aviso por evento (pedido de troca, resgate, item urgente) para os adultos da casa.
 * Nunca lança: um problema de push não pode quebrar a ação do usuário.
 */
export async function notifyHousehold(opts: {
  householdId: string;
  kind: "trade" | "purchase" | "shopping_urgent";
  /** Quem fez a ação (não recebe o próprio aviso). */
  exceptMemberId?: string;
  /** Só estes destinatários (ids de membros). */
  onlyMemberIds?: string[];
  eventId: string;
  title: string;
  body: string;
  url: string;
}): Promise<void> {
  try {
    if (!pushConfigured()) return;
    const [rows, [house]] = await db.batch([
      db
        .select({ id: householdMembers.id, prefs: notificationPrefs })
        .from(householdMembers)
        .leftJoin(
          notificationPrefs,
          eq(notificationPrefs.memberId, householdMembers.id),
        )
        .where(
          and(
            eq(householdMembers.householdId, opts.householdId),
            eq(householdMembers.kind, "account"),
          ),
        ),
      db
        .select({ tz: households.timezone })
        .from(households)
        .where(eq(households.id, opts.householdId)),
    ]);
    const now = new Date();
    const tz = house?.tz ?? "America/Sao_Paulo";
    await Promise.allSettled(
      rows
        .filter(
          (r) =>
            r.id !== opts.exceptMemberId &&
            (!opts.onlyMemberIds || opts.onlyMemberIds.includes(r.id)),
        )
        .filter((r) =>
          canSendEventNow(
            prefsFromRow(r.prefs ?? undefined),
            opts.kind,
            now,
            tz,
          ),
        )
        .map((r) =>
          deliver(
            opts.householdId,
            r.id,
            opts.kind,
            `${opts.kind}:${opts.eventId}`,
            { title: opts.title, body: opts.body, url: opts.url },
          ),
        ),
    );
  } catch {
    // aviso é conveniência: ignora falhas
  }
}

export interface TickSummary {
  households: number;
  members: number;
  sent: number;
  failed: number;
  duplicates: number;
  noDevice: number;
}

/**
 * Agendador: chamado a cada poucos minutos por um cron externo. Só olha casas com pelo menos
 * uma pessoa que ligou os avisos; para cada uma, calcula o que está pendente e o que é para
 * enviar agora (regras em `planNotifications`).
 */
export async function runNotificationTick(
  now = new Date(),
): Promise<TickSummary> {
  const summary: TickSummary = {
    households: 0,
    members: 0,
    sent: 0,
    failed: 0,
    duplicates: 0,
    noDevice: 0,
  };
  if (!pushConfigured() || !(await flag("push_enabled", true))) return summary;

  const enabled = await db
    .select({
      prefs: notificationPrefs,
      householdId: householdMembers.householdId,
      memberId: householdMembers.id,
    })
    .from(notificationPrefs)
    .innerJoin(
      householdMembers,
      eq(householdMembers.id, notificationPrefs.memberId),
    )
    .where(eq(notificationPrefs.enabled, true));

  const byHouse = new Map<string, typeof enabled>();
  for (const e of enabled) {
    byHouse.set(e.householdId, [...(byHouse.get(e.householdId) ?? []), e]);
  }

  for (const [householdId, members] of byHouse) {
    try {
      summary.households++;
      await tickHousehold(householdId, members, now, summary);
    } catch {
      // uma casa com problema não pode parar as demais
    }
  }
  return summary;
}

async function tickHousehold(
  householdId: string,
  members: { prefs: PrefsRow; memberId: string }[],
  now: Date,
  summary: TickSummary,
) {
  const [
    [house],
    planInput,
    lastRows,
    overrideRows,
    assignmentRows,
    mealRows,
    shopItems,
    tripRows,
    scheduleRows,
    absenceRows,
  ] = await Promise.all([
    db.select().from(households).where(eq(households.id, householdId)),
    loadPlanInput(householdId),
    db
      .select({
        key: completions.taskKey,
        last: sql<string>`max(${completions.completedAt})`,
      })
      .from(completions)
      .where(eq(completions.householdId, householdId))
      .groupBy(completions.taskKey),
    db
      .select()
      .from(taskOverrides)
      .where(eq(taskOverrides.householdId, householdId)),
    db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.householdId, householdId)),
    db.select().from(meals).where(eq(meals.householdId, householdId)),
    db
      .select({ urgency: shoppingItems.urgency })
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.householdId, householdId),
          eq(shoppingItems.status, "open"),
        ),
      ),
    db
      .select({ at: shoppingTrips.doneAt })
      .from(shoppingTrips)
      .where(eq(shoppingTrips.householdId, householdId))
      .orderBy(desc(shoppingTrips.doneAt))
      .limit(1),
    db
      .select()
      .from(memberSchedule)
      .where(eq(memberSchedule.householdId, householdId)),
    db
      .select()
      .from(memberAbsences)
      .where(eq(memberAbsences.householdId, householdId)),
  ]);
  if (!house) return;
  const tz = house.timezone;
  const local = localParts(now, tz);

  const plan = generatePlan(planInput);
  const lastByKey = new Map(lastRows.map((r) => [r.key, r.last]));
  const off = new Set(
    overrideRows.filter((o) => o.isPaused).map((o) => o.taskKey),
  );
  const overrideOf = new Map(overrideRows.map((o) => [o.taskKey, o]));
  const assignee = new Map(assignmentRows.map((a) => [a.taskKey, a.memberId]));
  const doneToday = new Set(
    (
      await db
        .select({ key: completions.taskKey })
        .from(completions)
        .where(
          and(
            eq(completions.householdId, householdId),
            eq(completions.dateKey, local.dateKey),
          ),
        )
    ).map((r) => r.key),
  );

  // Congelador: proteínas ainda não retiradas, com o horário de retirada no fuso da casa.
  const defrost: MealAlertInput[] = [];
  for (const m of mealRows) {
    if (m.pulledBy || m.cookedBy) continue;
    const p = PROTEIN_MAP[m.proteinKey];
    if (!p || p.hours === 0) continue;
    const at = defrostPullLocal(m.dateKey, m.slot, p.hours);
    defrost.push({
      id: m.id,
      label: `${p.name} — ${m.dishName || (m.slot === "almoco" ? "Almoço" : "Jantar")}`,
      dateKey: at.dateKey,
      minute: at.minute,
    });
  }

  const openItems = shopItems.length;
  const urgent = shopItems.filter((i) => i.urgency === "now").length;
  const next = nextShopDate(
    tripRows[0]?.at.toISOString() ?? null,
    house.shopCadence,
    house.shopDay,
    now,
  );
  const isShoppingDay =
    !!next && localParts(next, tz).dateKey === local.dateKey;

  for (const { prefs, memberId } of members) {
    summary.members++;
    const mine = (key: string) => {
      const a = assignee.get(key);
      return !a || a === memberId;
    };
    const routine = plan.filter((t) => t.kind === "routine" && mine(t.id));
    const morningPending = routine.filter(
      (t) => t.r === "manha" && !doneToday.has(t.id),
    ).length;
    const nightPending = routine.filter(
      (t) => t.r === "noite" && !doneToday.has(t.id),
    ).length;
    let dueCount = 0;
    let lateCount = 0;
    for (const t of plan) {
      if (t.kind !== "recurring" || off.has(t.id) || !mine(t.id)) continue;
      const o = overrideOf.get(t.id);
      const st = calculateTaskStatus(
        o?.minDays ?? t.min,
        o?.maxDays ?? t.max,
        lastByKey.get(t.id) ?? null,
        now,
      );
      if (st.state === "due") dueCount++;
      if (st.state === "late") lateCount++;
    }

    const schedule: DaySchedule[] = scheduleRows
      .filter((r) => r.memberId === memberId)
      .map((r) => ({
        weekday: r.weekday,
        mode: r.mode,
        leave: r.leaveTime,
        back: r.backTime,
      }));
    const absences: Absence[] = absenceRows
      .filter((r) => r.memberId === memberId)
      .map((r) => ({ from: r.fromDate, until: r.untilDate }));

    const due = planNotifications({
      now,
      tz,
      prefs: prefsFromRow(prefs),
      schedule,
      absences,
      morningPending,
      nightPending,
      dueCount,
      lateCount,
      defrost,
      shoppingOpen: openItems,
      shoppingUrgent: urgent,
      isShoppingDay,
    });
    for (const n of due) {
      const r = await deliver(householdId, memberId, n.kind, n.dedupeKey, {
        title: n.title,
        body: n.body,
        url: n.url,
      });
      if (r === "sent") summary.sent++;
      else if (r === "failed") summary.failed++;
      else if (r === "duplicate") summary.duplicates++;
      else summary.noDevice++;
    }
  }
}
