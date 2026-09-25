import type { Entitlements } from "@ocafy/core";
import {
  dataRequests,
  db,
  entitlementGrants,
  featureFlags,
  householdMembers,
  households,
  platformStaff,
  subscriptions,
  supportNotes,
} from "@ocafy/db";
import { and, eq, sql } from "drizzle-orm";
import { flag, invalidateFlags } from "../flags";
import { deleteAccountData, exportAccountData } from "../lgpd";
import { type Actor, AdminError, guarded } from "./audit";
import { isStaffRole } from "./permissions";
import { createStaff } from "./staff";

/**
 * Ações do painel. Cada uma: permissão no servidor + justificativa + auditoria (guarded).
 * Nada aqui apaga o histórico de uso das pessoas, exceto a exclusão pedida pelo titular (LGPD).
 */

const DAY = 86_400_000;

const householdOrThrow = async (id: string) => {
  const [h] = await db.select().from(households).where(eq(households.id, id));
  if (!h) throw new AdminError("not_found", "Casa não encontrada.");
  return h;
};

/* ---------------- casas ---------------- */

export async function suspendHousehold(
  actor: Actor,
  input: { householdId: string; reason: string },
) {
  return guarded(
    actor,
    "household.suspend",
    {
      action: "household.suspend",
      targetType: "household",
      targetId: input.householdId,
      householdId: input.householdId,
      reason: input.reason,
    },
    async () => {
      const h = await householdOrThrow(input.householdId);
      await db
        .update(households)
        .set({
          suspendedAt: new Date(),
          suspendedReason: input.reason.trim().slice(0, 200),
          rev: sql`${households.rev} + 1`,
        })
        .where(eq(households.id, h.id));
      return {
        result: { ok: true },
        before: { suspendedAt: h.suspendedAt },
        after: { suspendedAt: "now", reason: input.reason.trim() },
      };
    },
  );
}

export async function unsuspendHousehold(
  actor: Actor,
  input: { householdId: string; reason: string },
) {
  return guarded(
    actor,
    "household.suspend",
    {
      action: "household.unsuspend",
      targetType: "household",
      targetId: input.householdId,
      householdId: input.householdId,
      reason: input.reason,
    },
    async () => {
      const h = await householdOrThrow(input.householdId);
      await db
        .update(households)
        .set({
          suspendedAt: null,
          suspendedReason: null,
          rev: sql`${households.rev} + 1`,
        })
        .where(eq(households.id, h.id));
      return {
        result: { ok: true },
        before: { suspendedAt: h.suspendedAt, reason: h.suspendedReason },
        after: { suspendedAt: null },
      };
    },
  );
}

export async function addSupportNote(
  actor: Actor,
  input: { householdId: string; note: string },
) {
  return guarded(
    actor,
    "notes",
    {
      action: "note.add",
      targetType: "household",
      targetId: input.householdId,
      householdId: input.householdId,
      reason: "Nota interna de suporte",
    },
    async () => {
      await householdOrThrow(input.householdId);
      const note = input.note.trim().slice(0, 1000);
      if (!note) throw new AdminError("invalid", "Escreva a nota.");
      await db.insert(supportNotes).values({
        householdId: input.householdId,
        author: actor.email,
        note,
      });
      return { result: { ok: true }, after: { note } };
    },
  );
}

/* ---------------- planos e assinaturas ---------------- */

export async function grantPlan(
  actor: Actor,
  input: {
    householdId: string;
    plan: "free" | "plus";
    source: "manual" | "promo";
    /** Dias de validade (null = sem prazo). */
    days: number | null;
    overrides?: Partial<Entitlements> | null;
    reason: string;
  },
) {
  return guarded(
    actor,
    "plan.write",
    {
      action: "plan.grant",
      targetType: "household",
      targetId: input.householdId,
      householdId: input.householdId,
      reason: input.reason,
    },
    async () => {
      await householdOrThrow(input.householdId);
      if (input.days != null && !(input.days > 0 && input.days <= 3650)) {
        throw new AdminError("invalid", "Prazo inválido (1 a 3650 dias).");
      }
      const overrides = input.overrides ?? null;
      if (input.plan === "free" && !overrides) {
        throw new AdminError(
          "invalid",
          "Uma liberação grátis precisa de ajustes.",
        );
      }
      const [g] = await db
        .insert(entitlementGrants)
        .values({
          householdId: input.householdId,
          plan: input.plan,
          source: input.source,
          expiresAt: input.days
            ? new Date(Date.now() + input.days * DAY)
            : null,
          overrides,
          reason: input.reason.trim(),
          grantedBy: actor.email,
        })
        .returning();
      return {
        result: { id: g.id },
        targetId: input.householdId,
        after: {
          plan: input.plan,
          source: input.source,
          days: input.days,
          overrides,
        },
      };
    },
  );
}

