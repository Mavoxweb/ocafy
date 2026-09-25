import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Cofre de segredos (AES-256-GCM) para guardar o segredo TOTP no banco.
 * Chave: ADMIN_SECRET_KEY = 32 bytes em hexadecimal (64 caracteres) ou base64.
 */

function key(): Buffer {
  const raw = process.env.ADMIN_SECRET_KEY ?? "";
  const k = /^[0-9a-f]{64}$/i.test(raw)
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (k.length !== 32) {
    throw new Error(
      "ADMIN_SECRET_KEY deve ter 32 bytes (hex de 64 caracteres ou base64).",
    );
  }
  return k;
}

export function seal(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${enc.toString("base64")}`;
}

export function open(sealed: string): string {
  const [v, iv, tag, enc] = sealed.split(":");
  if (v !== "v1" || !iv || !tag || !enc)
    throw new Error("Segredo em formato desconhecido.");
  const d = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  d.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([
    d.update(Buffer.from(enc, "base64")),
    d.final(),
  ]).toString("utf8");
}
