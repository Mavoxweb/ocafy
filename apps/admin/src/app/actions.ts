"use server";

import { auth } from "@/lib/auth-server";
import { ADMIN_BASE } from "@/lib/base";
import {
  clearSessionCookie,
  clientIp,
  requireStaff,
  setSessionCookie,
} from "@/lib/staff";
import { admin } from "@ocafy/api";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Todas as ações do painel. Cada uma confere a permissão no servidor (o mesmo `guarded` do
 * núcleo, que também exige a justificativa e grava a auditoria). Resultado volta por
 * `?ok=` / `?err=` na mesma página.
 */

const s = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

function back(path: string, ok?: string, err?: string): never {
  const q = new URLSearchParams();
  if (ok) q.set("ok", ok);
  if (err) q.set("err", err);
  redirect(`${path}${q.size ? `?${q}` : ""}`);
}

const message = (e: unknown) =>
  e instanceof admin.AdminError
    ? e.message
    : "Não foi possível concluir. Tente de novo.";

async function act(
  path: string,
  permission: admin.Permission,
  okMessage: string,
  run: (me: Awaited<ReturnType<typeof requireStaff>>) => Promise<unknown>,
): Promise<never> {
  const me = await requireStaff(permission);
  try {
    await run(me);
  } catch (e) {
    back(path, undefined, message(e));
  }
  revalidatePath(path);
  return back(path, okMessage);
}

/* ---------------- login ---------------- */

export async function submitTotp(_prev: unknown, form: FormData) {
  const { data } = await auth.getSession();
  const userId = data?.user?.id;
  if (!userId) redirect(`${ADMIN_BASE}/login`);
  const r = await admin.verifyStaffTotp(
    userId,
    s(form, "code"),
    await clientIp(),
  );
  if (!r.ok) {
    return {
      error:
        r.reason === "locked"
          ? "Muitas tentativas. Aguarde alguns minutos."
          : r.reason === "not_staff"
            ? "Esta conta não tem acesso ao painel."
            : r.reason === "replay"
              ? "Este código já foi usado. Aguarde o próximo."
              : "Código incorreto.",
    };
  }
  await setSessionCookie(
    admin.signSession({
      uid: r.staff.userId,
      email: r.staff.email,
      role: r.staff.role,
    }),
  );
  redirect(ADMIN_BASE);
}

export async function logout() {
  await clearSessionCookie();
  redirect(`${ADMIN_BASE}/login`);
}

/* ---------------- casas ---------------- */

export async function suspend(form: FormData) {
  const id = s(form, "householdId");
  await act(
    `${ADMIN_BASE}/casas/${id}`,
    "household.suspend",
    "Casa suspensa.",
    (me) =>
      admin.suspendHousehold(me, {
        householdId: id,
        reason: s(form, "reason"),
      }),
  );
}

export async function unsuspend(form: FormData) {
  const id = s(form, "householdId");
  await act(
    `${ADMIN_BASE}/casas/${id}`,
    "household.suspend",
    "Casa reativada.",
    (me) =>
      admin.unsuspendHousehold(me, {
        householdId: id,
        reason: s(form, "reason"),
      }),
  );
}

export async function addNote(form: FormData) {
  const id = s(form, "householdId");
  await act(`${ADMIN_BASE}/casas/${id}`, "notes", "Nota salva.", (me) =>
    admin.addSupportNote(me, { householdId: id, note: s(form, "note") }),
  );
}

export async function grant(form: FormData) {
  const id = s(form, "householdId");
  const plan = s(form, "plan") === "free" ? "free" : "plus";
  const days = Number(s(form, "days"));
  const maxPets = Number(s(form, "maxPets"));
  const overrides =
    plan === "free"
      ? {
          ...(maxPets > 0 ? { maxPets } : {}),
          ...(form.get("family") ? { family: true } : {}),
        }
      : null;
  await act(
    `${ADMIN_BASE}/casas/${id}`,
    "plan.write",
    "Liberação criada.",
    (me) =>
      admin.grantPlan(me, {
        householdId: id,
        plan,
        source: s(form, "source") === "promo" ? "promo" : "manual",
        days: days > 0 ? days : null,
        overrides,
        reason: s(form, "reason"),
      }),
  );
}

export async function revoke(form: FormData) {
  const id = s(form, "householdId");
  await act(
    `${ADMIN_BASE}/casas/${id}`,
    "plan.write",
    "Liberação revogada.",
    (me) =>
      admin.revokeGrant(me, {
        grantId: s(form, "grantId"),
        reason: s(form, "reason"),
      }),
  );
}

export async function manualSubscription(form: FormData) {
  const id = s(form, "householdId");
  const interval = s(form, "interval");
  await act(
    `${ADMIN_BASE}/casas/${id}`,
    "subscription.write",
    "Assinatura manual registrada.",
    (me) =>
      admin.setManualSubscription(me, {
        householdId: id,
        interval:
          interval === "monthly" || interval === "yearly"
            ? interval
            : "quarterly",
        days: Number(s(form, "days")),
        reason: s(form, "reason"),
      }),
  );
}