export async function revokeGrant(
  actor: Actor,
  input: { grantId: string; reason: string },
) {
  return guarded(
    actor,
    "plan.write",
    {
      action: "plan.revoke",
      targetType: "grant",
      targetId: input.grantId,
      reason: input.reason,
    },
    async () => {
      const [g] = await db
        .select()
        .from(entitlementGrants)
        .where(eq(entitlementGrants.id, input.grantId));
      if (!g) throw new AdminError("not_found", "Liberação não encontrada.");
      if (g.revokedAt) throw new AdminError("conflict", "Já estava revogada.");
      await db
        .update(entitlementGrants)
        .set({ revokedAt: new Date() })
        .where(eq(entitlementGrants.id, g.id));
      return {
        result: { ok: true },
        householdId: g.householdId,
        before: { plan: g.plan, source: g.source, expiresAt: g.expiresAt },
        after: { revokedAt: "now" },
      };
    },
  );
}

/** Assinatura manual (cortesia paga por fora, migração, teste do financeiro). */
export async function setManualSubscription(
  actor: Actor,
  input: {
    householdId: string;
    interval: "monthly" | "quarterly" | "yearly";
    days: number;
    reason: string;
  },
) {
  return guarded(
    actor,
    "subscription.write",
    {
      action: "subscription.manual",
      targetType: "household",
      targetId: input.householdId,
      householdId: input.householdId,
      reason: input.reason,
    },
    async () => {
      await householdOrThrow(input.householdId);
      if (!(input.days > 0 && input.days <= 3650)) {
        throw new AdminError("invalid", "Prazo inválido (1 a 3650 dias).");
      }
      const values = {
        householdId: input.householdId,
        provider: "manual" as const,
        providerRef: `manual-${input.householdId}`,
        interval: input.interval,
        status: "active" as const,
        currentPeriodEnd: new Date(Date.now() + input.days * DAY),
        graceUntil: null,
        cancelAtPeriodEnd: false,
        updatedAt: new Date(),
      };
      const [before] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.providerRef, values.providerRef));
      await db
        .insert(subscriptions)
        .values(values)
        .onConflictDoUpdate({
          target: [subscriptions.provider, subscriptions.providerRef],
          set: values,
        });
      return {
        result: { ok: true },
        before: before
          ? { status: before.status, currentPeriodEnd: before.currentPeriodEnd }
          : null,
        after: { status: "active", days: input.days, interval: input.interval },
      };
    },
  );
}

