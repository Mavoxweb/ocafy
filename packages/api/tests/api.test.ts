import { randomUUID } from "node:crypto";
import { db, households } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { appRouter, createCallerFactory } from "../src/index";

/**
 * Testes de integração contra um banco Neon REAL. Só rodam quando há
 * DATABASE_URL e a branch não é produção (NEON_BRANCH), para nunca sujar
 * dados de verdade. Cada teste cria casas próprias e apaga tudo no fim.
 */
const enabled =
  !!process.env.DATABASE_URL &&
  !!process.env.NEON_BRANCH &&
  process.env.NEON_BRANCH !== "production";

const caller = createCallerFactory(appRouter);
const as = (userId: string | null) => caller({ userId });

const litter = {
  cats: 3,
  boxes: 2,
  kgPerBox: 4,
  bagKg: 4,
  minDays: 5,
  maxDays: 7,
};
const created: string[] = [];

async function newHouse(name = "Casa Teste", stock: number | null = 6) {
  const userId = `test-${randomUUID()}`;
  const c = as(userId);
  const { householdId } = await c.household.create({
    houseName: name,
    memberName: "Alex",
    rooms: ["cozinha", "gatos"],
    litter,
    litterStock: stock,
  });
  created.push(householdId);
  return { userId, c, householdId };
}

const now = () => new Date();
const key = (d: Date) => d.toISOString().slice(0, 10);
const completion = (over: Record<string, unknown> = {}) => ({
  at: now().toISOString(),
  dateKey: key(now()),
  pts: 10,
  ...over,
});

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TRPCError) return e.code;
    throw e;
  }
  return "OK";
};

afterAll(async () => {
  if (enabled && created.length) {
    await db.delete(households).where(inArray(households.id, created));
  }
});

