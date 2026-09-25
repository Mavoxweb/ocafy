import { randomUUID } from "node:crypto";
import {
  DEFAULT_PROFILE,
  type HouseProfile,
  defaultRoomCounts,
  roomsFromCounts,
} from "@ocafy/core";
import {
  db,
  entitlementGrants,
  householdMembers,
  households,
  litterSettings,
  onboardingEvents,
  pets,
  rooms,
  subscriptions,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { appRouter, createCallerFactory, getAvatar } from "../src/index";

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

const created: string[] = [];

type PetInput = {
  id?: string;
  name: string;
  species: "dog" | "cat";
  size?: "mini" | "small" | "medium" | "large" | "giant";
};
const catPets = (n: number): PetInput[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `Gato ${i + 1}`,
    species: "cat",
  }));
const apto = () =>
  roomsFromCounts(defaultRoomCounts("apartment", "m")).map((r) => ({
    kind: r.kind,
  }));

async function newHouse(
  name = "Casa Teste",
  stock: number | null = 6,
  over: {
    profile?: Partial<Omit<HouseProfile, "mode">> & {
      mode?: "solo" | "couple" | "family";
    };
    pets?: PetInput[];
  } = {},
) {
  const userId = `test-${randomUUID()}`;
  const c = as(userId);
  const { householdId } = await c.household.create({
    houseName: name,
    memberName: "Alex",
    profile: { ...DEFAULT_PROFILE, mode: "couple", ...over.profile },
    rooms: apto(),
    pets: over.pets ?? catPets(3),
  });
  created.push(householdId);
  if (stock != null) await c.litter.adjustStock({ delta: stock });
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
    expect(d.profile.mode).toBe("couple");
    expect(d.rooms.map((r) => r.slug)).toEqual([
      "quarto1",
      "quarto2",
      "banheiro",
      "sala",
      "cozinha",
      "servico",
      "varanda",
    ]);
    expect(d.pets).toHaveLength(3);
    expect(d.litter.cats).toBe(3);
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
          profile: { ...DEFAULT_PROFILE, mode: "couple" },
          rooms: [],
          pets: [],
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

  it("foto de perfil: valida, isola por casa e sai fora do snapshot", async () => {
    const png = (extra = 200) =>
      `data:image/png;base64,${Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.alloc(extra, 7),
      ]).toString("base64")}`;

    const owner = await newHouse("Casa Foto");
    const { code: inviteCode } = await owner.c.household.createInvite();
    const partnerId = `test-${randomUUID()}`;
    const partner = as(partnerId);
    await partner.household.join({ code: inviteCode, memberName: "Bia" });
    const outsider = await newHouse("Casa Alheia");

    // rejeita: tipo não suportado, mime que não bate com os bytes, gigante, minúsculo
    expect(
      await code(() =>
        owner.c.household.setAvatar({
          dataUrl: "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
        }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() =>
        owner.c.household.setAvatar({
          dataUrl: png().replace("image/png", "image/jpeg"),
        }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() =>
        owner.c.household.setAvatar({ dataUrl: png(130 * 1024) }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() => owner.c.household.setAvatar({ dataUrl: png(10) })),
    ).toBe("BAD_REQUEST");

    const { avatarVersion } = await owner.c.household.setAvatar({
      dataUrl: png(),
    });
    const snap = await partner.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    const alex = snap.data.members.find((m) => m.name === "Alex");
    expect(alex?.avatarVersion).toBe(avatarVersion);
    expect(
      snap.data.members.find((m) => m.name === "Bia")?.avatarVersion,
    ).toBeNull();
    expect(JSON.stringify(snap.data)).not.toContain("iVBORw"); // base64 do PNG não vai no snapshot

    // a outra pessoa da casa lê; quem é de outra casa não
    const own = await owner.c.household.snapshot();
    if (own.status !== "ready") throw new Error();
    const alexId = own.data.meId;
    const seenByPartner = await getAvatar(partnerId, alexId);
    expect(seenByPartner?.type).toBe("image/png");
    expect(seenByPartner?.bytes.length).toBe(208);
    expect(await getAvatar(outsider.userId, alexId)).toBeNull();
    expect(await getAvatar(`test-${randomUUID()}`, alexId)).toBeNull();

    // cada um só troca a própria foto; remover limpa tudo
    await owner.c.household.removeAvatar();
    expect(await getAvatar(partnerId, alexId)).toBeNull();
    const after = await owner.c.household.snapshot();
    if (after.status !== "ready") throw new Error();
    expect(after.data.members.every((m) => m.avatarVersion === null)).toBe(
      true,
    );
  });

  it("perfil: o servidor só aceita tarefas que existem no plano da casa", async () => {
    const semPets = await newHouse("Casa Sem Pets", null, { pets: [] });
    // sem cães/gatos, tarefas de pets não existem
    expect(
      await code(() =>
        semPets.c.tasks.complete({ taskKey: "m_areia", ...completion() }),
      ),
    ).toBe("BAD_REQUEST");
    await semPets.c.tasks.complete({ taskKey: "aspirar", ...completion() });

    const { c } = await newHouse("Casa Cão", null, {
      pets: [{ name: "Thor", species: "dog", size: "giant" }],
    });
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    const dog = snap.data.pets[0];
    expect(dog).toMatchObject({ name: "Thor", species: "dog", size: "giant" });
    const key = `dog_walk_am@${dog.id}`;
    const r = await c.tasks.complete({ taskKey: key, ...completion() });
    expect(r.pts).toBeGreaterThan(0);
    // outra casa não pode usar a tarefa do cão de Thor
    const other = await newHouse("Casa Outra", null, { pets: [] });
    expect(
      await code(() =>
        other.c.tasks.complete({ taskKey: key, ...completion() }),
      ),
    ).toBe("BAD_REQUEST");
  });

  it("updateProfile: cômodos, pets e ids estáveis; histórico preservado", async () => {
    const { c } = await newHouse("Casa Reforma", null, {
      pets: [{ name: "Rex", species: "dog", size: "small" }],
    });
    let snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    const rex = snap.data.pets[0];
    await c.tasks.complete({ taskKey: "banheiro", ...completion() });

    // 2º banheiro, um quarto a menos, apelido, cão cresce e chega um gato
    await c.household.updateProfile({
      profile: { ...snap.data.profile, mode: "couple", intensity: "full" },
      rooms: [
        { kind: "quarto", label: "Quarto do João" },
        { kind: "banheiro" },
        { kind: "banheiro" },
        { kind: "sala" },
        { kind: "cozinha" },
      ],
      pets: [
        { id: rex.id, name: "Rex", species: "dog", size: "large" },
        { name: "Mia", species: "cat" },
      ],
    });
    snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.profile.intensity).toBe("full");
    expect(snap.data.rooms.map((r) => `${r.slug}:${r.label}`)).toEqual([
      "quarto1:Quarto do João",
      "banheiro:Banheiro 1",
      "banheiro_2:Banheiro 2",
      "sala:Sala",
      "cozinha:Cozinha",
    ]);
    expect(snap.data.pets).toHaveLength(2);
    expect(snap.data.pets.find((p) => p.name === "Rex")).toMatchObject({
      id: rex.id,
      size: "large",
    });
    expect(snap.data.litter.cats).toBe(1);
    expect(snap.data.completions.map((x) => x.taskId)).toEqual(["banheiro"]);
    // o 2º banheiro entrou no plano
    await c.tasks.complete({ taskKey: "banheiro@banheiro_2", ...completion() });
    expect(snap.data.rev).toBeGreaterThan(0);

    // id de pet de outra casa é ignorado (vira pet novo), nunca sequestra o alheio
    const other = await newHouse("Casa Vizinha", null, {
      pets: [{ name: "Bob", species: "dog", size: "mini" }],
    });
    const os = await other.c.household.snapshot();
    if (os.status !== "ready") throw new Error();
    const bob = os.data.pets[0];
    await c.household.updateProfile({
      profile: { ...snap.data.profile, mode: "couple" },
      rooms: [{ kind: "cozinha" }],
      pets: [{ id: bob.id, name: "Intruso", species: "dog" }],
    });
    const after = await other.c.household.snapshot();
    if (after.status !== "ready") throw new Error();
    expect(after.data.pets[0]).toMatchObject({ id: bob.id, name: "Bob" });
  });

  it("modo Solo: sem convites; Casal com duas pessoas não vira Solo", async () => {
    const solo = await newHouse("Casa Solo", null, {
      profile: { mode: "solo" },
    });
    expect(await code(() => solo.c.household.createInvite())).toBe("CONFLICT");

    const couple = await newHouse("Casa Dois", null);
    const { code: inviteCode } = await couple.c.household.createInvite();
    await as(`test-${randomUUID()}`).household.join({
      code: inviteCode,
      memberName: "Bia",
    });
    const snap = await couple.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(
      await code(() =>
        couple.c.household.updateProfile({
          profile: { ...snap.data.profile, mode: "solo" },
          rooms: [{ kind: "cozinha" }],
          pets: [],
        }),
      ),
    ).toBe("CONFLICT");

    // Solo → Casal libera o convite
    const ssnap = await solo.c.household.snapshot();
    if (ssnap.status !== "ready") throw new Error();
    await solo.c.household.updateProfile({
      profile: { ...ssnap.data.profile, mode: "couple" },
      rooms: [{ kind: "cozinha" }],
      pets: [],
    });
    expect(await code(() => solo.c.household.createInvite())).toBe("OK");
  });

  it("valida cômodos e rejeita modos desconhecidos", async () => {
    const { c } = await newHouse("Casa Limites", null);
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    const profile = { ...snap.data.profile, mode: "couple" as const };
    expect(
      await code(() =>
        c.household.updateProfile({
          profile,
          rooms: [
            { kind: "cozinha" },
            { kind: "cozinha" },
            { kind: "cozinha" },
          ],
          pets: [],
        }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() =>
        c.household.updateProfile({
          profile: { ...profile, mode: "clan" as never },
          rooms: [],
          pets: [],
        }),
      ),
    ).toBe("BAD_REQUEST");
  });

  it("casa antiga (formato anterior) continua funcionando sem perder histórico", async () => {
    // Simula uma casa criada antes do perfil: cômodos com slugs antigos, linhas gatos/casa,
    // gatos convertidos pela migração e histórico de conclusões.
    const userId = `test-${randomUUID()}`;
    const [h] = await db
      .insert(households)
      .values({ name: "Casa Legada" })
      .returning();
    created.push(h.id);
    await db.insert(householdMembers).values({
      householdId: h.id,
      userId,
      displayName: "Alex",
      role: "owner",
      slot: "a",
    });
    const legacyRooms = [
      "quarto1",
      "quarto2",
      "sala",
      "cozinha",
      "banheiro",
      "servico",
      "gatos",
      "casa",
    ];
    await db.insert(rooms).values(
      legacyRooms.map((slug) => ({
        householdId: h.id,
        slug,
        kind: slug.startsWith("quarto") ? "quarto" : slug,
      })),
    );
    await db.insert(litterSettings).values({ householdId: h.id });
    await db.insert(pets).values(
      catPets(3).map((p) => ({
        householdId: h.id,
        name: p.name,
        species: p.species,
        litter: "litter" as const,
      })),
    );

    const c = as(userId);
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.rooms.map((r) => r.slug)).toEqual([
      "quarto1",
      "quarto2",
      "banheiro",
      "sala",
      "cozinha",
      "servico",
    ]);
    // as tarefas do catálogo antigo seguem no plano padrão da casa
    for (const k of ["aspirar", "banheiro", "m_areia", "area_troca", "lixo"]) {
      const r = await c.tasks.complete({ taskKey: k, ...completion() });
      expect(r.pts).toBeGreaterThan(0);
    }
    const after = await c.household.snapshot();
    if (after.status !== "ready") throw new Error();
    expect(after.data.completions).toHaveLength(5);
  });

  it("onboarding: registra passos por conta", async () => {
    const userId = `test-${randomUUID()}`;
    const c = as(userId);
    await c.household.onboardingStep({ step: "rooms" });
    await c.household.onboardingStep({ step: "pets" });
    expect(
      await code(() => c.household.onboardingStep({ step: "Passo Inválido!" })),
    ).toBe("BAD_REQUEST");
    const rows = await db
      .select()
      .from(onboardingEvents)
      .where(eq(onboardingEvents.userId, userId));
    expect(rows.map((r) => r.step).sort()).toEqual(["pets", "rooms"]);
    await db
      .delete(onboardingEvents)
      .where(eq(onboardingEvents.userId, userId));
  });

  it("família: perfis de criança, tarefas por idade e crédito para a criança", async () => {
    const owner = await newHouse("Casa Família", null, {
      profile: { mode: "family" },
    });
    const bia = await owner.c.members.addProfile({
      name: "Bia",
      ageBand: "child_4_6",
    });
    const leo = await owner.c.members.addProfile({
      name: "Leo",
      ageBand: "child_10_12",
    });
    let snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(
      snap.data.members.map((m) => `${m.slot}:${m.kind}:${m.name}`),
    ).toEqual(["a:account:Alex", "b:profile:Bia", "c:profile:Leo"]);
    expect(snap.data.members[1].ageBand).toBe("child_4_6");

    // tarefas infantis entram no plano conforme a faixa etária, e o servidor as aceita
    const r = await owner.c.tasks.complete({
      taskKey: "kid_brinquedos",
      forMemberId: bia.id,
      ...completion(),
    });
    expect(r.pts).toBeGreaterThan(0);
    await owner.c.tasks.complete({
      taskKey: "kid_quarto",
      forMemberId: leo.id,
      ...completion(),
    });
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(
      snap.data.completions
        .map(
          (x) =>
            `${x.taskId}:${x.who === bia.id ? "Bia" : x.who === leo.id ? "Leo" : "?"}`,
        )
        .sort(),
    ).toEqual(["kid_brinquedos:Bia", "kid_quarto:Leo"]);
    // 13+ ainda não está no plano (nenhum adolescente na casa)
    expect(
      await code(() =>
        owner.c.tasks.complete({ taskKey: "kid_banheiro", ...completion() }),
      ),
    ).toBe("BAD_REQUEST");

    // só perfis da própria casa
    const other = await newHouse("Casa Outra Família", null, {
      profile: { mode: "family" },
    });
    expect(
      await code(() =>
        other.c.tasks.complete({
          taskKey: "aspirar",
          forMemberId: bia.id,
          ...completion(),
        }),
      ),
    ).toBe("BAD_REQUEST");
    // não dá para registrar por um adulto pelo forMemberId
    const adultId = snap.data.meId;
    expect(
      await code(() =>
        owner.c.tasks.complete({
          taskKey: "aspirar",
          forMemberId: adultId,
          ...completion(),
        }),
      ),
    ).toBe("BAD_REQUEST");

    // atribuição
    await owner.c.tasks.assign({ taskKey: "m_cama", memberId: bia.id });
    await owner.c.tasks.assign({ taskKey: "m_cama", memberId: leo.id });
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.assignments).toEqual({ m_cama: leo.id });
    expect(
      await code(() =>
        other.c.tasks.assign({ taskKey: "m_cama", memberId: bia.id }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() =>
        owner.c.tasks.assign({ taskKey: "nao_existe", memberId: leo.id }),
      ),
    ).toBe("BAD_REQUEST");
    await owner.c.tasks.assign({ taskKey: "m_cama", memberId: null });
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.assignments).toEqual({});

    // sair do modo Família com crianças na casa não pode
    const houseProfile = snap.data.profile;
    expect(
      await code(() =>
        owner.c.household.updateProfile({
          profile: { ...houseProfile, mode: "couple" },
          rooms: [{ kind: "cozinha" }],
          pets: [],
        }),
      ),
    ).toBe("CONFLICT");

    // remover o perfil leva o histórico dele e a tarefa infantil sai do plano
    await owner.c.members.removeProfile({ id: bia.id });
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.members.map((m) => m.name)).toEqual(["Alex", "Leo"]);
    expect(snap.data.completions.every((x) => x.who !== bia.id)).toBe(true);
  });

  it("família: perfis só no modo Família, com limites e até 4 adultos", async () => {
    const couple = await newHouse("Casa de Casal", null);
    expect(
      await code(() =>
        couple.c.members.addProfile({ name: "Bia", ageBand: "child_4_6" }),
      ),
    ).toBe("PRECONDITION_FAILED");

    const fam = await newHouse("Casa Grande", null, {
      profile: { mode: "family" },
    });
    for (let i = 0; i < 6; i++)
      await fam.c.members.addProfile({
        name: `Criança ${i + 1}`,
        ageBand: "child_7_9",
      });
    // 1 adulto + 6 perfis = 7 slots; o 7º perfil bate no limite de perfis
    expect(
      await code(() =>
        fam.c.members.addProfile({ name: "Sobra", ageBand: "child_7_9" }),
      ),
    ).toBe("CONFLICT");

    // adultos: entram até 4 (os slots dos perfis já foram usados, sobra 1 livre)
    const { code: c1 } = await fam.c.household.createInvite();
    const p2 = as(`test-${randomUUID()}`);
    await p2.household.join({ code: c1, memberName: "Bia" });
    const snap = await fam.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    // o slot livre mais baixo foi entregue (b..g ocupados pelos perfis → h)
    expect(snap.data.members.map((m) => m.slot).sort()).toEqual([
      "a",
      "b",
      "c",
      "d",
      "e",
      "f",
      "g",
      "h",
    ]);
    // sem mais slots: convite recusado
    expect(await code(() => fam.c.household.createInvite())).toBe("OK");
    const p3 = as(`test-${randomUUID()}`);
    const inv = await fam.c.household.createInvite();
    expect(
      await code(() =>
        p3.household.join({ code: inv.code, memberName: "Cris" }),
      ),
    ).toBe("CONFLICT");
  });

  it("família: pedido de troca escolhe quem ajuda entre vários adultos", async () => {
    const owner = await newHouse("Casa Trocas", null, {
      profile: { mode: "family" },
    });
    const { code: c1 } = await owner.c.household.createInvite();
    const a2 = as(`test-${randomUUID()}`);
    await a2.household.join({ code: c1, memberName: "Bia" });
    const { code: c2 } = await owner.c.household.createInvite();
    const a3 = as(`test-${randomUUID()}`);
    await a3.household.join({ code: c2, memberName: "Cris" });

    // com 2 outros adultos é preciso escolher
    expect(
      await code(() => owner.c.social.requestTrade({ taskKey: "aspirar" })),
    ).toBe("BAD_REQUEST");
    const snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    const bia = snap.data.members.find((m) => m.name === "Bia");
    if (!bia) throw new Error();
    const t = await owner.c.social.requestTrade({
      taskKey: "aspirar",
      toMemberId: bia.id,
    });
    // outro adulto não pode responder por Bia
    expect(
      await code(() => a3.social.respondTrade({ id: t.id, accept: true })),
    ).toBe("FORBIDDEN");
    await a2.social.respondTrade({ id: t.id, accept: true });
  });

  it("compras: lista compartilhada, urgência, modo mercado e hábito", async () => {
    const owner = await newHouse("Casa Compras", null);
    const { code: inviteCode } = await owner.c.household.createInvite();
    const partner = as(`test-${randomUUID()}`);
    await partner.household.join({ code: inviteCode, memberName: "Bia" });

    const leite = await owner.c.shopping.add({
      name: "Leite",
      quantity: "6 caixas",
      urgency: "now",
    });
    await partner.shopping.add({ name: "Tomate" });
    const areia = await partner.shopping.add({
      name: "Areia para gato",
      urgency: "later",
    });

    let snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    const byName = Object.fromEntries(
      snap.data.shopping.items.map((i) => [i.name, i]),
    );
    expect(byName.Leite).toMatchObject({
      urgency: "now",
      quantity: "6 caixas",
      category: "Laticínios e frios",
      status: "open",
    });
    expect(byName.Tomate).toMatchObject({
      urgency: "soon",
      category: "Hortifruti",
    });
    expect(byName["Areia para gato"].category).toBe("Pets");

    // qualquer adulto edita; itens de outra casa ficam intocados
    await partner.shopping.update({ id: leite.id, urgency: "soon" });
    const other = await newHouse("Casa Alheia Compras", null);
    await other.c.shopping.update({ id: leite.id, name: "Invadido" });
    await other.c.shopping.remove({ id: leite.id });
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(
      snap.data.shopping.items.find((i) => i.id === leite.id),
    ).toMatchObject({
      name: "Leite",
      urgency: "soon",
    });

    // sem nada comprado não dá para fechar a ida
    expect(await code(() => owner.c.shopping.finishTrip())).toBe("BAD_REQUEST");
    await owner.c.shopping.setBought({ id: leite.id, bought: true });
    await owner.c.shopping.setBought({ id: areia.id, bought: true });
    await owner.c.shopping.setBought({ id: areia.id, bought: false });
    const done = await owner.c.shopping.finishTrip();
    expect(done.items).toBe(1);
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.shopping.items.map((i) => i.name).sort()).toEqual([
      "Areia para gato",
      "Tomate",
    ]);
    expect(snap.data.shopping.trips).toHaveLength(1);

    // hábito de compra
    await owner.c.shopping.setHabit({ cadence: "weekly", day: 6 });
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.shopping).toMatchObject({ cadence: "weekly", day: 6 });
    await owner.c.shopping.setHabit({ cadence: null, day: 3 });
    snap = await owner.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.shopping).toMatchObject({ cadence: null, day: null });
    expect(await code(() => owner.c.shopping.add({ name: "   " }))).toBe(
      "BAD_REQUEST",
    );
  });

  it("planos: casa nova ganha 14 dias de Plus; depois do teste valem os limites do grátis", async () => {
    const { c, householdId } = await newHouse("Casa Planos", null, {
      profile: { mode: "family" },
      pets: [{ name: "Rex", species: "dog", size: "small" }],
    });
    let snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.plan).toMatchObject({ id: "plus", source: "trial" });
    expect(snap.data.plan.trialEndsAt).toBeTruthy();
    expect(snap.data.plan.entitlements.family).toBe(true);

    // o teste acaba (a data vem do banco, nunca do cliente)
    await db
      .update(entitlementGrants)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(entitlementGrants.householdId, householdId));
    snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.plan.id).toBe("free");
    expect(snap.data.plan.entitlements).toMatchObject({
      family: false,
      maxPets: 1,
    });

    const profile = snap.data.profile;
    const rooms = [{ kind: "cozinha" as const }];
    // já é família: continua sendo, sem bloqueio
    await c.household.updateProfile({
      profile: { ...profile, mode: "family" },
      rooms,
      pets: [
        {
          id: snap.data.pets[0].id,
          name: "Rex",
          species: "dog",
          size: "small",
        },
      ],
    });
    // 2º pet: bloqueado, com marca de limite de plano
    const err = await c.household
      .updateProfile({
        profile: { ...profile, mode: "family" },
        rooms,
        pets: [
          {
            id: snap.data.pets[0].id,
            name: "Rex",
            species: "dog",
            size: "small",
          },
          { name: "Mia", species: "cat" },
        ],
      })
      .catch((e) => e as TRPCError);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toMatch(/^PLAN_LIMIT:pets\|/);
    // perfil de criança novo também é do Plus
    expect(
      await code(() =>
        c.members.addProfile({ name: "Bia", ageBand: "child_4_6" }),
      ),
    ).toBe("FORBIDDEN");

    // liberação manual do admin: 3 pets nesta casa, sem virar Plus
    await db.insert(entitlementGrants).values({
      householdId,
      plan: "free",
      source: "manual",
      overrides: { maxPets: 3 },
      reason: "teste",
      grantedBy: "test",
    });
    await c.household.updateProfile({
      profile: { ...profile, mode: "family" },
      rooms,
      pets: [
        {
          id: snap.data.pets[0].id,
          name: "Rex",
          species: "dog",
          size: "small",
        },
        { name: "Mia", species: "cat" },
        { name: "Bob", species: "dog", size: "mini" },
      ],
    });
    snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.pets).toHaveLength(3);
    expect(snap.data.plan.id).toBe("free");

    // quem sai do modo Família no grátis não volta sem o Plus
    await c.household.updateProfile({
      profile: { ...profile, mode: "couple" },
      rooms,
      pets: snap.data.pets.map((p) => ({
        id: p.id,
        name: p.name,
        species: p.species,
      })),
    });
    expect(
      await code(() =>
        c.household.updateProfile({
          profile: { ...profile, mode: "family" },
          rooms,
          pets: snap.data.pets.map((p) => ({
            id: p.id,
            name: p.name,
            species: p.species,
          })),
        }),
      ),
    ).toBe("FORBIDDEN");
  });

  it("assinatura: valida e carência mantêm o Plus; expirada volta ao grátis", async () => {
    const { c, householdId } = await newHouse("Casa Assinante", null);
    await db
      .update(entitlementGrants)
      .set({ revokedAt: new Date() })
      .where(eq(entitlementGrants.householdId, householdId));
    const plan = async () => {
      const s = await c.household.snapshot();
      if (s.status !== "ready") throw new Error();
      return s.data.plan;
    };
    expect((await plan()).id).toBe("free");

    const [sub] = await db
      .insert(subscriptions)
      .values({
        householdId,
        provider: "manual",
        providerRef: `t-${randomUUID()}`,
        status: "active",
        interval: "quarterly",
        currentPeriodEnd: new Date(Date.now() + 30 * 864e5),
      })
      .returning();
    expect(await plan()).toMatchObject({
      id: "plus",
      source: "subscription",
      pastDue: false,
    });

    await db
      .update(subscriptions)
      .set({
        status: "past_due",
        currentPeriodEnd: new Date(Date.now() - 2 * 864e5),
        graceUntil: new Date(Date.now() + 5 * 864e5),
      })
      .where(eq(subscriptions.id, sub.id));
    expect(await plan()).toMatchObject({ id: "plus", pastDue: true });

    await db
      .update(subscriptions)
      .set({ graceUntil: new Date(Date.now() - 864e5) })
      .where(eq(subscriptions.id, sub.id));
    expect(await plan()).toMatchObject({ id: "free", pastDue: false });
  });

  it("casa suspensa pelo admin: escrita bloqueada, leitura do estado continua", async () => {
    const { c, householdId } = await newHouse("Casa Suspensa", null);
    await c.tasks.complete({ taskKey: "aspirar", ...completion() });
    await db
      .update(households)
      .set({ suspendedAt: new Date(), suspendedReason: "Teste de suspensão" })
      .where(eq(households.id, householdId));
    const err = await c.tasks
      .complete({ taskKey: "lixo", ...completion() })
      .catch((e) => e as TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe("HOUSEHOLD_SUSPENDED");
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.suspended).toEqual({ reason: "Teste de suspensão" });
    expect(snap.data.completions).toHaveLength(1); // nada é apagado
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
