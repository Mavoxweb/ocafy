import {
  GRACE_DAYS,
  type NormalizedBillingEvent,
  type SubscriptionSnapshot,
  applyBillingEvent,
  dunningStepDue,
  shouldExpire,
} from "@ocafy/core";
import {
  billingEvents,
  db,
  householdMembers,
  households,
  subscriptions,
} from "@ocafy/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import { sendEmail } from "./email/send";
import { paymentFailedEmail } from "./email/templates";
import { deliver } from "./notifications";

/**
 * Cobrança: recebe eventos NORMALIZADOS dos provedores (ver core/billing.ts) e mantém a tabela
 * de assinaturas. Cada evento é guardado cru e processado UMA vez (idempotente); o plano efetivo
 * da casa é sempre calculado no servidor a partir daqui (entitlements.ts).
 */

export type ProcessResult = "applied" | "duplicate" | "ignored" | "unmatched";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Tira segredos do payload antes de guardar (o corpo cru fica no banco para suporte). */
export function redactPayload(raw: unknown): unknown {
  if (Array.isArray(raw)) return raw.map(redactPayload);
  if (raw && typeof raw === "object") {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) =>
        /secret|token|authorization|password/i.test(k)
          ? [k, "[redacted]"]
          : [k, redactPayload(v)],
      ),
    );
  }
  return raw;
}

const snapOf = (
  r: typeof subscriptions.$inferSelect,
): SubscriptionSnapshot => ({
  status: r.status,
  interval: r.interval,
  currentPeriodEnd: r.currentPeriodEnd?.toISOString() ?? null,
  graceUntil: r.graceUntil?.toISOString() ?? null,
  cancelAtPeriodEnd: r.cancelAtPeriodEnd,
});

export async function processBillingEvent(
  ev: NormalizedBillingEvent,
  raw: unknown,
  now = new Date(),
): Promise<ProcessResult> {
  // 1) guarda o evento; se já existe, é repetição do provedor
  const claimed = await db
    .insert(billingEvents)
    .values({
      provider: ev.provider,
      eventId: ev.eventId,
      type: ev.rawType,
      payload: redactPayload(raw) as object,
    })
    .onConflictDoNothing()
    .returning({ id: billingEvents.id });
  if (!claimed.length) return "duplicate";
  const eventRowId = claimed[0].id;
  const finish = (
    status: "applied" | "ignored" | "error",
    householdId: string | null,
    error?: string,
  ) =>
    db
      .update(billingEvents)
      .set({
        status,
        householdId,
        error: error ?? null,
        appliedAt: status === "applied" ? new Date() : null,
      })
      .where(eq(billingEvents.id, eventRowId));

  if (ev.type === "ignored") {
    await finish("ignored", null);
    return "ignored";
  }

  // 2) de quem é? (id da casa que enviamos no link, ou assinatura já conhecida)
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(
      and(
        eq(subscriptions.provider, ev.provider),
        eq(subscriptions.providerRef, ev.providerRef),
      ),
    );
  let householdId = existing?.householdId ?? null;
  if (!householdId && ev.householdRef && UUID_RE.test(ev.householdRef)) {
    const [h] = await db
      .select({ id: households.id })
      .from(households)
      .where(eq(households.id, ev.householdRef));
    householdId = h?.id ?? null;
  }
  if (!householdId) {
    await finish("error", null, "household_not_found");
    return "unmatched";
  }

  // 3) aplica na máquina de estados e grava
  const next = applyBillingEvent(existing ? snapOf(existing) : null, ev, now);
  const stayDunning =
    next.status === "past_due" && existing?.status === "past_due";
  const values = {
    householdId,
    provider: ev.provider,
    providerRef: ev.providerRef,
    interval: next.interval,
    status: next.status,
    currentPeriodEnd: next.currentPeriodEnd
      ? new Date(next.currentPeriodEnd)
      : null,
    graceUntil: next.graceUntil ? new Date(next.graceUntil) : null,
    cancelAtPeriodEnd: next.cancelAtPeriodEnd,
    payerEmail: ev.payerEmail ?? existing?.payerEmail ?? null,
    dunningStep: stayDunning ? (existing?.dunningStep ?? 0) : 0,
    updatedAt: now,
  };
  const [row] = await db
    .insert(subscriptions)
    .values(values)
    .onConflictDoUpdate({
      target: [subscriptions.provider, subscriptions.providerRef],
      set: values,
    })
    .returning();
  await finish("applied", householdId);

  // 4) primeiro aviso da falha de pagamento (os próximos saem no agendador)
  if (ev.type === "payment_failed" && row.dunningStep < 1) {
    await sendDunning(row, 1, now);
  }
  return "applied";
}

