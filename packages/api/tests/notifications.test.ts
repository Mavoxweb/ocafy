import { randomUUID } from "node:crypto";
import { DEFAULT_PROFILE } from "@ocafy/core";
import { db, households } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { inArray } from "drizzle-orm";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  appRouter,
  createCallerFactory,
  runNotificationTick,
} from "../src/index";
import * as push from "../src/push";

/**
 * O envio real (Web Push) é substituído por um espião: o que se testa aqui é QUEM recebe QUANDO,
 * com o banco Neon de desenvolvimento. Só roda com DATABASE_URL e branch que não seja produção.
 */
vi.mock("../src/push", async (orig) => {
  const real = await orig<typeof import("../src/push")>();
  return {
    ...real,
    pushConfigured: () => true,
    vapidPublicKey: () => "BTESTKEY",
    sendPush: vi.fn(async () => ({ ok: true as const })),
  };
});

const enabled =
  !!process.env.DATABASE_URL &&
  !!process.env.NEON_BRANCH &&
  process.env.NEON_BRANCH !== "production";

const caller = createCallerFactory(appRouter);
const as = (userId: string) => caller({ userId });
const created: string[] = [];
const send = vi.mocked(push.sendPush);

const FCM = "https://fcm.googleapis.com/fcm/send/";
const sub = (n: string) => ({
  endpoint: `${FCM}${n}-${randomUUID()}`,
  p256dh:
    "BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM",
  auth: "tBHItJI5svbpez7KI4CCXg",
});

const code = async (fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (e) {
    if (e instanceof TRPCError) return e.code;
    throw e;
  }
  return "OK";
};

async function newHouse(name: string) {
  const userId = `test-${randomUUID()}`;
  const c = as(userId);
  const { householdId } = await c.household.create({
    houseName: name,
    memberName: "Alex",
    profile: { ...DEFAULT_PROFILE, mode: "couple" },
    rooms: [{ kind: "cozinha" }, { kind: "quarto" }],
    pets: [],
  });
  created.push(householdId);
  return { userId, c, householdId };
}

/** 24/09/2026 (quinta) no horário de Brasília. */
const brt = (hhmm: string, day = 24) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 8, day, h + 3, m));
};

beforeEach(() => send.mockClear());
afterAll(async () => {
  if (enabled && created.length) {
    await db.delete(households).where(inArray(households.id, created));
  }
});

