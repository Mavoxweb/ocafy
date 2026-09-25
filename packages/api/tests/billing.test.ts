import { randomUUID } from "node:crypto";
import {
  DEFAULT_PROFILE,
  GRACE_DAYS,
  type NormalizedBillingEvent,
  parseCaktoEvent,
} from "@ocafy/core";
import {
  billingEvents,
  db,
  entitlementGrants,
  households,
  subscriptions,
} from "@ocafy/db";
import { eq, inArray, like } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import * as email from "../src/email/send";
import {
  appRouter,
  createCallerFactory,
  processBillingEvent,
  runBillingTick,
} from "../src/index";
import * as push from "../src/push";

/** E-mail e push reais são substituídos por espiões: aqui se testa a regra, não o envio. */
vi.mock("../src/email/send", async (orig) => {
  const real = await orig<typeof import("../src/email/send")>();
  return {
    ...real,
    sendEmail: vi.fn(async () => ({ sent: true as const, id: "test" })),
  };
});
vi.mock("../src/push", async (orig) => {
  const real = await orig<typeof import("../src/push")>();
  return {
    ...real,
    pushConfigured: () => true,
    sendPush: vi.fn(async () => ({ ok: true as const })),
  };
});

const enabled =
  !!process.env.DATABASE_URL &&
  !!process.env.NEON_BRANCH &&
  process.env.NEON_BRANCH !== "production";

const caller = createCallerFactory(appRouter);
const created: string[] = [];
const runId = randomUUID().slice(0, 8);
const sendEmailSpy = vi.mocked(email.sendEmail);
const sendPushSpy = vi.mocked(push.sendPush);
const DAY = 86_400_000;

async function newSubscriberHouse(name: string) {
  const userId = `test-${randomUUID()}`;
  const c = caller({ userId });
  const { householdId } = await c.household.create({
    houseName: name,
    memberName: "Alex",
    profile: { ...DEFAULT_PROFILE, mode: "couple" },
    rooms: [{ kind: "cozinha" }],
    pets: [],
  });
  created.push(householdId);
  // sem o teste de boas-vindas: o plano passa a depender só da assinatura
  await db
    .update(entitlementGrants)
    .set({ revokedAt: new Date() })
    .where(eq(entitlementGrants.householdId, householdId));
  return { c, householdId };
}

const plan = async (c: ReturnType<typeof caller>) => {
  const s = await c.household.snapshot();
  if (s.status !== "ready") throw new Error();
  return s.data.plan;
};

let n = 0;
const cakto = (
  householdId: string,
  event: string,
  over: Record<string, unknown> = {},
  sub = `sub-${runId}`,
): NormalizedBillingEvent => {
  const ev = parseCaktoEvent({
    secret: "nao-deve-ser-guardado",
    event,
    data: {
      id: `pay-${runId}-${++n}`,
      customer: { email: "pagador@example.com" },
      subscription: { id: sub, recurrence_period: "quarterly" },
      tracking: { ref: householdId },
      ...over,
    },
  });
  if (!ev) throw new Error("evento inválido");
  return ev;
};

beforeEach(() => {
  sendEmailSpy.mockClear();
  sendPushSpy.mockClear();
});

afterAll(async () => {
  if (!enabled) return;
  await db
    .delete(billingEvents)
    .where(like(billingEvents.eventId, `%${runId}%`));
  if (created.length)
    await db.delete(households).where(inArray(households.id, created));
});