export async function expireSubscription(
  actor: Actor,
  input: { subscriptionId: string; reason: string },
) {
  return guarded(
    actor,
    "subscription.write",
    {
      action: "subscription.expire",
      targetType: "subscription",
      targetId: input.subscriptionId,
      reason: input.reason,
    },
    async () => {
      const [s] = await db
        .select()
        .from(subscriptions)
        .where(eq(subscriptions.id, input.subscriptionId));
      if (!s) throw new AdminError("not_found", "Assinatura não encontrada.");
      await db
        .update(subscriptions)
        .set({
          status: "expired",
          graceUntil: null,
          currentPeriodEnd: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(subscriptions.id, s.id));
      return {
        result: { ok: true },
        householdId: s.householdId,
        before: { status: s.status, currentPeriodEnd: s.currentPeriodEnd },
        after: { status: "expired" },
      };
    },
  );
}

/* ---------------- chaves globais ---------------- */

export async function setFlag(
  actor: Actor,
  input: { key: string; enabled: boolean; reason: string },
) {
  return guarded(
    actor,
    "flags.write",
    {
      action: "flag.set",
      targetType: "flag",
      targetId: input.key,
      reason: input.reason,
    },
    async () => {
      const [f] = await db
        .select()
        .from(featureFlags)
        .where(eq(featureFlags.key, input.key));
      if (!f) throw new AdminError("not_found", "Chave desconhecida.");
      await db
        .update(featureFlags)
        .set({
          enabled: input.enabled,
          updatedAt: new Date(),
          updatedBy: actor.email,
        })
        .where(eq(featureFlags.key, input.key));
      invalidateFlags();
      return {
        result: { ok: true },
        before: { enabled: f.enabled },
        after: { enabled: input.enabled },
      };
    },
  );
}

/* ---------------- usuários ---------------- */

/** Bane a conta no Neon Auth (encerra sessões) — para abuso comprovado. */
export async function banUser(
  actor: Actor,
  input: { userId: string; reason: string; unban?: boolean },
) {
  return guarded(
    actor,
    "user.ban",
    {
      action: input.unban ? "user.unban" : "user.ban",
      targetType: "user",
      targetId: input.userId,
      reason: input.reason,
    },
    async () => {
      const r = await db.execute<{ id: string; banned: boolean | null }>(sql`
        select id::text as id, banned from neon_auth."user" where id::text = ${input.userId}
      `);
      const u = r.rows[0];
      if (!u) throw new AdminError("not_found", "Usuário não encontrado.");
      if (input.unban) {
        await db.execute(
          sql`update neon_auth."user" set banned = false, "banReason" = null, "banExpires" = null where id::text = ${input.userId}`,
        );
      } else {
        await db.execute(
          sql`update neon_auth."user" set banned = true, "banReason" = ${input.reason.trim().slice(0, 200)} where id::text = ${input.userId}`,
        );
        await db.execute(
          sql`delete from neon_auth.session where "userId"::text = ${input.userId}`,
        );
      }
      const [m] = await db
        .select({ householdId: householdMembers.householdId })
        .from(householdMembers)
        .where(eq(householdMembers.userId, input.userId));
      return {
        result: { ok: true },
        householdId: m?.householdId ?? null,
        before: { banned: u.banned },
        after: { banned: !input.unban },
      };
    },
  );
}

/* ---------------- LGPD ---------------- */

const requestOrThrow = async (id: string) => {
  const [r] = await db
    .select()
    .from(dataRequests)
    .where(eq(dataRequests.id, id));
  if (!r) throw new AdminError("not_found", "Pedido não encontrado.");
  return r;
};

/** Gera a cópia dos dados e conclui o pedido de exportação. Devolve o JSON para entregar. */
export async function completeExportRequest(
  actor: Actor,
  input: { requestId: string; reason: string },
) {
  return guarded(
    actor,
    "lgpd.handle",
    {
      action: "lgpd.export",
      targetType: "data_request",
      targetId: input.requestId,
      reason: input.reason,
    },
    async () => {
      const r = await requestOrThrow(input.requestId);
      if (r.kind !== "export")
        throw new AdminError("invalid", "O pedido não é de exportação.");
      if (r.status === "done")
        throw new AdminError("conflict", "Pedido já concluído.");
      const data = await exportAccountData(r.userId);
      await db
        .update(dataRequests)
        .set({
          status: "done",
          completedAt: new Date(),
          handledBy: actor.email,
          evidence: `Exportação gerada em ${new Date().toISOString()} por ${actor.email}`,
        })
        .where(eq(dataRequests.id, r.id));
      return {
        result: data,
        householdId: r.householdId,
        before: { status: r.status },
        after: { status: "done" },
      };
    },
  );
}

/** Executa a exclusão da conta e dos dados pedida pelo titular. Irreversível. */
export async function executeDeletionRequest(
  actor: Actor,
  input: { requestId: string; reason: string },
) {
  return guarded(
    actor,
    "lgpd.delete",
    {
      action: "lgpd.delete",
      targetType: "data_request",
      targetId: input.requestId,
      reason: input.reason,
    },
    async () => {
      const r = await requestOrThrow(input.requestId);
      if (r.kind !== "delete")
        throw new AdminError("invalid", "O pedido não é de exclusão.");
      if (r.status === "done")
        throw new AdminError("conflict", "Pedido já concluído.");
      const summary = await deleteAccountData(r.userId);
      await db
        .update(dataRequests)
        .set({
          status: "done",
          completedAt: new Date(),
          handledBy: actor.email,
          evidence: JSON.stringify(summary),
        })
        .where(eq(dataRequests.id, r.id));
      return {
        result: summary,
        householdId: r.householdId,
        before: { status: r.status },
        after: { status: "done", ...summary },
      };
    },
  );
}

export async function updateDataRequest(
  actor: Actor,
  input: {
    requestId: string;
    status: "in_progress" | "rejected";
    reason: string;
  },
) {
  return guarded(
    actor,
    "lgpd.handle",
    {
      action: `lgpd.${input.status}`,
      targetType: "data_request",
      targetId: input.requestId,
      reason: input.reason,
    },
    async () => {
      const r = await requestOrThrow(input.requestId);
      if (r.status === "done")
        throw new AdminError("conflict", "Pedido já concluído.");
      await db
        .update(dataRequests)
        .set({
          status: input.status,
          handledBy: actor.email,
          note: input.status === "rejected" ? input.reason.trim() : r.note,
          completedAt: input.status === "rejected" ? new Date() : null,
        })
        .where(eq(dataRequests.id, r.id));
      return {
        result: { ok: true },
        householdId: r.householdId,
        before: { status: r.status },
        after: { status: input.status },
      };
    },
  );
}

/* ---------------- equipe ---------------- */

export async function addStaffMember(
  actor: Actor,
  input: { email: string; role: string; reason: string },
) {
  return guarded(
    actor,
    "staff.manage",
    {
      action: "staff.add",
      targetType: "staff",
      reason: input.reason,
    },
    async () => {
      const created = await createStaff(input.email, input.role);
      return {
        result: { secret: created.secret, uri: created.uri },
        targetId: created.staff.id,
        after: { email: created.staff.email, role: created.staff.role },
      };
    },
  );
}

export async function setStaffActive(
  actor: Actor,
  input: { staffId: string; active: boolean; reason: string },
) {
  return guarded(
    actor,
    "staff.manage",
    {
      action: input.active ? "staff.activate" : "staff.deactivate",
      targetType: "staff",
      targetId: input.staffId,
      reason: input.reason,
    },
    async () => {
      const [s] = await db
        .select()
        .from(platformStaff)
        .where(eq(platformStaff.id, input.staffId));
      if (!s) throw new AdminError("not_found", "Pessoa não encontrada.");
      if (s.userId === actor.userId && !input.active) {
        throw new AdminError("invalid", "Você não pode desativar a si mesmo.");
      }
      await db
        .update(platformStaff)
        .set({ active: input.active })
        .where(eq(platformStaff.id, s.id));
      return {
        result: { ok: true },
        before: { active: s.active },
        after: { active: input.active },
      };
    },
  );
}

export async function changeStaffRole(
  actor: Actor,
  input: { staffId: string; role: string; reason: string },
) {
  return guarded(
    actor,
    "staff.manage",
    {
      action: "staff.role",
      targetType: "staff",
      targetId: input.staffId,
      reason: input.reason,
    },
    async () => {
      if (!isStaffRole(input.role))
        throw new AdminError("invalid", "Papel inválido.");
      const [s] = await db
        .select()
        .from(platformStaff)
        .where(eq(platformStaff.id, input.staffId));
      if (!s) throw new AdminError("not_found", "Pessoa não encontrada.");
      if (s.userId === actor.userId) {
        throw new AdminError("invalid", "Você não pode mudar o próprio papel.");
      }
      await db
        .update(platformStaff)
        .set({ role: input.role })
        .where(and(eq(platformStaff.id, s.id)));
      return {
        result: { ok: true },
        before: { role: s.role },
        after: { role: input.role },
      };
    },
  );
}

export { flag };