describe.skipIf(!enabled)("API (Neon dev)", () => {
  it("exige login e casa", async () => {
    expect(await code(() => as(null).household.snapshot())).toBe(
      "UNAUTHORIZED",
    );
    expect(
      await code(() =>
        as(`test-${randomUUID()}`).tasks.complete({
          taskKey: "lixo",
          ...completion(),
        }),
      ),
    ).toBe("PRECONDITION_FAILED");
    const snap = await as(`test-${randomUUID()}`).household.snapshot();
    expect(snap.status).toBe("none");
  });

  it("cria a casa e devolve o snapshot completo", async () => {
    const { c, householdId } = await newHouse("Casa Alfa");
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error("esperava casa");
    const d = snap.data;
    expect(d.household.id).toBe(householdId);
    expect(d.members).toHaveLength(1);
    expect(d.members[0].slot).toBe("a");
    expect(d.isOwner).toBe(true);
    expect(d.rooms.sort()).toEqual(["casa", "cozinha", "gatos"]);
    expect(d.litterStock).toBe(6);
    expect(d.rewards.length).toBeGreaterThanOrEqual(6);
    expect(d.completions).toEqual([]);
  });

  it("não deixa a mesma conta criar duas casas", async () => {
    const { userId } = await newHouse();
    expect(
      await code(() =>
        as(userId).household.create({
          houseName: "Outra",
          memberName: "Alex",
          rooms: [],
          litter,
          litterStock: null,
        }),
      ),
    ).toBe("CONFLICT");
  });

  it("isola as casas entre si", async () => {
    const a = await newHouse("Casa A");
    const b = await newHouse("Casa B");
    const { id } = await a.c.tasks.complete({
      taskKey: "lixo",
      ...completion(),
    });

    const snapB = await b.c.household.snapshot();
    if (snapB.status !== "ready") throw new Error();
    expect(snapB.data.completions).toHaveLength(0);

    // B não consegue reagir, desfazer nem apagar dados de A
    expect(
      await code(() =>
        b.c.social.toggleReaction({ completionId: id, emoji: "fogo" }),
      ),
    ).toBe("NOT_FOUND");
    await b.c.tasks.remove({ id }); // idempotente, mas não remove nada de A
    const snapA = await a.c.household.snapshot();
    if (snapA.status !== "ready") throw new Error();
    expect(snapA.data.completions).toHaveLength(1);
  });

  it("limita o XP à faixa da tarefa e valida datas", async () => {
    const { c } = await newHouse();
    // lixo = 3 min → base 8, máx 11
    const hi = await c.tasks.complete({
      taskKey: "lixo",
      ...completion({ pts: 500 }),
    });
    expect(hi.pts).toBe(11);
    const lo = await c.tasks.complete({
      taskKey: "lixo",
      ...completion({ pts: 1 }),
    });
    expect(lo.pts).toBe(8);
    expect(
      await code(() =>
        c.tasks.complete({ taskKey: "nao_existe", ...completion() }),
      ),
    ).toBe("BAD_REQUEST");
    const old = new Date(Date.now() - 90 * 864e5);
    expect(
      await code(() =>
        c.tasks.complete({
          taskKey: "lixo",
          ...completion({ at: old.toISOString(), dateKey: key(old) }),
        }),
      ),
    ).toBe("BAD_REQUEST");
  });

  it("troca de areia desconta o estoque e desfazer devolve", async () => {
    const { c } = await newHouse("Casa Areia", 6);
    const { id } = await c.tasks.complete({
      taskKey: "area_troca",
      ...completion({ pts: 30 }),
    });
    let snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.litterStock).toBe(4); // 2 caixas × 4 kg / saco de 4 kg = 2 sacos
    await c.tasks.remove({ id });
    snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.litterStock).toBe(6);
    expect(snap.data.completions).toHaveLength(0);
  });

  it("ajusta estoque e configuração da areia", async () => {
    const { c } = await newHouse("Casa Config", null);
    await c.litter.adjustStock({ delta: 3 });
    await c.litter.adjustStock({ delta: -1 });
    await c.litter.update({ minDays: 9 }); // empurra o máximo
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.litterStock).toBe(2);
    expect(snap.data.litter.minDays).toBe(9);
    expect(snap.data.litter.maxDays).toBe(9);
  });

  it("guarda ajustes de frequência e pausa", async () => {
    const { c } = await newHouse();
    await c.tasks.setOverride({ taskKey: "aspirar", min: 1, max: 2 });
    await c.tasks.setOverride({ taskKey: "aspirar", paused: true });
    expect(
      await code(() =>
        c.tasks.setOverride({ taskKey: "m_cama", paused: true }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() =>
        c.tasks.setOverride({ taskKey: "aspirar", min: 5, max: 2 }),
      ),
    ).toBe("BAD_REQUEST");
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.overrides.aspirar).toEqual({ min: 1, max: 2, off: true });
  });

  it("convite: segunda pessoa entra, terceira não", async () => {
    const owner = await newHouse("Casa Casal");
    const { code: inviteCode } = await owner.c.household.createInvite();
    expect(inviteCode).toMatch(/^[A-Z2-9]{8}$/);

    const partnerId = `test-${randomUUID()}`;
    const partner = as(partnerId);
    expect(
      await code(() =>
        partner.household.join({ code: "ZZZZZZZZ", memberName: "Bia" }),
      ),
    ).toBe("NOT_FOUND");
    await partner.household.join({
      code: inviteCode.toLowerCase(),
      memberName: "Bia",
    });

    const snap = await partner.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.household.id).toBe(owner.householdId);
    expect(snap.data.members.map((m) => `${m.slot}:${m.name}`)).toEqual([
      "a:Alex",
      "b:Bia",
    ]);
    expect(snap.data.isOwner).toBe(false);
    expect(snap.data.invite).toBeNull();

    // convite é de uso único e a casa já está cheia
    const third = as(`test-${randomUUID()}`);
    expect(
      await code(() =>
        third.household.join({ code: inviteCode, memberName: "Cris" }),
      ),
    ).toBe("NOT_FOUND");
    expect(await code(() => owner.c.household.createInvite())).toBe("CONFLICT");
    // só o dono apaga a casa
    expect(await code(() => partner.household.delete())).toBe("FORBIDDEN");
  });

  it("loja: saldo no servidor, aprovação só pela outra pessoa", async () => {
    const owner = await newHouse("Casa Loja");
    const { code: inviteCode } = await owner.c.household.createInvite();
    const partner = as(`test-${randomUUID()}`);
    await partner.household.join({ code: inviteCode, memberName: "Bia" });

    const snap0 = await owner.c.household.snapshot();
    if (snap0.status !== "ready") throw new Error();
    const cheap = snap0.data.rewards.find((r) => r.costCoins === 30);
    if (!cheap) throw new Error("prêmio de 30 moedas não encontrado");

    // sem XP → sem moedas
    expect(await code(() => owner.c.store.buy({ rewardId: cheap.id }))).toBe(
      "BAD_REQUEST",
    );

    // 4 tarefas de 40 XP ≈ 160 XP → 16 moedas; precisa de mais
    for (let i = 0; i < 4; i++) {
      await owner.c.tasks.complete({
        taskKey: "compras",
        ...completion({ pts: 95 }),
      }); // 5+60 = 65..~
    }
    const snap1 = await owner.c.household.snapshot();
    if (snap1.status !== "ready") throw new Error();
    const xp = snap1.data.completions.reduce((a, c) => a + c.pts, 0);
    expect(Math.floor(xp / 10)).toBeGreaterThanOrEqual(30);

    const { id } = await owner.c.store.buy({ rewardId: cheap.id });
    expect(
      await code(() => owner.c.store.resolve({ id, approved: true })),
    ).toBe("FORBIDDEN");
    await partner.store.resolve({ id, approved: false });
    const snap2 = await owner.c.household.snapshot();
    if (snap2.status !== "ready") throw new Error();
    expect(snap2.data.purchases[0].status).toBe("rejected");
  });

  it("reações e pedidos de troca", async () => {
    const owner = await newHouse("Casa Social");
    const { code: inviteCode } = await owner.c.household.createInvite();
    const partner = as(`test-${randomUUID()}`);
    await partner.household.join({ code: inviteCode, memberName: "Bia" });

    const { id } = await owner.c.tasks.complete({
      taskKey: "lixo",
      ...completion(),
    });
    expect(
      (
        await partner.social.toggleReaction({
          completionId: id,
          emoji: "coracao",
        })
      ).active,
    ).toBe(true);
    expect(
      (
        await partner.social.toggleReaction({
          completionId: id,
          emoji: "coracao",
        })
      ).active,
    ).toBe(false);
    await partner.social.toggleReaction({ completionId: id, emoji: "fogo" });

    const trade = await owner.c.social.requestTrade({ taskKey: "aspirar" });
    expect(
      await code(() =>
        owner.c.social.respondTrade({ id: trade.id, accept: true }),
      ),
    ).toBe("FORBIDDEN");
    await partner.social.respondTrade({ id: trade.id, accept: true });

    const snap = await partner.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.reactions).toHaveLength(1);
    expect(snap.data.trades[0]).toMatchObject({
      taskId: "aspirar",
      status: "accepted",
    });
  });

  it("cozinha e escritório", async () => {
    const { c } = await newHouse("Casa Cozinha");
    const meal = await c.meals.add({
      dateKey: key(now()),
      slot: "jantar",
      dish: "Frango",
      protein: "frango_file",
    });
    await c.meals.setPulled({ id: meal.id, value: true });

    // objetivo exige todas as etapas
    const start = key(now());
    expect(
      await code(() =>
        c.office.finishGoal({
          goalKey: "o1",
          completion: completion({ pts: 80 }),
        }),
      ),
    ).toBe("PRECONDITION_FAILED");
    for (let i = 0; i < 4; i++)
      await c.office.setStep({
        goalKey: "o1",
        index: i,
        value: true,
        startDate: start,
      });
    await c.office.finishGoal({
      goalKey: "o1",
      completion: completion({ pts: 80 }),
    });
    await c.office.addItem({
      name: "HD externo",
      category: "Eletrônicos",
      dest: "fica",
    });

    let snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.meals[0].pulledBy).toBe(snap.data.meId);
    expect(Object.keys(snap.data.office.done)).toEqual(["o1"]);
    expect(snap.data.office.start).toBe(start);
    expect(snap.data.office.inventory).toHaveLength(1);
    const goalXp = snap.data.completions.find((x) => x.taskId === "escritorio");
    expect(goalXp?.pts).toBe(80);

    // desfazer o XP do objetivo também reabre o objetivo
    await c.tasks.remove({ id: goalXp?.id ?? "" });
    snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(Object.keys(snap.data.office.done)).toEqual([]);
  });

  it("pulse: a revisão sobe a cada mudança e casa com o snapshot", async () => {
    const { c } = await newHouse("Casa Pulse");
    const p0 = await c.household.pulse();
    expect((await c.household.pulse()).rev).toBe(p0.rev); // sem mudança → igual
    const { id } = await c.tasks.complete({ taskKey: "lixo", ...completion() });
    const p1 = await c.household.pulse();
    expect(p1.rev).toBeGreaterThan(p0.rev ?? -1);
    await c.tasks.remove({ id });
    const p2 = await c.household.pulse();
    expect(p2.rev).toBeGreaterThan(p1.rev ?? -1);
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.rev).toBe(p2.rev);
    expect((await as(`test-${randomUUID()}`).household.pulse()).rev).toBeNull();
  });

  it("apagar a casa remove tudo em cascata", async () => {
    const { c, householdId } = await newHouse("Casa Efêmera");
    await c.tasks.complete({ taskKey: "lixo", ...completion() });
    await c.household.delete();
    const rows = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId));
    expect(rows).toHaveLength(0);
    expect((await c.household.snapshot()).status).toBe("none");
  });
});
