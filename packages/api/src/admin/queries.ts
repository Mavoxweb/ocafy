import { PLUS_PRICES } from "@ocafy/core";
import {
  adminAuditLog,
  billingEvents,
  dataRequests,
  db,
  entitlementGrants,
  featureFlags,
  householdMembers,
  households,
  notificationLog,
  notificationPrefs,
  onboardingEvents,
  pushSubscriptions,
  subscriptions,
  supportNotes,
} from "@ocafy/db";
import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import { resolveFromRows } from "../entitlements";

/** Consultas de leitura do painel admin. Nada aqui altera dados. */

const DAY = 86_400_000;
const num = (v: unknown) => Number(v ?? 0);

export interface Dashboard {
  users: number;
  households: number;
  householdsNew7d: number;
  householdsNew30d: number;
  householdsActive7d: number;
  adultsActive7d: number;
  /** Adultos ativos (7 dias) com avisos ligados e ao menos um aparelho. */
  notifOptIn: number;
  notifOptInPct: number | null;
  plans: { free: number; plus: number; bySource: Record<string, number> };
  mrrCents: number;
  activeSubscriptions: number;
  pastDue: number;
  funnel: { step: string; users: number }[];
  billing: { errors7d: number; unmatched7d: number };
  requests: { open: number; overdue: number };
  notifications7d: { sent: number; failed: number };
}

export async function dashboard(now = new Date()): Promise<Dashboard> {
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);

  const scalar = async (q: ReturnType<typeof sql>) =>
    num((await db.execute<{ n: string }>(q)).rows[0]?.n);

  const [
    users,
    houseTotal,
    new7,
    new30,
    active7,
    adultsActive7,
    optIn,
    grants,
    subs,
    funnel,
    billingErrors,
    unmatched,
    openReq,
    overdueReq,
    sent,
    failed,
  ] = await Promise.all([
    scalar(sql`select count(*) as n from neon_auth."user"`),
    scalar(sql`select count(*) as n from ${households}`),
    scalar(
      sql`select count(*) as n from ${households} where created_at > ${d7}`,
    ),
    scalar(
      sql`select count(*) as n from ${households} where created_at > ${d30}`,
    ),
    scalar(
      sql`select count(distinct household_id) as n from completions where completed_at > ${d7}`,
    ),
    scalar(sql`
      select count(distinct c.completed_by) as n
      from completions c join ${householdMembers} m on m.id = c.completed_by
      where c.completed_at > ${d7} and m.kind = 'account'`),
    scalar(sql`
      select count(distinct m.id) as n
      from completions c
      join ${householdMembers} m on m.id = c.completed_by and m.kind = 'account'
      join ${notificationPrefs} p on p.member_id = m.id and p.enabled = true
      join ${pushSubscriptions} s on s.member_id = m.id
      where c.completed_at > ${d7}`),
    db.select().from(entitlementGrants),
    db.select().from(subscriptions),
    db
      .select({
        step: onboardingEvents.step,
        users: sql<number>`count(distinct ${onboardingEvents.userId})`,
      })
      .from(onboardingEvents)
      .groupBy(onboardingEvents.step),
    scalar(
      sql`select count(*) as n from ${billingEvents} where received_at > ${d7} and status = 'error'`,
    ),
    scalar(
      sql`select count(*) as n from ${billingEvents} where received_at > ${d7} and error = 'household_not_found'`,
    ),
    scalar(
      sql`select count(*) as n from ${dataRequests} where status in ('open','in_progress')`,
    ),
    scalar(
      sql`select count(*) as n from ${dataRequests} where status in ('open','in_progress') and due_at < ${now}`,
    ),
    scalar(
      sql`select count(*) as n from ${notificationLog} where created_at > ${d7} and status = 'sent'`,
    ),
    scalar(
      sql`select count(*) as n from ${notificationLog} where created_at > ${d7} and status = 'failed'`,
    ),
  ]);

  // Plano efetivo de cada casa (mesma regra do servidor).
  const houseIds = (
    await db.select({ id: households.id }).from(households)
  ).map((h) => h.id);
  const plans = { free: 0, plus: 0, bySource: {} as Record<string, number> };
  for (const id of houseIds) {
    const r = resolveFromRows(
      grants.filter((g) => g.householdId === id),
      subs.filter((s) => s.householdId === id),
      now,
    );
    if (r.plan === "plus") {
      plans.plus++;
      const key = r.source ?? "?";
      plans.bySource[key] = (plans.bySource[key] ?? 0) + 1;
    } else plans.free++;
  }

  // Receita mensal estimada: assinaturas que ainda estão pagando.
  const paying = subs.filter(
    (s) =>
      s.provider !== "manual" &&
      (s.status === "active" ||
        s.status === "past_due" ||
        s.status === "canceled"),
  );
  const mrr = paying.reduce((a, s) => {
    if (
      s.status === "canceled" &&
      (s.currentPeriodEnd?.getTime() ?? 0) <= now.getTime()
    )
      return a;
    return (
      a +
      (s.interval === "yearly"
        ? PLUS_PRICES.yearly / 12
        : s.interval === "quarterly"
          ? PLUS_PRICES.quarterly / 3
          : PLUS_PRICES.quarterly / 3)
    );
  }, 0);

  return {
    users,
    households: houseTotal,
    householdsNew7d: new7,
    householdsNew30d: new30,
    householdsActive7d: active7,
    adultsActive7d: adultsActive7,
    notifOptIn: optIn,
    notifOptInPct: adultsActive7
      ? Math.round((optIn / adultsActive7) * 100)
      : null,
    plans,
    mrrCents: Math.round(mrr),
    activeSubscriptions: paying.length,
    pastDue: subs.filter((s) => s.status === "past_due").length,
    funnel: funnel
      .map((f) => ({ step: f.step, users: num(f.users) }))
      .sort((a, b) => b.users - a.users),
    billing: { errors7d: billingErrors, unmatched7d: unmatched },
    requests: { open: openReq, overdue: overdueReq },
    notifications7d: { sent, failed },
  };
}

