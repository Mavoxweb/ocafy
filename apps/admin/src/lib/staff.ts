import "server-only";
import { admin } from "@ocafy/api";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Sessão do painel: cookie assinado emitido só depois de login + segundo fator. A função e o
 * status ativo vêm SEMPRE do banco (não do cookie): mudar o papel ou desativar alguém vale na hora.
 */

export const COOKIE = "ocafy_admin";

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    null
  );
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: Math.floor(admin.SESSION_TTL_MS / 1000),
  });
}

export async function clearSessionCookie() {
  (await cookies()).delete(COOKIE);
}

export interface CurrentStaff extends admin.Actor {
  staffId: string;
}

/** Quem está logado (ou null). */
export async function currentStaff(): Promise<CurrentStaff | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  const s = admin.verifySession(token);
  if (!s) return null;
  const row = await admin.findStaffByUserId(s.uid);
  if (!row) return null;
  return {
    staffId: row.id,
    userId: row.userId,
    email: row.email,
    role: row.role,
    ip: await clientIp(),
  };
}

/** Páginas e ações: exige login e (opcionalmente) uma permissão. */
export async function requireStaff(
  permission: admin.Permission = "read",
): Promise<CurrentStaff> {
  const me = await currentStaff();
  if (!me) redirect("/login");
  if (!admin.can(me.role, permission)) redirect("/?negado=1");
  return me;
}
