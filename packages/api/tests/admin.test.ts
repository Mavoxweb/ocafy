import { randomUUID } from "node:crypto";
import { LEGAL_VERSION } from "@ocafy/core";
import { DEFAULT_PROFILE } from "@ocafy/core";
import {
  adminAuditLog,
  dataRequests,
  db,
  entitlementGrants,
  households,
  platformStaff,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as admin from "../src/admin/index";
import { invalidateFlags } from "../src/flags";
import { appRouter, createCallerFactory } from "../src/index";
import { deleteAccountData } from "../src/lgpd";

const enabled =
  !!process.env.DATABASE_URL &&
  !!process.env.NEON_BRANCH &&
  process.env.NEON_BRANCH !== "production";

const caller = createCallerFactory(appRouter);
const houses: string[] = [];
const authUsers: string[] = [];
const staffIds: string[] = [];
const runId = randomUUID().slice(0, 8);

const owner: admin.Actor = {
  userId: "test-admin",
  email: `owner-${runId}@test.local`,
  role: "owner",
};
const support: admin.Actor = {
  userId: "test-support",
  email: `support-${runId}@test.local`,
  role: "support",
};
const viewer: admin.Actor = {
  userId: "test-viewer",
  email: `viewer-${runId}@test.local`,
  role: "viewer",
};

async function newHouse(name: string) {
  const userId = `test-${randomUUID()}`;
  const c = caller({ userId });
  const { householdId } = await c.household.create({
    acceptedLegalVersion: LEGAL_VERSION,
    houseName: name,
    memberName: "Alex",
    profile: { ...DEFAULT_PROFILE, mode: "couple" },
    rooms: [{ kind: "cozinha" }],
    pets: [],
  });
  houses.push(householdId);
  return { userId, c, householdId };
}

/** Cria um usuário no Neon Auth (dev) para testar login/exclusão de verdade. */
async function newAuthUser(email: string) {
  const id = randomUUID();
  await db.execute(sql`
    insert into neon_auth."user" (id, name, email, "emailVerified", "createdAt", "updatedAt")
    values (${id}, 'Teste Admin', ${email}, true, now(), now())`);
  authUsers.push(id);
  return id;
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

const lastAudit = async (action: string) =>
  (
    await db
      .select()
      .from(adminAuditLog)
      .where(eq(adminAuditLog.action, action))
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(1)
  )[0];

beforeAll(() => {
  process.env.ADMIN_SECRET_KEY = "b".repeat(64);
  process.env.ADMIN_SESSION_SECRET = "t".repeat(40);
});

afterAll(async () => {
  if (!enabled) return;
  if (staffIds.length)
    await db.delete(platformStaff).where(inArray(platformStaff.id, staffIds));
  if (houses.length)
    await db.delete(households).where(inArray(households.id, houses));
  for (const id of authUsers)
    await db.execute(sql`delete from neon_auth."user" where id::text = ${id}`);
  await db
    .delete(dataRequests)
    .where(sql`${dataRequests.userId} like 'test-%'`);
  invalidateFlags();
});

describe.skipIf(!enabled)("painel admin (Neon dev)", () => {
  it("o registro de auditoria é imutável no banco", async () => {
    await admin.writeAudit(owner, {
      action: "test.immutable",
      targetType: "test",
      reason: "teste de imutabilidade",
    });
    const row = await lastAudit("test.immutable");
    await expect(
      db
        .update(adminAuditLog)
        .set({ reason: "adulterado" })
        .where(eq(adminAuditLog.id, row.id)),
    ).rejects.toThrow();
    await expect(
      db.delete(adminAuditLog).where(eq(adminAuditLog.id, row.id)),
    ).rejects.toThrow();
    await expect(
      db.execute(sql`truncate table admin_audit_log`),
    ).rejects.toThrow();
    expect((await lastAudit("test.immutable")).reason).toBe(
      "teste de imutabilidade",
    );
  });

  it("toda ação exige permissão e justificativa; negativas e falhas também são registradas", async () => {
    const { householdId } = await newHouse("Casa Auditada");

    // sem justificativa: recusado
    expect(
      await codeOf(() =>
        admin.suspendHousehold(owner, { householdId, reason: "  " }),
      ),
    ).toBe("reason_required");

    // papel sem permissão: recusado e REGISTRADO como negado
    expect(
      await codeOf(() =>
        admin.suspendHousehold(support, {
          householdId,
          reason: "tentando suspender",
        }),
      ),
    ).toBe("forbidden");
    const denied = await lastAudit("household.suspend.denied");
    expect(denied).toMatchObject({
      actorEmail: support.email,
      actorRole: "support",
      targetId: householdId,
    });

    // sucesso: antes/depois e justificativa gravados
    await admin.suspendHousehold(owner, {
      householdId,
      reason: "Suspeita de abuso (teste)",
    });
    const ok = await lastAudit("household.suspend");
    expect(ok).toMatchObject({
      actorEmail: owner.email,
      householdId,
      reason: "Suspeita de abuso (teste)",
    });
    expect(ok.before).toMatchObject({ suspendedAt: null });

    // falha (casa que não existe): registrada como .failed
    expect(
      await codeOf(() =>
        admin.suspendHousehold(owner, {
          householdId: randomUUID(),
          reason: "casa inexistente",
        }),
      ),
    ).toBe("not_found");
    expect((await lastAudit("household.suspend.failed")).reason).toBe(
      "casa inexistente",
    );
  });

  it("suspender bloqueia escrita da casa (leitura continua) e reativar libera", async () => {
    const { c, householdId } = await newHouse("Casa Suspensa Admin");
    const complete = () =>
      c.tasks.complete({
        taskKey: "aspirar",
        at: new Date().toISOString(),
        dateKey: new Date().toISOString().slice(0, 10),
        pts: 10,
      });
    await complete();
    await admin.suspendHousehold(owner, {
      householdId,
      reason: "Chargeback em análise",
    });
    expect(await codeOf(complete)).toBe("FORBIDDEN");
    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.suspended?.reason).toBe("Chargeback em análise");
    await admin.unsuspendHousehold(owner, {
      householdId,
      reason: "Resolvido com o cliente",
    });
    expect(await codeOf(complete)).toBe("OK");
  });

  it("liberar plano, revogar e assinatura manual mudam o plano no servidor", async () => {
    const { c, householdId } = await newHouse("Casa Financeiro");
    const finance: admin.Actor = {
      userId: "test-fin",
      email: `fin-${runId}@test.local`,
      role: "finance",
    };
    await db
      .update(entitlementGrants)
      .set({ revokedAt: new Date() })
      .where(eq(entitlementGrants.householdId, householdId));
    const planOf = async () => {
      const s = await c.household.snapshot();
      if (s.status !== "ready") throw new Error();
      return s.data.plan;
    };
    expect((await planOf()).id).toBe("free");

    // financeiro libera 3 pets (sem virar Plus) por 30 dias
    const g = await admin.grantPlan(finance, {
      householdId,
      plan: "free",
      source: "manual",
      days: 30,
      overrides: { maxPets: 3 },
      reason: "Cortesia por atraso no suporte",
    });
    expect((await planOf()).entitlements.maxPets).toBe(3);
    await admin.revokeGrant(finance, {
      grantId: g.id,
      reason: "Fim da cortesia",
    });
    expect((await planOf()).entitlements.maxPets).toBe(1);

    // Plus manual por 90 dias
    await admin.setManualSubscription(finance, {
      householdId,
      interval: "quarterly",
      days: 90,
      reason: "Pagamento por Pix combinado",
    });
    expect(await planOf()).toMatchObject({
      id: "plus",
      source: "subscription",
    });

    // financeiro NÃO liga/desliga chaves globais nem suspende
    expect(
      await codeOf(() =>
        admin.setFlag(finance, {
          key: "maintenance",
          enabled: true,
          reason: "teste",
        }),
      ),
    ).toBe("forbidden");
    expect(
      await codeOf(() =>
        admin.suspendHousehold(finance, { householdId, reason: "não pode" }),
      ),
    ).toBe("forbidden");
    expect(
      await codeOf(() =>
        admin.grantPlan(viewer, {
          householdId,
          plan: "plus",
          source: "manual",
          days: 5,
          reason: "viewer",
        }),
      ),
    ).toBe("forbidden");
  });

  it("chaves globais: manutenção bloqueia escrita e cadastros podem ser fechados", async () => {
    const { c } = await newHouse("Casa Manutenção");
    await admin.setFlag(owner, {
      key: "maintenance",
      enabled: true,
      reason: "Migração de banco (teste)",
    });
    try {
      const write = () =>
        c.tasks.complete({
          taskKey: "aspirar",
          at: new Date().toISOString(),
          dateKey: new Date().toISOString().slice(0, 10),
          pts: 10,
        });
      const err = await write().catch((e) => e as TRPCError);
      expect((err as TRPCError).message).toBe("MAINTENANCE");
      const snap = await c.household.snapshot(); // leitura segue funcionando
      expect(snap.status).toBe("ready");
    } finally {
      await admin.setFlag(owner, {
        key: "maintenance",
        enabled: false,
        reason: "Fim da manutenção (teste)",
      });
    }

    await admin.setFlag(owner, {
      key: "signups_open",
      enabled: false,
      reason: "Campanha pausada (teste)",
    });
    try {
      const u = caller({ userId: `test-${randomUUID()}` });
      const err = await u.household
        .create({
          acceptedLegalVersion: LEGAL_VERSION,
          houseName: "Fechada",
          memberName: "Xu",
          profile: { ...DEFAULT_PROFILE, mode: "couple" },
          rooms: [],
          pets: [],
        })
        .catch((e) => e as TRPCError);
      expect((err as TRPCError).code).toBe("FORBIDDEN");
    } finally {
      await admin.setFlag(owner, {
        key: "signups_open",
        enabled: true,
        reason: "Campanha retomada (teste)",
      });
    }
    expect(
      await codeOf(() =>
        admin.setFlag(owner, {
          key: "chave_que_nao_existe",
          enabled: true,
          reason: "teste",
        }),
      ),
    ).toBe("not_found");
  });

  it("LGPD: pedido de exportação e exclusão fluem pela fila, com permissões e evidência", async () => {
    const email = `titular-${runId}@test.local`;
    const authId = await newAuthUser(email);
    const c = caller({ userId: authId });
    const { householdId } = await c.household.create({
      acceptedLegalVersion: LEGAL_VERSION,
      houseName: "Casa do Titular",
      memberName: "Titular",
      profile: { ...DEFAULT_PROFILE, mode: "couple" },
      rooms: [{ kind: "cozinha" }],
      pets: [],
    });
    houses.push(householdId);
    await c.tasks.complete({
      taskKey: "aspirar",
      at: new Date().toISOString(),
      dateKey: new Date().toISOString().slice(0, 10),
      pts: 10,
    });

    // autoatendimento: exportar
    const exp = await c.account.exportMyData();
    expect(exp.filename).toMatch(/^ocafy-meus-dados-\d{4}-\d{2}-\d{2}\.json$/);
    expect(exp.data).toMatchObject({ account: { id: authId, email } });
    expect((exp.data as { completions: unknown[] }).completions).toHaveLength(
      1,
    );
    expect(JSON.stringify(exp.data)).not.toContain("avatarData");

    // pedir exclusão: aparece na fila; repetir não duplica
    const r1 = await c.account.requestDeletion({ note: "Quero sair" });
    const r2 = await c.account.requestDeletion({});
    expect(r2.id).toBe(r1.id);
    const mine = await c.account.myRequests();
    expect(mine.map((r) => `${r.kind}:${r.status}`).sort()).toEqual([
      "delete:open",
      "export:done",
    ]);
    expect(new Date(r1.dueAt).getTime() - Date.now()).toBeGreaterThan(
      14 * 86_400_000,
    );

    // suporte pode lidar com exportações, mas não excluir
    expect(
      await codeOf(() =>
        admin.executeDeletionRequest(support, {
          requestId: r1.id,
          reason: "titular pediu",
        }),
      ),
    ).toBe("forbidden");
    // exportação errada para um pedido de exclusão
    expect(
      await codeOf(() =>
        admin.completeExportRequest(owner, {
          requestId: r1.id,
          reason: "tipo errado",
        }),
      ),
    ).toBe("invalid");

    // admin executa a exclusão: casa, dados e conta somem; a evidência fica
    const summary = await admin.executeDeletionRequest(owner, {
      requestId: r1.id,
      reason: "Pedido do titular confirmado por e-mail",
    });
    expect(summary).toEqual({
      removedMember: true,
      removedHousehold: true,
      removedAuthUser: true,
    });
    const [gone] = await db
      .select()
      .from(households)
      .where(eq(households.id, householdId));
    expect(gone).toBeUndefined();
    const stillUser = await db.execute(
      sql`select 1 from neon_auth."user" where id::text = ${authId}`,
    );
    expect(stillUser.rows).toHaveLength(0);
    const [req] = await db
      .select()
      .from(dataRequests)
      .where(eq(dataRequests.id, r1.id));
    expect(req).toMatchObject({ status: "done", handledBy: owner.email });
    expect(req.evidence).toContain("removedHousehold");
    expect((await lastAudit("lgpd.delete")).targetId).toBe(r1.id);
  });

  it("exclusão de um dos adultos: a casa fica com o outro e a posse é transferida", async () => {
    const a = await newHouse("Casa Dois Adultos");
    const { code } = await a.c.household.createInvite();
    const bId = await newAuthUser(`b-${runId}@test.local`);
    const b = caller({ userId: bId });
    await b.household.join({
      acceptedLegalVersion: LEGAL_VERSION,
      code,
      memberName: "Bia",
    });
    const owned = await deleteAccountData(a.userId);
    expect(owned).toMatchObject({
      removedMember: true,
      removedHousehold: false,
    });
    const snap = await b.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.members).toHaveLength(1);
    expect(snap.data.isOwner).toBe(true);
  });

  it("equipe: segundo fator TOTP, anti-replay, bloqueio por tentativas e gestão de papéis", async () => {
    const email = `staff-${runId}@test.local`;
    const authId = await newAuthUser(email);
    const created = await admin.createStaff(email, "support");
    staffIds.push(created.staff.id);
    expect(created.uri).toContain("otpauth://totp/");
    expect(created.staff.totpSecret).not.toContain(created.secret); // guardado cifrado

    // não é da equipe
    expect((await admin.verifyStaffTotp(randomUUID(), "123456")).ok).toBe(
      false,
    );

    const t0 = Date.now();
    const good = admin.totp(created.secret, t0);
    const r1 = await admin.verifyStaffTotp(authId, good, "127.0.0.1", t0);
    expect(r1.ok).toBe(true);
    // o mesmo código não vale duas vezes
    expect(await admin.verifyStaffTotp(authId, good, "127.0.0.1", t0)).toEqual({
      ok: false,
      reason: "replay",
    });

    // 5 erros seguidos travam
    for (let i = 0; i < 5; i++) {
      expect(
        await admin.verifyStaffTotp(authId, "000000", "10.0.0.1", t0 + 60_000),
      ).toEqual({ ok: false, reason: "invalid" });
    }
    expect(
      await admin.verifyStaffTotp(
        authId,
        admin.totp(created.secret, t0 + 120_000),
        "10.0.0.1",
        t0 + 120_000,
      ),
    ).toEqual({ ok: false, reason: "locked" });
    expect((await lastAudit("staff.login.failed")).actorEmail).toBe(email);

    // gestão da equipe: só o proprietário
    expect(
      await codeOf(() =>
        admin.changeStaffRole(support, {
          staffId: created.staff.id,
          role: "viewer",
          reason: "sem permissão",
        }),
      ),
    ).toBe("forbidden");
    await admin.changeStaffRole(owner, {
      staffId: created.staff.id,
      role: "viewer",
      reason: "Mudança de função (teste)",
    });
    const [row] = await db
      .select()
      .from(platformStaff)
      .where(eq(platformStaff.id, created.staff.id));
    expect(row.role).toBe("viewer");
    expect(await codeOf(() => admin.createStaff(email, "support"))).toBe(
      "conflict",
    );
    expect(
      await codeOf(() =>
        admin.createStaff(`ninguem-${runId}@test.local`, "support"),
      ),
    ).toBe("not_found");
    expect(await codeOf(() => admin.createStaff(email, "superuser"))).toBe(
      "invalid",
    );
    await admin.setStaffActive(owner, {
      staffId: created.staff.id,
      active: false,
      reason: "Saiu da equipe (teste)",
    });
    expect(await admin.findStaffByUserId(authId)).toBeNull();
  });

  it("painel: indicadores, busca e detalhe da casa", async () => {
    const { householdId } = await newHouse(`Casa Painel ${runId}`);
    const d = await admin.dashboard();
    expect(d.households).toBeGreaterThan(0);
    expect(d.plans.plus + d.plans.free).toBe(d.households);
    expect(d.requests.open).toBeGreaterThanOrEqual(0);

    const byName = await admin.searchHouseholds(`Painel ${runId}`);
    expect(byName.map((h) => h.id)).toContain(householdId);
    const byId = await admin.searchHouseholds(householdId);
    expect(byId).toHaveLength(1);
    expect(byId[0].plan).toContain("Plus"); // teste de boas-vindas

    const det = await admin.householdDetail(householdId);
    expect(det?.house.name).toBe(`Casa Painel ${runId}`);
    expect(det?.members).toHaveLength(1);
    expect(det?.grants[0]).toMatchObject({ source: "trial", plan: "plus" });
    expect(await admin.householdDetail(randomUUID())).toBeNull();

    await admin.addSupportNote(owner, {
      householdId,
      note: "Cliente pediu ajuda com o convite",
    });
    const after = await admin.householdDetail(householdId);
    expect(after?.notes[0].note).toContain("convite");
    expect(after?.audit.some((a) => a.action === "note.add")).toBe(true);
  });
});
