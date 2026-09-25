import { describe, expect, it } from "vitest";
import {
  GRACE_DAYS,
  type NormalizedBillingEvent,
  type SubscriptionSnapshot,
  applyBillingEvent,
  dunningStepDue,
  parseCaktoEvent,
  parseRevenueCatEvent,
  shouldExpire,
} from "../src/index";

const now = new Date("2026-09-24T12:00:00Z");
const day = (n: number, from = now) =>
  new Date(from.getTime() + n * 86_400_000).toISOString();
const HOUSE = "0f8b6c5e-3a4d-4b7e-9c11-2d5f6a7b8c90";

const ev = (
  over: Partial<NormalizedBillingEvent> = {},
): NormalizedBillingEvent => ({
  provider: "cakto",
  eventId: "e1",
  type: "activated",
  providerRef: "sub-1",
  householdRef: HOUSE,
  interval: "quarterly",
  periodEnd: null,
  payerEmail: "pagador@example.com",
  occurredAt: now.toISOString(),
  rawType: "x",
  ...over,
});

describe("máquina de estados da assinatura", () => {
  it("ativação abre um período do tamanho do plano", () => {
    const s = applyBillingEvent(null, ev(), now);
    expect(s.status).toBe("active");
    expect(s.currentPeriodEnd).toBe(day(92));
    expect(
      applyBillingEvent(null, ev({ interval: "yearly" }), now).currentPeriodEnd,
    ).toBe(day(366));
  });

  it("usa o fim de período do provedor quando ele informa", () => {
    const s = applyBillingEvent(null, ev({ periodEnd: day(90) }), now);
    expect(s.currentPeriodEnd).toBe(day(90));
  });

  it("renovação soma ao período que ainda restava; evento repetido não encolhe", () => {
    const a = applyBillingEvent(null, ev(), now);
    const b = applyBillingEvent(
      a,
      ev({ type: "renewed", eventId: "e2" }),
      day(80) ? new Date(day(80)) : now,
    );
    expect(new Date(b.currentPeriodEnd as string).getTime()).toBeGreaterThan(
      new Date(a.currentPeriodEnd as string).getTime(),
    );
    const again = applyBillingEvent(
      a,
      ev({ periodEnd: day(10), eventId: "e3" }),
      now,
    );
    expect(again.currentPeriodEnd).toBe(a.currentPeriodEnd);
  });

  it("falha de pagamento: carência de 7 dias contada da primeira falha", () => {
    const a = applyBillingEvent(null, ev(), now);
    const f1 = applyBillingEvent(
      a,
      ev({ type: "payment_failed" }),
      new Date(day(93)),
    );
    expect(f1.status).toBe("past_due");
    expect(f1.graceUntil).toBe(day(93 + GRACE_DAYS));
    // nova tentativa recusada no dia seguinte NÃO estende a carência
    const f2 = applyBillingEvent(
      f1,
      ev({ type: "payment_failed", eventId: "e9" }),
      new Date(day(94)),
    );
    expect(f2.graceUntil).toBe(f1.graceUntil);
    // pagou: volta ao normal
    const ok = applyBillingEvent(
      f2,
      ev({ type: "renewed", eventId: "e10" }),
      new Date(day(95)),
    );
    expect(ok).toMatchObject({
      status: "active",
      graceUntil: null,
      cancelAtPeriodEnd: false,
    });
  });

  it("cancelamento mantém o período pago; reembolso e chargeback encerram na hora", () => {
    const a = applyBillingEvent(null, ev(), now);
    const c = applyBillingEvent(a, ev({ type: "canceled" }), now);
    expect(c).toMatchObject({
      status: "canceled",
      cancelAtPeriodEnd: true,
      currentPeriodEnd: a.currentPeriodEnd,
    });
    for (const type of ["refunded", "chargeback"] as const) {
      const r = applyBillingEvent(a, ev({ type }), now);
      expect(r.status).toBe("expired");
      expect(r.currentPeriodEnd).toBe(now.toISOString());
    }
    expect(applyBillingEvent(a, ev({ type: "ignored" }), now)).toEqual(a);
  });
});

