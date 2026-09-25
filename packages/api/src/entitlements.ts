import {
  type BillingInterval,
  type Entitlements,
  type PlanGrant,
  type PlanViolation,
  type ResolvedPlan,
  type SubscriptionState,
  type Usage,
  planLimitMessage,
  planViolations,
  resolvePlan,
  subscriptionGrantsPlus,
} from "@ocafy/core";
import { db, entitlementGrants, subscriptions } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";

type GrantRow = typeof entitlementGrants.$inferSelect;
type SubRow = typeof subscriptions.$inferSelect;

const iso = (d: Date | null) => (d ? d.toISOString() : null);

export const grantOf = (r: GrantRow): PlanGrant => ({
  plan: r.plan,
  source: r.source,
  startsAt: r.startsAt.toISOString(),
  expiresAt: iso(r.expiresAt),
  revokedAt: iso(r.revokedAt),
  overrides: (r.overrides as PlanGrant["overrides"]) ?? null,
});

export const subOf = (r: SubRow): SubscriptionState => ({
  status: r.status,
  currentPeriodEnd: iso(r.currentPeriodEnd),
  graceUntil: iso(r.graceUntil),
});

/** A assinatura que vale agora (a que dá Plus; senão, a mais recente). */
export function pickSubscription(
  rows: SubRow[],
  now: Date,
): SubRow | undefined {
  return (
    rows.find((r) => subscriptionGrantsPlus(subOf(r), now)) ??
    [...rows].sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]
  );
}

/** Plano efetivo da casa, calculado a partir das liberações e da assinatura. */
export function resolveFromRows(
  grants: GrantRow[],
  subs: SubRow[],
  now = new Date(),
): ResolvedPlan {
  const sub = pickSubscription(subs, now);
  return resolvePlan(now, grants.map(grantOf), sub ? subOf(sub) : null);
}

export async function loadEntitlements(
  householdId: string,
  now = new Date(),
): Promise<ResolvedPlan> {
  const [grants, subs] = await db.batch([
    db
      .select()
      .from(entitlementGrants)
      .where(eq(entitlementGrants.householdId, householdId)),
    db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.householdId, householdId)),
  ]);
  return resolveFromRows(grants, subs, now);
}

/** Lança FORBIDDEN (com marca de limite de plano) se a mudança passa do que o plano permite. */
export function assertWithinPlan(
  ent: Entitlements,
  current: Usage,
  next: Usage,
): void {
  const v: PlanViolation | undefined = planViolations(ent, current, next)[0];
  if (v) {
    throw new TRPCError({ code: "FORBIDDEN", message: planLimitMessage(v) });
  }
}

/** Links de pagamento (Cakto): a casa vai junto na URL para o webhook saber de quem é. */
export function checkoutUrls(
  householdId: string,
): Record<BillingInterval, string | null> {
  const build = (base: string | undefined) =>
    base
      ? `${base}${base.includes("?") ? "&" : "?"}ref=${encodeURIComponent(householdId)}`
      : null;
  return {
    quarterly: build(process.env.CAKTO_CHECKOUT_QUARTERLY_URL),
    yearly: build(process.env.CAKTO_CHECKOUT_YEARLY_URL),
  };
}