describe.skipIf(!enabled)("assinatura e cobrança (Neon dev)", () => {
  it("compra aprovada libera o Plus; evento repetido é ignorado; segredo não é guardado", async () => {
    const { c, householdId } = await newSubscriberHouse("Casa Assina");
    expect((await plan(c)).id).toBe("free");

    const ev = cakto(householdId, "purchase_approved");
    expect(
      await processBillingEvent(ev, {
        secret: "x",
        event: "purchase_approved",
      }),
    ).toBe("applied");
    expect(await plan(c)).toMatchObject({
      id: "plus",
      source: "subscription",
      pastDue: false,
    });

    // o provedor reenviou: nada muda, nada duplica
    expect(await processBillingEvent(ev, {})).toBe("duplicate");
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.householdId, householdId));
    expect(subs).toHaveLength(1);
    expect(subs[0]).toMatchObject({
      status: "active",
      provider: "cakto",
      interval: "quarterly",
    });

    // o corpo cru fica guardado, sem segredos
    const [row] = await db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.eventId, ev.eventId));
    expect(row.status).toBe("applied");
    expect(JSON.stringify(row.payload)).not.toContain("nao-deve-ser-guardado");
    expect(JSON.stringify(row.payload)).toContain("[redacted]");
    expect(row.householdId).toBe(householdId);
  });

  it("evento de uma casa que não existe fica registrado como não reconciliado", async () => {
    const ev = cakto(randomUUID(), "purchase_approved", {}, `orphan-${runId}`);
    expect(await processBillingEvent(ev, {})).toBe("unmatched");
    const [row] = await db
      .select()
      .from(billingEvents)
      .where(eq(billingEvents.eventId, ev.eventId));
    expect(row).toMatchObject({
      status: "error",
      error: "household_not_found",
    });
    const subs = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerRef, `orphan-${runId}`));
    expect(subs).toHaveLength(0);
    // evento que não muda assinatura (Pix gerado)
    const ig = cakto(randomUUID(), "pix_gerado", {}, `ig-${runId}`);
    expect(await processBillingEvent(ig, {})).toBe("ignored");
  });

  it("falha de pagamento: carência de 7 dias, avisos no dia 0/3/6 e volta ao grátis sem apagar nada", async () => {
    const { c, householdId } = await newSubscriberHouse("Casa Falha");
    const sub = `fail-${runId}`;
    await processBillingEvent(
      cakto(householdId, "purchase_approved", {}, sub),
      {},
    );
    await c.tasks.complete({
      taskKey: "aspirar",
      at: new Date().toISOString(),
      dateKey: new Date().toISOString().slice(0, 10),
      pts: 10,
    });

    const t0 = new Date();
    // a falha acontece na renovação: o período pago acabou de vencer
    await db
      .update(subscriptions)
      .set({ currentPeriodEnd: new Date(t0.getTime() - 3_600_000) })
      .where(eq(subscriptions.providerRef, sub));
    expect(
      await processBillingEvent(
        cakto(householdId, "subscription_renewal_refused", {}, sub),
        {},
        t0,
      ),
    ).toBe("applied");
    let p = await plan(c);
    expect(p).toMatchObject({ id: "plus", pastDue: true });
    const [s0] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerRef, sub));
    expect(s0.status).toBe("past_due");
    expect(
      Math.round((s0.graceUntil as Date).getTime() - t0.getTime()) / DAY,
    ).toBeCloseTo(GRACE_DAYS, 0);
    // 1º aviso já saiu (e-mail ao pagador, dono e push só para quem ligou)
    expect(sendEmailSpy).toHaveBeenCalled();
    expect(
      sendEmailSpy.mock.calls.some(
        ([m]) => String(m.to) === "pagador@example.com",
      ),
    ).toBe(true);
    expect(s0.dunningStep).toBe(1);

    // nova recusa não estende a carência
    await processBillingEvent(
      cakto(householdId, "subscription_renewal_refused", {}, sub),
      {},
      new Date(t0.getTime() + DAY),
    );
    const [s1] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerRef, sub));
    expect(s1.graceUntil?.getTime()).toBe(s0.graceUntil?.getTime());

    // dia 3 e dia 6: avisos; sem duplicar
    sendEmailSpy.mockClear();
    const d3 = await runBillingTick(new Date(t0.getTime() + 3 * DAY));
    expect(d3.notices).toBeGreaterThanOrEqual(1);
    const again = await runBillingTick(new Date(t0.getTime() + 3.5 * DAY));
    expect(again.notices).toBe(0);
    await runBillingTick(new Date(t0.getTime() + 6 * DAY));
    const [s2] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerRef, sub));
    expect(s2.dunningStep).toBe(3);

    // passou da carência: expira e a casa volta ao grátis; o histórico continua
    const end = await runBillingTick(
      new Date(t0.getTime() + (GRACE_DAYS + 1) * DAY),
    );
    expect(end.expired).toBeGreaterThanOrEqual(1);
    // (a data "agora" real ainda está dentro da carência; forçamos o vencimento no banco)
    await db
      .update(subscriptions)
      .set({
        graceUntil: new Date(Date.now() - DAY),
        currentPeriodEnd: new Date(Date.now() - 9 * DAY),
      })
      .where(eq(subscriptions.providerRef, sub));
    p = await plan(c);
    expect(p.id).toBe("free");
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.completions).toHaveLength(1);
  });

  it("pagou depois da falha: volta ao normal; cancelamento vale até o fim; reembolso encerra na hora", async () => {
    const { c, householdId } = await newSubscriberHouse("Casa Ciclo");
    const sub = `cycle-${runId}`;
    await processBillingEvent(
      cakto(householdId, "purchase_approved", {}, sub),
      {},
    );
    await processBillingEvent(
      cakto(householdId, "subscription_renewal_refused", {}, sub),
      {},
    );
    expect((await plan(c)).pastDue).toBe(true);
    await processBillingEvent(
      cakto(householdId, "subscription_renewed", {}, sub),
      {},
    );
    expect(await plan(c)).toMatchObject({ id: "plus", pastDue: false });

    await processBillingEvent(
      cakto(householdId, "subscription_canceled", {}, sub),
      {},
    );
    const p = await plan(c);
    expect(p.id).toBe("plus"); // pago até o fim do período
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.providerRef, sub));
    expect(row).toMatchObject({ status: "canceled", cancelAtPeriodEnd: true });

    await processBillingEvent(cakto(householdId, "refund", {}, sub), {});
    expect((await plan(c)).id).toBe("free");
  });

  it("Google Play (RevenueCat): mesmo fluxo pelo adaptador do Play", async () => {
    const { parseRevenueCatEvent } = await import("@ocafy/core");
    const { c, householdId } = await newSubscriberHouse("Casa Play");
    const ev = parseRevenueCatEvent({
      event: {
        id: `rc-${runId}-1`,
        type: "INITIAL_PURCHASE",
        app_user_id: householdId,
        product_id: "plus_yearly",
        expiration_at_ms: Date.now() + 365 * DAY,
      },
    });
    if (!ev) throw new Error();
    expect(await processBillingEvent(ev, {})).toBe("applied");
    expect(await plan(c)).toMatchObject({ id: "plus", source: "subscription" });
    const [row] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.householdId, householdId));
    expect(row).toMatchObject({ provider: "play", interval: "yearly" });
  });
});
