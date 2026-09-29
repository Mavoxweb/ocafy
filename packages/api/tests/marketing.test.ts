import { randomUUID } from "node:crypto";
import { DEFAULT_PROFILE, LEGAL_VERSION } from "@ocafy/core";
import {
  db,
  entitlementGrants,
  households,
  marketingCampaignEvents,
  marketingCampaigns,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { admin, appRouter, createCallerFactory } from "../src/index";

/**
 * Campanhas são GLOBAIS (como as chaves do painel): uma ativa aqui aparece para qualquer casa
 * elegível, inclusive as de outros testes rodando na mesma suíte. Por isso cada teste desativa a
 * própria campanha ao final (try/finally), mesmo se a asserção falhar no meio — sem isso, uma
 * campanha esquecida ativa poluiria os testes seguintes.
 */

const enabled =
  !!process.env.DATABASE_URL &&
  !!process.env.NEON_BRANCH &&
  process.env.NEON_BRANCH !== "production";

const caller = createCallerFactory(appRouter);
const houses: string[] = [];
const campaignIds: string[] = [];

const owner: admin.Actor = {
  userId: "test-mk-owner",
  email: `mk-owner-${randomUUID()}@test.local`,
  role: "owner",
};
const support: admin.Actor = {
  userId: "test-mk-support",
  email: `mk-support-${randomUUID()}@test.local`,
  role: "support",
};

async function newHouse(name: string) {
  const userId = `test-${randomUUID()}`;
  const c = caller({ userId });
  const { householdId } = await c.household.create({
    houseName: name,
    memberName: "Alex",
    acceptedLegalVersion: LEGAL_VERSION,
    profile: { ...DEFAULT_PROFILE, mode: "couple" },
    rooms: [{ kind: "cozinha" }],
    pets: [],
  });
  houses.push(householdId);
  return { c, householdId };
}

const codeOf = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TRPCError) return e.code;
    if (e instanceof admin.AdminError) return e.code;
    throw e;
  }
  return "OK";
};

const base = {
  title: "Assine o Plus",
  body: "Ganhe modo Família e pets ilimitados.",
  ctaLabel: "Ver planos",
  ctaUrl: "/plano",
  kind: "banner" as const,
  audience: "all" as const,
  priority: 0,
  startsAt: new Date(Date.now() - 60_000),
  endsAt: null,
  dismissible: true,
};

/** Cria já ativa e devolve uma função para desativar (chamar sempre no finally do teste). */
async function activeCampaign(
  input: Parameters<typeof admin.createCampaign>[1],
) {
  const created = await admin.createCampaign(owner, input);
  campaignIds.push(created.id);
  await admin.setCampaignActive(owner, {
    id: created.id,
    active: true,
    reason: "Ligar para o teste",
  });
  const off = () =>
    admin.setCampaignActive(owner, {
      id: created.id,
      active: false,
      reason: "Desligar ao fim do teste",
    });
  return { created, off };
}

afterAll(async () => {
  if (!enabled) return;
  if (campaignIds.length)
    await db
      .delete(marketingCampaigns)
      .where(inArray(marketingCampaigns.id, campaignIds));
  if (houses.length)
    await db.delete(households).where(inArray(households.id, houses));
});

