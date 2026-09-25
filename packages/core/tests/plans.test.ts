import { describe, expect, it } from "vitest";
import {
  PLAN_ENTITLEMENTS,
  type PlanGrant,
  formatBRL,
  parsePlanLimit,
  planLimitMessage,
  planViolations,
  resolvePlan,
  subscriptionGrantsPlus,
} from "../src/index";

const now = new Date("2026-09-24T12:00:00Z");
const day = (n: number) =>
  new Date(now.getTime() + n * 86_400_000).toISOString();

const grant = (over: Partial<PlanGrant> = {}): PlanGrant => ({
  plan: "plus",
  source: "trial",
  startsAt: day(-1),
  expiresAt: day(13),
  revokedAt: null,
  ...over,
});

describe("plano efetivo", () => {
  it("sem nada, é grátis", () => {
    const r = resolvePlan(now, []);
    expect(r.plan).toBe("free");
    expect(r.entitlements).toEqual(PLAN_ENTITLEMENTS.free);
    expect(r.source).toBeNull();
  });

  it("teste de 14 dias dá Plus e informa quando termina", () => {
    const r = resolvePlan(now, [grant()]);
    expect(r.plan).toBe("plus");
    expect(r.source).toBe("trial");
    expect(r.trialEndsAt).toBe(day(13));
    expect(r.entitlements.family).toBe(true);
  });

  it("teste vencido, revogado ou que ainda não começou não vale", () => {
    expect(resolvePlan(now, [grant({ expiresAt: day(-1) })]).plan).toBe("free");
    expect(resolvePlan(now, [grant({ revokedAt: day(-2) })]).plan).toBe("free");
    expect(resolvePlan(now, [grant({ startsAt: day(2) })]).plan).toBe("free");
  });

  it("cortesia sem prazo (casas fundadoras) vale e vence o teste como origem", () => {
    const r = resolvePlan(now, [
      grant(),
      grant({ source: "founder", expiresAt: null }),
    ]);
    expect(r.source).toBe("founder");
    expect(r.expiresAt).toBeNull();
    expect(r.trialEndsAt).toBeNull();
  });

  it("liberação manual grátis com ajustes: mais pets sem virar Plus", () => {
    const r = resolvePlan(now, [
      grant({
        plan: "free",
        source: "manual",
        expiresAt: null,
        overrides: { maxPets: 3 },
      }),
    ]);
    expect(r.plan).toBe("free");
    expect(r.entitlements).toEqual({
      family: false,
      maxPets: 3,
      maxProjects: 1,
    });
  });
});

describe("assinatura e falha de pagamento", () => {
  const sub = (over: object) => ({
    status: "active" as const,
    currentPeriodEnd: day(30),
    graceUntil: null as string | null,
    ...over,
  });

  it("ativa dentro do período; expira depois dele", () => {
    expect(subscriptionGrantsPlus(sub({}), now)).toBe(true);
    expect(
      subscriptionGrantsPlus(sub({ currentPeriodEnd: day(-1) }), now),
    ).toBe(false);
    expect(subscriptionGrantsPlus(null, now)).toBe(false);
  });

  it("cancelada continua até o fim do período pago", () => {
    expect(subscriptionGrantsPlus(sub({ status: "canceled" }), now)).toBe(true);
    expect(
      subscriptionGrantsPlus(
        sub({ status: "canceled", currentPeriodEnd: day(-1) }),
        now,
      ),
    ).toBe(false);
  });

  it("falha de pagamento: carência mantém o Plus e sinaliza; passada a carência, cai para grátis", () => {
    const grace = resolvePlan(
      now,
      [],
      sub({
        status: "past_due",
        currentPeriodEnd: day(-2),
        graceUntil: day(5),
      }),
    );
    expect(grace.plan).toBe("plus");
    expect(grace.pastDue).toBe(true);
    expect(grace.expiresAt).toBe(day(5));
    const over = resolvePlan(
      now,
      [],
      sub({
        status: "past_due",
        currentPeriodEnd: day(-9),
        graceUntil: day(-2),
      }),
    );
    expect(over.plan).toBe("free");
    expect(over.pastDue).toBe(false);
    expect(subscriptionGrantsPlus(sub({ status: "expired" }), now)).toBe(false);
  });

  it("assinatura vence o teste como origem", () => {
    expect(resolvePlan(now, [grant()], sub({})).source).toBe("subscription");
  });
});

describe("limites: só barram aumentos", () => {
  const free = PLAN_ENTITLEMENTS.free;
  const use = (mode: string, pets: number, projects = 0) => ({
    mode,
    pets,
    projects,
  });

  it("família exige Plus para entrar, mas quem já é família não é bloqueado", () => {
    expect(planViolations(free, use("couple", 0), use("family", 0))).toEqual([
      "family",
    ]);
    expect(planViolations(free, use("family", 0), use("family", 0))).toEqual(
      [],
    );
    expect(
      planViolations(
        PLAN_ENTITLEMENTS.plus,
        use("couple", 0),
        use("family", 0),
      ),
    ).toEqual([]);
  });

  it("pets: no grátis 1; quem tem 3 (herdados) mantém, mas não adiciona", () => {
    expect(planViolations(free, use("couple", 0), use("couple", 1))).toEqual(
      [],
    );
    expect(planViolations(free, use("couple", 1), use("couple", 2))).toEqual([
      "pets",
    ]);
    expect(planViolations(free, use("couple", 3), use("couple", 3))).toEqual(
      [],
    );
    expect(planViolations(free, use("couple", 3), use("couple", 2))).toEqual(
      [],
    );
    expect(planViolations(free, use("couple", 3), use("couple", 4))).toEqual([
      "pets",
    ]);
  });

  it("mensagem de limite carrega a violação e o texto", () => {
    const m = planLimitMessage("family");
    expect(parsePlanLimit(m)).toEqual({
      violation: "family",
      text: "O modo Família faz parte do plano Plus.",
    });
    expect(parsePlanLimit("outro erro")).toBeNull();
  });

  it("formata preço em reais", () => {
    expect(formatBRL(2490).replace(/\s/g, " ")).toMatch(/R\$\s?24,90/);
  });
});