describe.skipIf(!enabled)("avisos e agenda (Neon dev)", () => {
  it("preferências, aparelhos e agenda aparecem no snapshot", async () => {
    const { c } = await newHouse("Casa Avisos");
    await c.notifications.setPrefs({
      enabled: true,
      night: false,
      quietStart: "23:00",
    });
    await c.notifications.subscribe(sub("a"));
    await c.agenda.setDay({
      weekday: 4,
      mode: "partial",
      leave: "08:00",
      back: "18:30",
    });
    await c.agenda.setDay({ weekday: 6, mode: "away" });
    await c.agenda.addAbsence({
      from: "2026-10-01",
      until: "2026-10-05",
      note: "Viagem",
    });

    const snap = await c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    const n = snap.data.notifications;
    expect(n.pushConfigured).toBe(true);
    expect(n.devices).toBe(1);
    expect(n.prefs).toMatchObject({
      enabled: true,
      night: false,
      morning: true,
      quietStart: "23:00",
    });
    expect(n.schedule).toEqual(
      expect.arrayContaining([
        { weekday: 4, mode: "partial", leave: "08:00", back: "18:30" },
        { weekday: 6, mode: "away", leave: null, back: null },
      ]),
    );
    expect(n.absences[0]).toMatchObject({
      from: "2026-10-01",
      until: "2026-10-05",
      note: "Viagem",
    });

    // voltar a "em casa" limpa os horários
    await c.agenda.setDay({ weekday: 4, mode: "home" });
    const again = await c.household.snapshot();
    if (again.status !== "ready") throw new Error();
    expect(
      again.data.notifications.schedule.find((d) => d.weekday === 4),
    ).toEqual({
      weekday: 4,
      mode: "home",
      leave: null,
      back: null,
    });
  });

  it("valida agenda, ausências e endpoints de push (só serviços conhecidos)", async () => {
    const { c } = await newHouse("Casa Validação");
    expect(
      await code(() => c.agenda.setDay({ weekday: 1, mode: "partial" })),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() =>
        c.agenda.setDay({
          weekday: 1,
          mode: "partial",
          leave: "18:00",
          back: "08:00",
        }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() => c.agenda.setDay({ weekday: 9, mode: "home" })),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() =>
        c.agenda.addAbsence({ from: "2026-10-05", until: "2026-10-01" }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await code(() => c.notifications.setPrefs({ quietStart: "25:00" })),
    ).toBe("BAD_REQUEST");

    // SSRF: o servidor nunca deve chamar endereços arbitrários
    for (const endpoint of [
      "http://fcm.googleapis.com/x",
      "https://evil.example.com/push",
      "https://169.254.169.254/latest/meta-data",
      "https://fcm.googleapis.com.evil.com/x",
      "not a url",
    ]) {
      expect(
        await code(() => c.notifications.subscribe({ ...sub("x"), endpoint })),
      ).toBe("BAD_REQUEST");
    }
    expect(await code(() => c.notifications.subscribe(sub("ok")))).toBe("OK");
  });

  it("no máximo 5 aparelhos por pessoa e remoção só do próprio", async () => {
    const a = await newHouse("Casa Aparelhos");
    for (let i = 0; i < 7; i++) await a.c.notifications.subscribe(sub(`d${i}`));
    let snap = await a.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.notifications.devices).toBe(5);

    const b = await newHouse("Casa Outra Aparelhos");
    const mine = sub("mine");
    await a.c.notifications.subscribe(mine);
    await b.c.notifications.unsubscribe({ endpoint: mine.endpoint }); // não é dele
    snap = await a.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.notifications.devices).toBe(5);
    await a.c.notifications.unsubscribe({ endpoint: mine.endpoint });
    snap = await a.c.household.snapshot();
    if (snap.status !== "ready") throw new Error();
    expect(snap.data.notifications.devices).toBe(4);
  });

  it("agendador: manda na hora certa, uma vez só, e respeita ausência", async () => {
    const { c } = await newHouse("Casa Agendador");
    const tick = sub("tick");
    await c.notifications.setPrefs({ enabled: true });
    await c.notifications.subscribe(tick);
    // o agendador é global: só interessa o que chegou neste aparelho
    const got = (title?: string) =>
      send.mock.calls.filter(
        ([t, p]) =>
          t.endpoint === tick.endpoint && (!title || p.title.includes(title)),
      );

    // cedo demais: nada
    await runNotificationTick(brt("06:00"));
    expect(got()).toHaveLength(0);

    // 07:40 (sem agenda → aviso das 07:30): sai uma vez
    await runNotificationTick(brt("07:40"));
    expect(got("Rotina da manhã")).toHaveLength(1);
    expect(got("Rotina da manhã")[0][1].url).toBe("/");

    // rodar de novo no mesmo dia não repete
    send.mockClear();
    await runNotificationTick(brt("07:50"));
    expect(got("Rotina da manhã")).toHaveLength(0);

    // dias seguintes em ausência: nada de rotina
    send.mockClear();
    await c.agenda.addAbsence({ from: "2026-09-25", until: "2026-09-27" });
    await runNotificationTick(brt("07:40", 25));
    expect(got()).toHaveLength(0);
    // depois da ausência volta a avisar
    await runNotificationTick(brt("07:40", 28));
    expect(got("Rotina da manhã")).toHaveLength(1);
  });

  it("agendador: sair de casa antecipa o aviso; quem não ligou os avisos não recebe", async () => {
    const early = await newHouse("Casa Liga");
    const earlySub = sub("early");
    await early.c.notifications.setPrefs({
      enabled: true,
      remindBeforeMin: 20,
    });
    await early.c.notifications.subscribe(earlySub);
    await early.c.agenda.setDay({
      weekday: 4,
      mode: "partial",
      leave: "06:30",
      back: "19:00",
    });

    const later = await newHouse("Casa Cedo");
    const laterSub = sub("later");
    await later.c.notifications.setPrefs({
      enabled: true,
      remindBeforeMin: 15,
    });
    await later.c.notifications.subscribe(laterSub);
    await later.c.agenda.setDay({
      weekday: 4,
      mode: "partial",
      leave: "08:00",
      back: "18:00",
    });

    const off = await newHouse("Casa Desligada");
    const offSub = sub("off");
    await off.c.notifications.subscribe(offSub);

    const got = (s: { endpoint: string }, title?: string) =>
      send.mock.calls.filter(
        ([t, p]) =>
          t.endpoint === s.endpoint && (!title || p.title.includes(title)),
      );

    // 06:15: quem sai às 06:30 tinha o alvo 06:10, dentro do silêncio (adia para 07:00, já saiu)
    await runNotificationTick(brt("06:15"));
    expect(got(earlySub)).toHaveLength(0);

    // 07:50: 15 min antes das 08:00
    await runNotificationTick(brt("07:50"));
    expect(got(laterSub, "Faltam 15 min")).toHaveLength(1);
    expect(got(earlySub)).toHaveLength(0);

    // opt-in: sem ligar, nada — mesmo com aparelho registrado
    await runNotificationTick(brt("07:40"));
    expect(got(offSub)).toHaveLength(0);
  });

  it("avisos por evento: pedido de troca vai só para quem foi pedido", async () => {
    const owner = await newHouse("Casa Eventos");
    const { code: inviteCode } = await owner.c.household.createInvite();
    const partnerId = `test-${randomUUID()}`;
    const partner = as(partnerId);
    await partner.household.join({ code: inviteCode, memberName: "Bia" });

    const ownerSub = sub("owner");
    const partnerSub = sub("partner");
    await owner.c.notifications.setPrefs({ enabled: true });
    await owner.c.notifications.subscribe(ownerSub);
    await partner.notifications.setPrefs({ enabled: true });
    await partner.notifications.subscribe(partnerSub);

    // o teste roda a qualquer hora: garante que não cai no silêncio padrão
    await owner.c.notifications.setPrefs({
      quietStart: "00:00",
      quietEnd: "00:00",
    });
    await partner.notifications.setPrefs({
      quietStart: "00:00",
      quietEnd: "00:00",
    });

    await owner.c.social.requestTrade({ taskKey: "aspirar" });
    const to = send.mock.calls.map(([t]) => t.endpoint);
    expect(to).toContain(partnerSub.endpoint);
    expect(to).not.toContain(ownerSub.endpoint);
    expect(send.mock.calls[0][1].title).toContain("Alex pediu sua ajuda");

    // item urgente avisa a outra pessoa; item comum não
    send.mockClear();
    await owner.c.shopping.add({ name: "Leite", urgency: "soon" });
    expect(send).not.toHaveBeenCalled();
    await owner.c.shopping.add({ name: "Café", urgency: "now" });
    expect(send.mock.calls.map(([t]) => t.endpoint)).toEqual([
      partnerSub.endpoint,
    ]);

    // preferência desligada: não recebe
    send.mockClear();
    await partner.notifications.setPrefs({ shopping: false });
    await owner.c.shopping.add({ name: "Açúcar", urgency: "now" });
    expect(send).not.toHaveBeenCalled();
  });

  it("teste de aviso: exige aparelho e conta o que foi enviado", async () => {
    const { c } = await newHouse("Casa Teste Aviso");
    expect(await code(() => c.notifications.sendTest())).toBe(
      "PRECONDITION_FAILED",
    );
    await c.notifications.subscribe(sub("t1"));
    await c.notifications.subscribe(sub("t2"));
    expect(await c.notifications.sendTest()).toEqual({ sent: 2, total: 2 });
  });
});
