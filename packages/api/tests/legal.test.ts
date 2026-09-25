import { randomUUID } from "node:crypto";
import { DEFAULT_PROFILE, LEGAL_VERSION } from "@ocafy/core";
import { db, households, legalAcceptances } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { eq, inArray } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { appRouter, createCallerFactory } from "../src/index";
import { documentHash } from "../src/legal";

const enabled =
  !!process.env.DATABASE_URL &&
  !!process.env.NEON_BRANCH &&
  process.env.NEON_BRANCH !== "production";

const caller = createCallerFactory(appRouter);
const houses: string[] = [];

const base = {
  houseName: "Casa Consentimento",
  memberName: "Alex",
  profile: { ...DEFAULT_PROFILE, mode: "family" as const },
  rooms: [{ kind: "cozinha" as const }],
  pets: [],
};

const codeOf = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TRPCError) return `${e.code}:${e.message}`;
    throw e;
  }
  return "OK";
};

afterAll(async () => {
  if (enabled && houses.length)
    await db.delete(households).where(inArray(households.id, houses));
});

describe.skipIf(!enabled)("aceite de termos e LGPD (Neon dev)", () => {
  it("criar casa exige a versão vigente dos documentos e registra o aceite com hash", async () => {
    const userId = `test-${randomUUID()}`;
    const c = caller({ userId });

    // sem a versão / versão antiga: recusado, nada é criado
    expect(
      await codeOf(() => c.household.create({ ...base } as never)),
    ).toMatch(/BAD_REQUEST/);
    expect(
      await codeOf(() =>
        c.household.create({ ...base, acceptedLegalVersion: "2020-01-01" }),
      ),
    ).toBe("BAD_REQUEST:LEGAL_VERSION_MISMATCH");
    expect((await c.household.snapshot()).status).toBe("none");
    const before = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, userId));
    expect(before).toHaveLength(0);

    const { householdId } = await c.household.create({
      ...base,
      acceptedLegalVersion: LEGAL_VERSION,
    });
    houses.push(householdId);
    const rows = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, userId));
    expect(rows.map((r) => r.document).sort()).toEqual(["privacy", "terms"]);
    for (const r of rows) {
      expect(r).toMatchObject({
        version: LEGAL_VERSION,
        context: "onboarding",
      });
      expect(r.contentHash).toBe(
        documentHash(r.document as "terms" | "privacy"),
      );
      expect(r.contentHash).toMatch(/^[0-9a-f]{64}$/);
    }
    expect(documentHash("terms")).not.toBe(documentHash("privacy"));

    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.legal).toEqual({
      version: LEGAL_VERSION,
      accepted: true,
      gate: false,
    });
  });

  it("entrar por convite também exige e registra o aceite", async () => {
    const owner = caller({ userId: `test-${randomUUID()}` });
    const { householdId } = await owner.household.create({
      ...base,
      acceptedLegalVersion: LEGAL_VERSION,
    });
    houses.push(householdId);
    const { code } = await owner.household.createInvite();
    const guestId = `test-${randomUUID()}`;
    const guest = caller({ userId: guestId });
    expect(
      await codeOf(() =>
        guest.household.join({
          code,
          memberName: "Bia",
          acceptedLegalVersion: "x",
        }),
      ),
    ).toBe("BAD_REQUEST:LEGAL_VERSION_MISMATCH");
    await guest.household.join({
      code,
      memberName: "Bia",
      acceptedLegalVersion: LEGAL_VERSION,
    });
    const rows = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, guestId));
    expect(rows.map((r) => `${r.document}:${r.context}`).sort()).toEqual([
      "privacy:join",
      "terms:join",
    ]);
  });

  it("perfil de criança exige a declaração do responsável e a registra", async () => {
    const userId = `test-${randomUUID()}`;
    const c = caller({ userId });
    const { householdId } = await c.household.create({
      ...base,
      acceptedLegalVersion: LEGAL_VERSION,
    });
    houses.push(householdId);

    expect(
      await codeOf(() =>
        c.members.addProfile({ name: "Bia", ageBand: "child_4_6" } as never),
      ),
    ).toMatch(/BAD_REQUEST/);
    expect(
      await codeOf(() =>
        c.members.addProfile({
          name: "Bia",
          ageBand: "child_4_6",
          guardianDeclaration: false as never,
        }),
      ),
    ).toMatch(/BAD_REQUEST/);

    const kid = await c.members.addProfile({
      name: "Bia",
      ageBand: "child_4_6",
      guardianDeclaration: true,
    });
    const rows = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, userId));
    const g = rows.find((r) => r.document === "guardian");
    expect(g).toMatchObject({
      subject: kid.id,
      context: "guardian",
      version: LEGAL_VERSION,
    });
    expect(g?.contentHash).toBe(documentHash("guardian"));
  });

  it("nova versão: quem já usa precisa aceitar de novo, e o histórico é mantido", async () => {
    const userId = `test-${randomUUID()}`;
    const c = caller({ userId });
    const { householdId } = await c.household.create({
      ...base,
      acceptedLegalVersion: LEGAL_VERSION,
    });
    houses.push(householdId);

    // simula usuário antigo (aceitou uma versão anterior): troca a versão gravada
    await db
      .update(legalAcceptances)
      .set({ version: "2020-01-01" })
      .where(eq(legalAcceptances.userId, userId));
    let status = await c.account.legalStatus();
    expect(status).toEqual({ version: LEGAL_VERSION, accepted: false });
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.legal.accepted).toBe(false);

    expect(
      await codeOf(() => c.account.acceptLegal({ version: "2020-01-01" })),
    ).toBe("BAD_REQUEST:LEGAL_VERSION_MISMATCH");
    await c.account.acceptLegal({ version: LEGAL_VERSION });
    await c.account.acceptLegal({ version: LEGAL_VERSION }); // repetir não duplica
    status = await c.account.legalStatus();
    expect(status.accepted).toBe(true);
    const rows = await db
      .select()
      .from(legalAcceptances)
      .where(eq(legalAcceptances.userId, userId));
    expect(rows.filter((r) => r.version === LEGAL_VERSION)).toHaveLength(2); // terms + privacy
    expect(rows.filter((r) => r.version === "2020-01-01")).toHaveLength(2); // histórico preservado
  });

  it("a exportação LGPD inclui os aceites; o hash bate com o texto vigente", async () => {
    const userId = `test-${randomUUID()}`;
    const c = caller({ userId });
    const { householdId } = await c.household.create({
      ...base,
      acceptedLegalVersion: LEGAL_VERSION,
    });
    houses.push(householdId);
    const exp = await c.account.exportMyData();
    const acc = (
      exp.data as {
        legalAcceptances: {
          document: string;
          version: string;
          contentHash: string;
        }[];
      }
    ).legalAcceptances;
    expect(acc.map((a) => a.document).sort()).toEqual(["privacy", "terms"]);
    expect(acc.every((a) => a.version === LEGAL_VERSION)).toBe(true);
  });
});
