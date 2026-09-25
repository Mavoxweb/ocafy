import { describe, expect, it } from "vitest";
import { can } from "../src/admin/permissions";
import { open, seal } from "../src/admin/secretbox";
import { signSession, verifySession } from "../src/admin/session";
import {
  base32Decode,
  base32Encode,
  generateTotpSecret,
  hotp,
  otpauthUri,
  totp,
  verifyTotp,
} from "../src/admin/totp";

// Segredo de teste do RFC 6238 (ASCII "12345678901234567890").
const RFC = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP (RFC 6238)", () => {
  it("bate com os vetores do RFC (SHA-1, 8 dígitos)", () => {
    expect(totp(RFC, 59_000, 8)).toBe("94287082");
    expect(totp(RFC, 1_111_111_109_000, 8)).toBe("07081804");
    expect(totp(RFC, 1_234_567_890_000, 8)).toBe("89005924");
    expect(totp(RFC, 2_000_000_000_000, 8)).toBe("69279037");
    expect(hotp(RFC, 0)).toBe("755224"); // vetor HOTP do RFC 4226
  });

  it("base32 ida e volta", () => {
    const s = generateTotpSecret();
    expect(s).toMatch(/^[A-Z2-7]{32}$/);
    expect(base32Encode(base32Decode(s))).toBe(s);
  });

  it("aceita ±1 intervalo, recusa o resto e devolve o passo (anti-replay)", () => {
    const now = 1_700_000_000_000;
    const code = totp(RFC, now);
    const ok = verifyTotp(RFC, code, now);
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.step).toBe(Math.floor(now / 30000));
    expect(verifyTotp(RFC, totp(RFC, now - 30_000), now).ok).toBe(true);
    expect(verifyTotp(RFC, totp(RFC, now + 30_000), now).ok).toBe(true);
    expect(verifyTotp(RFC, totp(RFC, now - 90_000), now).ok).toBe(false);
    expect(verifyTotp(RFC, "123", now).ok).toBe(false);
    expect(verifyTotp(RFC, "abcdef", now).ok).toBe(false);
    expect(
      verifyTotp(RFC, `${code.slice(0, 3)} ${code.slice(3)}`, now).ok,
    ).toBe(true);
  });

  it("gera o endereço para o app autenticador", () => {
    const u = otpauthUri("ABC234", "ana@example.com");
    expect(u).toContain("otpauth://totp/Ocafy%20Admin%3Aana%40example.com");
    expect(u).toContain("secret=ABC234");
  });
});

describe("cofre de segredos", () => {
  it("cifra e decifra; cada cifra é diferente; adulterar quebra", () => {
    process.env.ADMIN_SECRET_KEY = "a".repeat(64);
    const a = seal("JBSWY3DPEHPK3PXP");
    const b = seal("JBSWY3DPEHPK3PXP");
    expect(a).not.toBe(b);
    expect(open(a)).toBe("JBSWY3DPEHPK3PXP");
    expect(() => open(`${a.slice(0, -4)}AAAA`)).toThrow();
  });

  it("recusa chave inválida", () => {
    process.env.ADMIN_SECRET_KEY = "curta";
    expect(() => seal("x")).toThrow(/32 bytes/);
    process.env.ADMIN_SECRET_KEY = "a".repeat(64);
  });
});

describe("sessão assinada", () => {
  const base = { uid: "u1", email: "a@b.com", role: "admin" as const };

  it("assina, valida e expira", () => {
    process.env.ADMIN_SESSION_SECRET = "s".repeat(40);
    const now = 1_700_000_000_000;
    const t = signSession(base, now, 1000);
    expect(verifySession(t, now + 500)).toMatchObject(base);
    expect(verifySession(t, now + 2000)).toBeNull();
  });

  it("recusa adulteração, formato errado e assinatura de outro segredo", () => {
    process.env.ADMIN_SESSION_SECRET = "s".repeat(40);
    const t = signSession(base);
    const [p, m] = t.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...base, role: "owner", exp: Date.now() + 1e9 }),
    ).toString("base64url");
    expect(verifySession(`${forged}.${m}`)).toBeNull();
    expect(verifySession(`${p}.xxxx`)).toBeNull();
    expect(verifySession("lixo")).toBeNull();
    expect(verifySession(null)).toBeNull();
    process.env.ADMIN_SESSION_SECRET = "z".repeat(40);
    expect(verifySession(t)).toBeNull();
    process.env.ADMIN_SESSION_SECRET = "s".repeat(40);
  });
});

describe("permissões por papel", () => {
  it("cada papel só faz o que deve", () => {
    expect(can("owner", "staff.manage")).toBe(true);
    expect(can("admin", "staff.manage")).toBe(false);
    expect(can("admin", "lgpd.delete")).toBe(true);
    expect(can("support", "lgpd.handle")).toBe(true);
    expect(can("support", "lgpd.delete")).toBe(false);
    expect(can("support", "household.suspend")).toBe(false);
    expect(can("finance", "plan.write")).toBe(true);
    expect(can("finance", "flags.write")).toBe(false);
    expect(can("viewer", "read")).toBe(true);
    expect(can("viewer", "notes")).toBe(false);
  });
});