export interface HouseholdRow {
  id: string;
  name: string;
  mode: string;
  createdAt: Date;
  suspended: boolean;
  members: number;
  owner: string | null;
  plan: string;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Busca por nome da casa, id da casa ou e-mail de um membro. */
export async function searchHouseholds(
  q: string,
  limit = 25,
): Promise<HouseholdRow[]> {
  const term = q.trim();
  let ids: string[];
  if (!term) {
    ids = (
      await db
        .select({ id: households.id })
        .from(households)
        .orderBy(desc(households.createdAt))
        .limit(limit)
    ).map((r) => r.id);
  } else if (UUID_RE.test(term)) {
    ids = [term.toLowerCase()];
  } else {
    const like = `%${term.replace(/[%_]/g, "")}%`;
    const r = await db.execute<{ id: string }>(sql`
      select distinct h.id::text as id, h.created_at
      from ${households} h
      left join ${householdMembers} m on m.household_id = h.id
      left join neon_auth."user" u on u.id::text = m.user_id
      where h.name ilike ${like} or u.email ilike ${like} or m.display_name ilike ${like}
      order by h.created_at desc limit ${limit}`);
    ids = r.rows.map((x) => x.id);
  }
  if (!ids.length) return [];
  const [houses, members, grants, subs] = await Promise.all([
    db.select().from(households).where(inArray(households.id, ids)),
    db
      .select()
      .from(householdMembers)
      .where(inArray(householdMembers.householdId, ids)),
    db
      .select()
      .from(entitlementGrants)
      .where(inArray(entitlementGrants.householdId, ids)),
    db
      .select()
      .from(subscriptions)
      .where(inArray(subscriptions.householdId, ids)),
  ]);
  return houses
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((h) => {
      const ms = members.filter((m) => m.householdId === h.id);
      const plan = resolveFromRows(
        grants.filter((g) => g.householdId === h.id),
        subs.filter((s) => s.householdId === h.id),
      );
      return {
        id: h.id,
        name: h.name,
        mode: h.mode,
        createdAt: h.createdAt,
        suspended: !!h.suspendedAt,
        members: ms.length,
        owner: ms.find((m) => m.role === "owner")?.displayName ?? null,
        plan: plan.plan === "plus" ? `Plus (${plan.source})` : "Grátis",
      };
    });
}

export async function householdDetail(id: string) {
  const [house] = await db
    .select()
    .from(households)
    .where(eq(households.id, id));
  if (!house) return null;
  const [members, grants, subs, notes, audit, events] = await Promise.all([
    db.execute<{
      id: string;
      display_name: string;
      kind: string;
      role: string;
      slot: string;
      user_id: string | null;
      email: string | null;
      banned: boolean | null;
    }>(sql`
      select m.id::text as id, m.display_name, m.kind, m.role, m.slot, m.user_id, u.email, u.banned
      from ${householdMembers} m left join neon_auth."user" u on u.id::text = m.user_id
      where m.household_id = ${id} order by m.slot`),
    db
      .select()
      .from(entitlementGrants)
      .where(eq(entitlementGrants.householdId, id)),
    db.select().from(subscriptions).where(eq(subscriptions.householdId, id)),
    db
      .select()
      .from(supportNotes)
      .where(eq(supportNotes.householdId, id))
      .orderBy(desc(supportNotes.createdAt))
      .limit(30),
    db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.householdId, id))
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(40),
    db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.householdId, id))
      .orderBy(desc(billingEvents.receivedAt))
      .limit(20),
  ]);
  const usage = await db.execute<{
    completions: string;
    last: string | null;
  }>(sql`
    select count(*)::text as completions, max(completed_at)::text as last
    from completions where household_id = ${id}`);
  return {
    house,
    members: members.rows,
    plan: resolveFromRows(grants, subs),
    grants,
    subscriptions: subs,
    notes,
    audit,
    billingEvents: events,
    usage: {
      completions: num(usage.rows[0]?.completions),
      lastActivity: usage.rows[0]?.last ?? null,
    },
  };
}

