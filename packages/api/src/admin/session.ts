import { createHmac, timingSafeEqual } from "node:crypto";
import type { StaffRole } from "./permissions";

/**
 * Sessão do painel admin: cookie assinado (HMAC-SHA256) emitido só DEPOIS de login + TOTP.
 * Segredo: ADMIN_SESSION_SECRET. Curta (8 h) e sem estado no servidor.
 */

export interface AdminSession {
  uid: string;
  email: string;
  role: StaffRole;
  /** Expira em (ms desde 1970). */
  exp: number;
}

export const SESSION_TTL_MS = 8 * 3600 * 1000;

const b64 = (b: Buffer) => b.toString("base64url");

function secret(): string {
  const s = process.env.ADMIN_SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error(
      "ADMIN_SESSION_SECRET ausente ou curto demais (mínimo 32 caracteres).",
    );
  }
  return s;
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest();

export function signSession(
  s: Omit<AdminSession, "exp">,
  now = Date.now(),
  ttl = SESSION_TTL_MS,
): string {
  const payload = b64(Buffer.from(JSON.stringify({ ...s, exp: now + ttl })));
  return `${payload}.${b64(sign(payload))}`;
}

export function verifySession(
  token: string | undefined | null,
  now = Date.now(),
): AdminSession | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = sign(payload);
  const given = Buffer.from(mac, "base64url");
  if (given.length !== expected.length || !timingSafeEqual(given, expected))
    return null;
  try {
    const s = JSON.parse(
      Buffer.from(payload, "base64url").toString(),
    ) as AdminSession;
    return s.exp > now && s.uid && s.role ? s : null;
  } catch {
    return null;
  }
}