describe("cobrança e expiração", () => {
  it("passos do aviso de falha: dia 0, dia 3 e véspera do fim", () => {
    const failedAt = now;
    const grace = day(GRACE_DAYS, failedAt);
    expect(dunningStepDue(grace, now)).toBe(1);
    expect(dunningStepDue(grace, new Date(day(2)))).toBe(1);
    expect(dunningStepDue(grace, new Date(day(3)))).toBe(2);
    expect(dunningStepDue(grace, new Date(day(5)))).toBe(2);
    expect(dunningStepDue(grace, new Date(day(6)))).toBe(3);
    expect(dunningStepDue(null, now)).toBe(0);
  });

  it("expira quando a carência acaba, o período cancelado termina ou o evento nunca chegou", () => {
    const base = { currentPeriodEnd: day(-1), graceUntil: null };
    expect(
      shouldExpire(
        { status: "past_due", currentPeriodEnd: day(-9), graceUntil: day(-1) },
        now,
      ),
    ).toBe(true);
    expect(
      shouldExpire(
        { status: "past_due", currentPeriodEnd: day(-9), graceUntil: day(2) },
        now,
      ),
    ).toBe(false);
    expect(shouldExpire({ status: "canceled", ...base }, now)).toBe(true);
    expect(
      shouldExpire(
        { status: "canceled", currentPeriodEnd: day(5), graceUntil: null },
        now,
      ),
    ).toBe(false);
    // "ativa" vencida há pouco: dá tempo do provedor avisar; passou de 3 dias, expira
    expect(shouldExpire({ status: "active", ...base }, now)).toBe(false);
    expect(
      shouldExpire(
        { status: "active", currentPeriodEnd: day(-4), graceUntil: null },
        now,
      ),
    ).toBe(true);
  });
});

describe("adaptadores", () => {
  it("Cakto: compra aprovada com a casa no ref do link", () => {
    const e = parseCaktoEvent({
      secret: "xxx",
      event: "purchase_approved",
      data: {
        id: "pay-1",
        refId: "sub-77",
        customer: { email: "Ana@Example.com" },
        subscription: { id: "sub-77", recurrence_period: "quarterly" },
        checkoutUrl: `https://pay.cakto.com.br/abc?ref=${HOUSE}`,
        tracking: { ref: HOUSE },
      },
    });
    expect(e).toMatchObject({
      provider: "cakto",
      type: "activated",
      providerRef: "sub-77",
      householdRef: HOUSE,
      interval: "quarterly",
      payerEmail: "ana@example.com",
    });
  });

  it("Cakto: renovação recusada vira falha de pagamento; eventos desconhecidos são ignorados", () => {
    expect(
      parseCaktoEvent({
        event: "subscription_renewal_refused",
        data: { id: "p", subscription: { id: "s" } },
      })?.type,
    ).toBe("payment_failed");
    expect(
      parseCaktoEvent({ event: "pix_gerado", data: { id: "p" } })?.type,
    ).toBe("ignored");
    expect(
      parseCaktoEvent({
        event: "refund",
        data: { id: "p", subscription: { id: "s" } },
      })?.type,
    ).toBe("refunded");
    expect(parseCaktoEvent({ nada: true })).toBeNull();
    expect(parseCaktoEvent("texto")).toBeNull();
  });

  it("Cakto: id do evento é estável para o mesmo pagamento (idempotência)", () => {
    const p = {
      event: "purchase_approved",
      data: { id: "pay-9", subscription: { id: "s" } },
    };
    expect(parseCaktoEvent(p)?.eventId).toBe(parseCaktoEvent(p)?.eventId);
  });

  it("RevenueCat/Play: tipos, casa e fim do período", () => {
    const exp = Date.parse(day(31));
    const e = parseRevenueCatEvent({
      api_version: "1.0",
      event: {
        id: "rc-1",
        type: "INITIAL_PURCHASE",
        app_user_id: HOUSE,
        product_id: "plus_yearly",
        expiration_at_ms: exp,
        event_timestamp_ms: now.getTime(),
      },
    });
    expect(e).toMatchObject({
      provider: "play",
      eventId: "rc-1",
      type: "activated",
      householdRef: HOUSE,
      interval: "yearly",
      periodEnd: new Date(exp).toISOString(),
    });
    expect(
      parseRevenueCatEvent({
        event: { id: "2", type: "BILLING_ISSUE", app_user_id: HOUSE },
      })?.type,
    ).toBe("payment_failed");
    expect(
      parseRevenueCatEvent({
        event: { id: "3", type: "TEST", app_user_id: "$RCAnonymousID:abc" },
      }),
    ).toMatchObject({
      type: "ignored",
      householdRef: null,
    });
    expect(parseRevenueCatEvent({})).toBeNull();
  });
});