export const listSubscriptions = (limit = 100) =>
  db
    .select({
      sub: subscriptions,
      house: households.name,
    })
    .from(subscriptions)
    .leftJoin(households, eq(households.id, subscriptions.householdId))
    .orderBy(desc(subscriptions.updatedAt))
    .limit(limit);

export const listBillingEvents = (limit = 100, onlyProblems = false) =>
  db
    .select()
    .from(billingEvents)
    .where(onlyProblems ? eq(billingEvents.status, "error") : undefined)
    .orderBy(desc(billingEvents.receivedAt))
    .limit(limit);

export const listDataRequests = (
  status?: "open" | "in_progress" | "done" | "rejected",
) =>
  db
    .select({
      req: dataRequests,
      house: households.name,
    })
    .from(dataRequests)
    .leftJoin(households, eq(households.id, dataRequests.householdId))
    .where(status ? eq(dataRequests.status, status) : undefined)
    .orderBy(dataRequests.dueAt)
    .limit(200);

export const listFlags = () =>
  db.select().from(featureFlags).orderBy(featureFlags.key);

export const listAudit = (limit = 200, actor?: string) =>
  db
    .select()
    .from(adminAuditLog)
    .where(actor ? eq(adminAuditLog.actorEmail, actor) : undefined)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit);

/** Saúde das notificações: últimos envios com falha. */
export const recentNotificationFailures = (limit = 30) =>
  db
    .select()
    .from(notificationLog)
    .where(
      and(
        eq(notificationLog.status, "failed"),
        gt(notificationLog.createdAt, new Date(Date.now() - 7 * DAY)),
      ),
    )
    .orderBy(desc(notificationLog.createdAt))
    .limit(limit);

export { getCampaign, listCampaignsWithStats } from "../marketing";
