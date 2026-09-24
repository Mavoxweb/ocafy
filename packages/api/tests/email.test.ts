import { afterEach, describe, expect, it, vi } from "vitest";
import { emailConfigured, inviteEmail, sendEmail } from "../src/index";

const OLD = { ...process.env };
afterEach(() => {
  process.env = { ...OLD };
  vi.unstubAllGlobals();
});

describe("e-mail (Resend)", () => {
  it("sem RESEND_API_KEY não envia e não falha", async () => {
    Reflect.deleteProperty(process.env, "RESEND_API_KEY");
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    expect(emailConfigured()).toBe(false);
    const r = await sendEmail({
      to: "a@b.com",
      subject: "x",
      html: "<p>x</p>",
    });
    expect(r).toEqual({ sent: false, reason: "not_configured" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("com chave, chama a API do Resend no formato esperado", async () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.EMAIL_FROM = "Ocafy <ola@ocafy.com.br>";
    const fetchSpy = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "abc123" }), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchSpy);
    const r = await sendEmail({
      to: "a@b.com",
      subject: "Oi",
      html: "<p>oi</p>",
      tag: "invite",
    });
    expect(r).toEqual({ sent: true, id: "abc123" });
    const [url, init] = fetchSpy.mock.calls[0];
    expect(url).toBe("https://api.resend.com/emails");
    expect(init.headers.authorization).toBe("Bearer re_test");
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: "Ocafy <ola@ocafy.com.br>",
      to: ["a@b.com"],
      subject: "Oi",
      tags: [{ name: "type", value: "invite" }],
    });
  });

  it("erro do provedor vira resultado (não exceção)", async () => {
    process.env.RESEND_API_KEY = "re_test";
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          new Response("domain not verified", { status: 403 }),
        ),
    );
    const r = await sendEmail({ to: "a@b.com", subject: "x", html: "x" });
    expect(r.sent).toBe(false);
    if (!r.sent) expect(r.detail).toContain("403");
  });

  it("modelo de convite escapa HTML de nomes", () => {
    const m = inviteEmail({
      inviterName: "<script>alert(1)</script>",
      houseName: "Casa & Cia",
      url: "https://ocafy.vercel.app/entrar?convite=ABCD2345",
      code: "ABCD2345",
    });
    expect(m.html).not.toContain("<script>");
    expect(m.html).toContain("Casa &amp; Cia");
    expect(m.html).toContain("ABCD2345");
  });
});