export async function expire(form: FormData) {
  const id = s(form, "householdId");
  await act(
    `${ADMIN_BASE}/casas/${id}`,
    "subscription.write",
    "Assinatura encerrada.",
    (me) =>
      admin.expireSubscription(me, {
        subscriptionId: s(form, "subscriptionId"),
        reason: s(form, "reason"),
      }),
  );
}

export async function ban(form: FormData) {
  const id = s(form, "householdId");
  const unban = s(form, "unban") === "1";
  await act(
    `${ADMIN_BASE}/casas/${id}`,
    "user.ban",
    unban ? "Conta reativada." : "Conta banida e sessões encerradas.",
    (me) =>
      admin.banUser(me, {
        userId: s(form, "userId"),
        reason: s(form, "reason"),
        unban,
      }),
  );
}

/* ---------------- chaves ---------------- */

export async function toggleFlag(form: FormData) {
  await act(`${ADMIN_BASE}/flags`, "flags.write", "Chave atualizada.", (me) =>
    admin.setFlag(me, {
      key: s(form, "key"),
      enabled: s(form, "enabled") === "1",
      reason: s(form, "reason"),
    }),
  );
}

/* ---------------- LGPD ---------------- */

export async function requestStatus(form: FormData) {
  const status = s(form, "status") === "rejected" ? "rejected" : "in_progress";
  await act(`${ADMIN_BASE}/lgpd`, "lgpd.handle", "Pedido atualizado.", (me) =>
    admin.updateDataRequest(me, {
      requestId: s(form, "requestId"),
      status,
      reason: s(form, "reason"),
    }),
  );
}

export async function executeDeletion(form: FormData) {
  await act(`${ADMIN_BASE}/lgpd`, "lgpd.delete", "Exclusão executada.", (me) =>
    admin.executeDeletionRequest(me, {
      requestId: s(form, "requestId"),
      reason: s(form, "reason"),
    }),
  );
}

/* ---------------- equipe ---------------- */

export async function addStaff(_prev: unknown, form: FormData) {
  const me = await requireStaff("staff.manage");
  try {
    const r = await admin.addStaffMember(me, {
      email: s(form, "email"),
      role: s(form, "role"),
      reason: s(form, "reason"),
    });
    revalidatePath(`${ADMIN_BASE}/equipe`);
    return { secret: r.secret, uri: r.uri, error: null };
  } catch (e) {
    return { secret: null, uri: null, error: message(e) };
  }
}

export async function staffActive(form: FormData) {
  await act(
    `${ADMIN_BASE}/equipe`,
    "staff.manage",
    "Equipe atualizada.",
    (me) =>
      admin.setStaffActive(me, {
        staffId: s(form, "staffId"),
        active: s(form, "active") === "1",
        reason: s(form, "reason"),
      }),
  );
}

export async function staffRole(form: FormData) {
  await act(`${ADMIN_BASE}/equipe`, "staff.manage", "Papel atualizado.", (me) =>
    admin.changeStaffRole(me, {
      staffId: s(form, "staffId"),
      role: s(form, "role"),
      reason: s(form, "reason"),
    }),
  );
}

/* ---------------- marketing interno ---------------- */

/** `datetime-local` não carrega fuso: o painel opera no horário de Brasília (UTC-3, sem horário de verão). */
const brDate = (v: string): Date => new Date(`${v}:00-03:00`);

function campaignFromForm(form: FormData) {
  const endsAt = s(form, "endsAt");
  return {
    title: s(form, "title"),
    body: s(form, "body"),
    ctaLabel: s(form, "ctaLabel") || null,
    ctaUrl: s(form, "ctaUrl") || null,
    kind:
      s(form, "kind") === "modal" ? ("modal" as const) : ("banner" as const),
    audience:
      s(form, "audience") === "free"
        ? ("free" as const)
        : s(form, "audience") === "plus"
          ? ("plus" as const)
          : ("all" as const),
    priority: Number(s(form, "priority")) || 0,
    startsAt: brDate(s(form, "startsAt")),
    endsAt: endsAt ? brDate(endsAt) : null,
    dismissible: form.get("dismissible") === "1",
  };
}

export async function createCampaign(form: FormData) {
  await act(
    `${ADMIN_BASE}/marketing`,
    "marketing.write",
    "Campanha criada.",
    (me) =>
      admin.createCampaign(me, {
        ...campaignFromForm(form),
        reason: s(form, "reason"),
      }),
  );
}

export async function updateCampaign(form: FormData) {
  const id = s(form, "id");
  await act(
    `${ADMIN_BASE}/marketing/${id}`,
    "marketing.write",
    "Campanha atualizada.",
    (me) =>
      admin.updateCampaign(me, {
        id,
        ...campaignFromForm(form),
        reason: s(form, "reason"),
      }),
  );
}

export async function campaignActive(form: FormData) {
  await act(
    `${ADMIN_BASE}/marketing`,
    "marketing.write",
    "Campanha atualizada.",
    (me) =>
      admin.setCampaignActive(me, {
        id: s(form, "id"),
        active: s(form, "active") === "1",
        reason: s(form, "reason"),
      }),
  );
}

export async function deleteCampaign(form: FormData) {
  await act(
    `${ADMIN_BASE}/marketing`,
    "marketing.write",
    "Campanha excluída.",
    (me) =>
      admin.deleteCampaign(me, {
        id: s(form, "id"),
        reason: s(form, "reason"),
      }),
  );
}