describe.skipIf(!enabled)("marketing interno (Neon dev)", () => {
  it("campanha nasce inativa; casa só vê depois de ativada, e com os dados certos", async () => {
    const { c } = await newHouse("Casa Marketing 1");
    const created = await admin.createCampaign(owner, {
      ...base,
      reason: "Campanha de teste",
    });
    campaignIds.push(created.id);
    try {
      let snap = await c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign).toBeNull(); // inativa

      await admin.setCampaignActive(owner, {
        id: created.id,
        active: true,
        reason: "Ligar para o teste",
      });
      snap = await c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign).toMatchObject({
        id: created.id,
        title: base.title,
        ctaUrl: "/plano",
        kind: "banner",
      });
    } finally {
      await admin.setCampaignActive(owner, {
        id: created.id,
        active: false,
        reason: "Desligar ao fim do teste",
      });
    }
  });

  it("banner some só depois de dispensado; clicar também conta como resolvido", async () => {
    const a = await newHouse("Casa Marketing Banner A");
    const b = await newHouse("Casa Marketing Banner B");
    const { created, off } = await activeCampaign({
      ...base,
      reason: "Banner de teste",
    });
    try {
      let snap = await a.c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign?.id).toBe(created.id);
      // só "ver" (sem confirmar) não esconde um banner
      await a.c.campaign.acknowledge({ id: created.id, action: "shown" });
      snap = await a.c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign?.id).toBe(created.id);

      await a.c.campaign.acknowledge({ id: created.id, action: "dismissed" });
      snap = await a.c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign).toBeNull();

      // a casa B nunca dispensou: continua vendo
      snap = await b.c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign?.id).toBe(created.id);
      await b.c.campaign.acknowledge({ id: created.id, action: "clicked" });
      snap = await b.c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign).toBeNull();
    } finally {
      await off();
    }
  });

  it("modal some assim que foi exibido uma vez (não precisa dispensar)", async () => {
    const { c } = await newHouse("Casa Marketing Modal");
    const { created, off } = await activeCampaign({
      ...base,
      kind: "modal",
      reason: "Modal de teste",
    });
    try {
      let snap = await c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign?.kind).toBe("modal");
      await c.campaign.acknowledge({ id: created.id, action: "shown" });
      snap = await c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign).toBeNull();
    } finally {
      await off();
    }
  });

  it("repetir o mesmo evento não duplica nem infla as estatísticas", async () => {
    const { c } = await newHouse("Casa Marketing Stats");
    const { created, off } = await activeCampaign({
      ...base,
      reason: "Campanha de stats",
    });
    try {
      for (let i = 0; i < 3; i++) {
        await c.campaign.acknowledge({ id: created.id, action: "shown" });
      }
      const rows = await db
        .select()
        .from(marketingCampaignEvents)
        .where(eq(marketingCampaignEvents.campaignId, created.id));
      expect(rows.filter((r) => r.kind === "shown")).toHaveLength(1);
      const list = await admin.listCampaignsWithStats();
      const mine = list.find((x) => x.campaign.id === created.id);
      expect(mine?.stats).toEqual({ shown: 1, clicked: 0, dismissed: 0 });
    } finally {
      await off();
    }
  });

  it("audiência: campanha só para o Plus não aparece numa casa Grátis", async () => {
    const { c, householdId } = await newHouse("Casa Marketing Free");
    await db
      .update(entitlementGrants)
      .set({ revokedAt: new Date() })
      .where(eq(entitlementGrants.householdId, householdId));
    const { off } = await activeCampaign({
      ...base,
      audience: "plus",
      reason: "Campanha só Plus",
    });
    try {
      const snap = await c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.plan.id).toBe("free");
      expect(snap.data.campaign).toBeNull();
    } finally {
      await off();
    }
  });

  it("prioridade decide qual campanha aparece quando há mais de uma elegível", async () => {
    const { c } = await newHouse("Casa Marketing Prioridade");
    const low = await activeCampaign({
      ...base,
      priority: 1,
      reason: "Prioridade baixa",
    });
    const high = await activeCampaign({
      ...base,
      priority: 9,
      reason: "Prioridade alta",
    });
    try {
      const snap = await c.household.snapshot();
      if (snap.status !== "ready") throw new Error();
      expect(snap.data.campaign?.id).toBe(high.created.id);
    } finally {
      await low.off();
      await high.off();
    }
  });

  it("validações: título/corpo obrigatórios, link precisa começar com / ou http(s)", async () => {
    expect(
      await codeOf(() =>
        admin.createCampaign(owner, {
          ...base,
          title: "  ",
          reason: "Teste de validação",
        }),
      ),
    ).toBe("invalid");
    expect(
      await codeOf(() =>
        admin.createCampaign(owner, {
          ...base,
          ctaUrl: "javascript:alert(1)",
          reason: "Teste de validação",
        }),
      ),
    ).toBe("invalid");
    expect(
      await codeOf(() =>
        admin.createCampaign(owner, {
          ...base,
          startsAt: new Date(2030, 0, 2),
          endsAt: new Date(2030, 0, 1),
          reason: "Teste de validação",
        }),
      ),
    ).toBe("invalid");
  });

  it("permissão: suporte não cria/edita campanhas, mas leitura funciona", async () => {
    expect(
      await codeOf(() =>
        admin.createCampaign(support, {
          ...base,
          reason: "Tentando sem permissão",
        }),
      ),
    ).toBe("forbidden");
    const created = await admin.createCampaign(owner, {
      ...base,
      reason: "Campanha de leitura",
    });
    campaignIds.push(created.id);
    expect(
      await codeOf(() =>
        admin.setCampaignActive(support, {
          id: created.id,
          active: true,
          reason: "Tentando sem permissão",
        }),
      ),
    ).toBe("forbidden");
    const list = await admin.listCampaignsWithStats();
    expect(list.some((x) => x.campaign.id === created.id)).toBe(true);
  });

  it("excluir só é permitido sem histórico; com eventos, é preciso desativar", async () => {
    const { c } = await newHouse("Casa Marketing Delete");
    const { created, off } = await activeCampaign({
      ...base,
      reason: "Campanha com uso",
    });
    try {
      await c.campaign.acknowledge({ id: created.id, action: "shown" });
      expect(
        await codeOf(() =>
          admin.deleteCampaign(owner, {
            id: created.id,
            reason: "Tentando excluir",
          }),
        ),
      ).toBe("conflict");
    } finally {
      await off();
    }
    const fresh = await admin.createCampaign(owner, {
      ...base,
      reason: "Campanha sem uso",
    });
    await admin.deleteCampaign(owner, {
      id: fresh.id,
      reason: "Sem uso, pode apagar",
    });
    const list = await admin.listCampaignsWithStats();
    expect(list.some((x) => x.campaign.id === fresh.id)).toBe(false);
    campaignIds.push(created.id); // fica para o cleanup final (tem evento)
  });
});
