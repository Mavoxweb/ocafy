import { adminAuditLog, db, platformStaff } from "@ocafy/db";
import { and, count, eq, gt, like } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { type Actor, AdminError, writeAudit } from "./audit";
import { isStaffRole } from "./permissions";
import { open, seal } from "./secretbox";
import { generateTotpSecret, otpauthUri, verifyTotp } from "./totp";

/** Equipe do painel: cadastro, segundo fator (TOTP) e primeiro proprietário. */

export type StaffRow = typeof platformStaff.$inferSelect;

export async function findStaffByUserId(
  userId: string,
): Promise<StaffRow | null> {
  const [row] = await db
    .select()
    .from(platformStaff)
    .where(
      and(eq(platformStaff.userId, userId), eq(platformStaff.active, true)),
    );
  return row ?? null;
}

const MAX_FAILS = 5;
const WINDOW_MIN = 10;

/** Falhas recentes de segundo fator (lidas do registro de auditoria: vale em qualquer instância). */
async function recentFailures(userId: string): Promise<number> {
  const since = new Date(Date.now() - WINDOW_MIN * 60_000);
  const [{ n }] = await db
    .select({ n: count() })
    .from(adminAuditLog)
    .where(
      and(
        eq(adminAuditLog.actorUserId, userId),
        eq(adminAuditLog.action, "staff.login.failed"),
        gt(adminAuditLog.createdAt, since),
      ),
    );
  return n;
}

export type TotpResult =
  | { ok: true; staff: StaffRow }
  | { ok: false; reason: "not_staff" | "invalid" | "locked" | "replay" };

/** Confere o segundo fator. 5 erros em 10 minutos travam a conta por alguns minutos. */
export async function verifyStaffTotp(
  userId: string,
  code: string,
  ip?: string | null,
  now = Date.now(),
): Promise<TotpResult> {
  const staff = await findStaffByUserId(userId);
  if (!staff) return { ok: false, reason: "not_staff" };
  const actor: Actor = { userId, email: staff.email, role: staff.role, ip };
  if ((await recentFailures(userId)) >= MAX_FAILS) {
    return { ok: false, reason: "locked" };
  }
  const v = verifyTotp(open(staff.totpSecret), code, now);
  if (!v.ok) {
    await writeAudit(actor, {
      action: "staff.login.failed",
      targetType: "staff",
      targetId: staff.id,
      reason: "Código do segundo fator incorreto",
    });
    return { ok: false, reason: "invalid" };
  }
  // O mesmo código não vale duas vezes (anti-replay).
  if (staff.lastTotpStep != null && v.step <= staff.lastTotpStep) {
    return { ok: false, reason: "replay" };
  }
  await db
    .update(platformStaff)
    .set({
      lastTotpStep: v.step,
      lastLoginAt: new Date(now),
      totpEnabledAt: staff.totpEnabledAt ?? new Date(now),
    })
    .where(eq(platformStaff.id, staff.id));
  await writeAudit(actor, {
    action: "staff.login",
    targetType: "staff",
    targetId: staff.id,
    reason: "Login com segundo fator",
  });
  return { ok: true, staff };
}

async function userByEmail(email: string) {
  const r = await db.execute<{ id: string; email: string }>(sql`
    select id::text as id, email from neon_auth."user" where lower(email) = ${email.toLowerCase()} limit 1
  `);
  return r.rows[0] ?? null;
}

/** Cria um membro da equipe e devolve o segredo do autenticador (mostrado uma única vez). */
export async function createStaff(
  email: string,
  role: string,
): Promise<{ staff: StaffRow; secret: string; uri: string }> {
  if (!isStaffRole(role)) throw new AdminError("invalid", "Papel inválido.");
  const user = await userByEmail(email);
  if (!user) {
    throw new AdminError(
      "not_found",
      "Nenhuma conta com esse e-mail. A pessoa precisa criar a conta no Ocafy antes.",
    );
  }
  const [existing] = await db
    .select()
    .from(platformStaff)
    .where(eq(platformStaff.userId, user.id));
  if (existing)
    throw new AdminError("conflict", "Esta pessoa já está na equipe.");
  const secret = generateTotpSecret();
  const [staff] = await db
    .insert(platformStaff)
    .values({
      userId: user.id,
      email: user.email,
      role,
      totpSecret: seal(secret),
    })
    .returning();
  return { staff, secret, uri: otpauthUri(secret, user.email) };
}

/** Primeiro proprietário (script de instalação): só funciona enquanto a equipe está vazia. */
export async function bootstrapOwner(email: string) {
  const [{ n }] = await db.select({ n: count() }).from(platformStaff);
  if (n > 0) {
    throw new AdminError(
      "conflict",
      "A equipe já existe. Peça a um proprietário para convidar você pelo painel.",
    );
  }
  const created = await createStaff(email, "owner");
  await writeAudit(
    { userId: "system", email: "system", role: "owner" },
    {
      action: "staff.bootstrap",
      targetType: "staff",
      targetId: created.staff.id,
      reason: `Primeiro proprietário criado: ${email}`,
    },
  );
  return created;
}

export async function listStaff(): Promise<StaffRow[]> {
  return db.select().from(platformStaff);
}

/** Auditoria: ações de um alvo (usado no detalhe da casa). */
export async function auditFor(householdId: string, limit = 50) {
  return db
    .select()
    .from(adminAuditLog)
    .where(like(adminAuditLog.householdId, householdId))
    .orderBy(sql`${adminAuditLog.createdAt} desc`)
    .limit(limit);
}
