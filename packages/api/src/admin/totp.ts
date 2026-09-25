import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/** TOTP (RFC 6238, HMAC-SHA1, 6 dígitos, 30 s): o segundo fator do painel admin. */

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += B32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += B32[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | B32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const generateTotpSecret = (): string => base32Encode(randomBytes(20));

export const STEP_SECONDS = 30;

/** Contador do intervalo de 30 s que contém `nowMs`. */
export const stepOf = (nowMs: number): number =>
  Math.floor(nowMs / 1000 / STEP_SECONDS);

export function hotp(secret: string, counter: number, digits = 6): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(buf).digest();
  const off = (h[h.length - 1] as number) & 0xf;
  const bin =
    (((h[off] as number) & 0x7f) << 24) |
    (((h[off + 1] as number) & 0xff) << 16) |
    (((h[off + 2] as number) & 0xff) << 8) |
    ((h[off + 3] as number) & 0xff);
  return String(bin % 10 ** digits).padStart(digits, "0");
}

export const totp = (secret: string, nowMs = Date.now(), digits = 6): string =>
  hotp(secret, stepOf(nowMs), digits);

/**
 * Confere o código aceitando ±`window` intervalos (relógios levemente diferentes).
 * Devolve o intervalo usado, para o chamador impedir reuso do mesmo código (replay).
 */
export function verifyTotp(
  secret: string,
  code: string,
  nowMs = Date.now(),
  window = 1,
): { ok: true; step: number } | { ok: false } {
  const given = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(given)) return { ok: false };
  const current = stepOf(nowMs);
  for (let d = -window; d <= window; d++) {
    const expected = hotp(secret, current + d);
    const a = Buffer.from(expected);
    const b = Buffer.from(given);
    if (a.length === b.length && timingSafeEqual(a, b))
      return { ok: true, step: current + d };
  }
  return { ok: false };
}

/** Endereço que o app autenticador (Google Authenticator, Authy…) lê pelo QR code. */
export const otpauthUri = (
  secret: string,
  account: string,
  issuer = "Ocafy Admin",
): string =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
