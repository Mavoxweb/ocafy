import { adminAuditLog, db } from "@ocafy/db";
import { type Permission, type StaffRole, can } from "./permissions";

/**
 * Toda ação do painel passa por `guarded`: confere a permissão NO SERVIDOR, exige uma
 * justificativa e grava no registro de auditoria (imutável no banco) — inclusive tentativas
 * negadas e ações que falharam.
 */

export interface Actor {
  userId: string;
  email: string;
  role: StaffRole;
  ip?: string | null;
}

export type AdminErrorCode =
  | "forbidden"
  | "reason_required"
  | "not_found"
  | "invalid"
  | "conflict";

export class AdminError extends Error {
  constructor(
    public code: AdminErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminError";
  }
}

export interface AuditMeta {
  /** Ex.: "household.suspend". */
  action: string;
  targetType: string;
  targetId?: string | null;
  householdId?: string | null;
  reason: string;
}

export const MIN_REASON = 5;

const clip = (v: unknown) => (v === undefined ? null : v);

export async function writeAudit(
  actor: Actor,
  meta: AuditMeta,
  extra: { before?: unknown; after?: unknown } = {},
): Promise<void> {
  await db.insert(adminAuditLog).values({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: meta.action,
    targetType: meta.targetType,
    targetId: meta.targetId ?? null,
    householdId: meta.householdId ?? null,
    reason: meta.reason,
    before: clip(extra.before) as object | null,
    after: clip(extra.after) as object | null,
    ip: actor.ip ?? null,
  });
}

export interface Outcome<T> {
  result: T;
  before?: unknown;
  after?: unknown;
  /** Quando o alvo só é conhecido depois de agir (ex.: id criado). */
  targetId?: string | null;
  householdId?: string | null;
}

/** Executa uma ação administrativa com permissão, justificativa e auditoria. */
export async function guarded<T>(
  actor: Actor,
  permission: Permission,
  meta: AuditMeta,
  run: () => Promise<Outcome<T>>,
): Promise<T> {
  if (!can(actor.role, permission)) {
    await writeAudit(actor, {
      ...meta,
      action: `${meta.action}.denied`,
      reason: `Sem permissão (${permission}) — papel ${actor.role}`,
    });
    throw new AdminError("forbidden", "Seu papel não permite esta ação.");
  }
  if (!meta.reason || meta.reason.trim().length < MIN_REASON) {
    throw new AdminError(
      "reason_required",
      `Escreva a justificativa (mínimo ${MIN_REASON} caracteres).`,
    );
  }
  const reason = meta.reason.trim();
  try {
    const out = await run();
    await writeAudit(
      actor,
      {
        ...meta,
        reason,
        targetId: out.targetId ?? meta.targetId ?? null,
        householdId: out.householdId ?? meta.householdId ?? null,
      },
      { before: out.before, after: out.after },
    );
    return out.result;
  } catch (e) {
    await writeAudit(
      actor,
      { ...meta, action: `${meta.action}.failed`, reason },
      { after: { error: e instanceof Error ? e.message : String(e) } },
    ).catch(() => {});
    throw e;
  }
}