/** E-mails do dono da casa (lidos do Neon Auth) e do pagador. */
async function recipientEmails(
  householdId: string,
  payerEmail: string | null,
): Promise<string[]> {
  const rows = await db.execute<{ email: string | null }>(sql`
    select u.email as email
    from ${householdMembers} m
    join neon_auth."user" u on u.id::text = m.user_id
    where m.household_id = ${householdId} and m.kind = 'account' and m.role = 'owner'
  `);
  const list = [...rows.rows.map((r) => r.email), payerEmail].filter(
    (e): e is string => !!e && e.includes("@"),
  );
  return [...new Set(list.map((e) => e.toLowerCase()))];
}

/** Aviso de cobrança por e-mail e push (só push para quem ligou os avisos). Nunca lança. */
export async function sendDunning(
  sub: typeof subscriptions.$inferSelect,
  step: number,
  now: Date,
): Promise<void> {
  try {
    const [house] = await db
      .select({ name: households.name })
      .from(households)
      .where(eq(households.id, sub.householdId));
    const daysLeft = Math.max(
      0,
      Math.ceil(
        ((sub.graceUntil?.getTime() ?? now.getTime()) - now.getTime()) /
          86_400_000,
      ),
    );
    const base = (process.env.APP_URL ?? "https://ocafy.vercel.app").replace(
      /\/$/,
      "",
    );
    const mail = paymentFailedEmail({
      houseName: house?.name ?? "sua casa",
      daysLeft: daysLeft || GRACE_DAYS,
      step,
      url: `${base}/plano`,
    });
    for (const to of await recipientEmails(sub.householdId, sub.payerEmail)) {
      await sendEmail({ to, ...mail, tag: "billing" });
    }
    // push para os donos que ativaram avisos (o log com chave única evita repetir)
    const owners = await db
      .select({ id: householdMembers.id })
      .from(householdMembers)
      .where(
        and(
          eq(householdMembers.householdId, sub.householdId),
          eq(householdMembers.kind, "account"),
          eq(householdMembers.role, "owner"),
        ),
      );
    await Promise.allSettled(
      owners.map((o) =>
        deliver(sub.householdId, o.id, "billing", `billing:${sub.id}:${step}`, {
          title: "Não conseguimos cobrar sua assinatura",
          body: `O Plus continua por mais ${daysLeft} ${daysLeft === 1 ? "dia" : "dias"}. Atualize o pagamento.`,
          url: "/plano",
        }),
      ),
    );
    await db
      .update(subscriptions)
      .set({ dunningStep: step })
      .where(eq(subscriptions.id, sub.id));
  } catch {
    // cobrança não pode derrubar o processamento do evento
  }
}

export interface BillingTickSummary {
  expired: number;
  notices: number;
}

/**
 * Rotina periódica: encerra assinaturas cuja carência/período acabou e envia os avisos de
 * cobrança que estão no prazo (dia 3 e véspera do fim da carência).
 */
export async function runBillingTick(
  now = new Date(),
): Promise<BillingTickSummary> {
  const out: BillingTickSummary = { expired: 0, notices: 0 };
  const rows = await db
    .select()
    .from(subscriptions)
    .where(
      inArray(subscriptions.status, [
        "active",
        "trialing",
        "past_due",
        "canceled",
      ]),
    );
  for (const r of rows) {
    const snap = snapOf(r);
    if (shouldExpire(snap, now)) {
      await db
        .update(subscriptions)
        .set({ status: "expired", graceUntil: null, updatedAt: now })
        .where(eq(subscriptions.id, r.id));
      out.expired++;
      continue;
    }
    if (r.status === "past_due") {
      const step = dunningStepDue(snap.graceUntil, now);
      if (step > r.dunningStep) {
        await sendDunning(r, step, now);
        out.notices++;
      }
    }
  }
  return out;
}
