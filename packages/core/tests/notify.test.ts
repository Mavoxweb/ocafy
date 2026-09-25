import { describe, expect, it } from "vitest";
import {
  DEFAULT_PREFS,
  type DaySchedule,
  type NotifPrefs,
  type NotifyInput,
  canSendEventNow,
  isHomeAt,
  localParts,
  planNotifications,
  presenceOn,
} from "../src/index";

const TZ = "America/Sao_Paulo"; // UTC-3, sem horário de verão desde 2019
/** Quinta-feira 24/09/2026 no horário de Brasília. */
const at = (hhmm: string, day = 24) => {
  const [h, m] = hhmm.split(":").map(Number);
  return new Date(Date.UTC(2026, 8, day, h + 3, m));
};

const prefs = (over: Partial<NotifPrefs> = {}): NotifPrefs => ({
  ...DEFAULT_PREFS,
  enabled: true,
  ...over,
});

const base = (over: Partial<NotifyInput> = {}): NotifyInput => ({
  now: at("07:30"),
  tz: TZ,
  prefs: prefs(),
  schedule: [],
  absences: [],
  morningPending: 3,
  nightPending: 4,
  dueCount: 0,
  lateCount: 0,
  defrost: [],
  shoppingOpen: 0,
  shoppingUrgent: 0,
  isShoppingDay: false,
  ...over,
});

const kinds = (i: NotifyInput) => planNotifications(i).map((n) => n.kind);

describe("fuso e presença", () => {
  it("converte para o horário da casa", () => {
    expect(localParts(at("07:30"), TZ)).toEqual({
      dateKey: "2026-09-24",
      weekday: 4,
      minutes: 450,
    });
    // 01:00 em Brasília ainda é dia 24 (04:00 UTC)
    expect(localParts(at("01:00"), TZ).dateKey).toBe("2026-09-24");
    expect(localParts(new Date("2026-09-24T02:00:00Z"), TZ).dateKey).toBe(
      "2026-09-23",
    );
  });

  it("dia parcial: em casa antes de sair e depois de voltar", () => {
    const p = presenceOn(
      localParts(at("12:00"), TZ),
      [{ weekday: 4, mode: "partial", leave: "08:00", back: "18:00" }],
      [],
    );
    expect(isHomeAt(p, 7 * 60)).toBe(true);
    expect(isHomeAt(p, 12 * 60)).toBe(false);
    expect(isHomeAt(p, 19 * 60)).toBe(true);
  });

  it("ausência cobre o intervalo inteiro, inclusive as pontas", () => {
    const a = [{ from: "2026-09-23", until: "2026-09-25" }];
    expect(presenceOn(localParts(at("10:00"), TZ), [], a).absent).toBe(true);
    expect(presenceOn(localParts(at("10:00", 26), TZ), [], a).absent).toBe(
      false,
    );
  });
});

describe("lembretes", () => {
  it("desligado não envia nada", () => {
    expect(
      kinds(base({ prefs: prefs({ enabled: false }), lateCount: 3 })),
    ).toEqual([]);
  });

  it("manhã: 15 min antes de sair; só se ainda há itens pendentes", () => {
    const sch: DaySchedule[] = [
      { weekday: 4, mode: "partial", leave: "08:00", back: "18:00" },
    ];
    const n = planNotifications(base({ now: at("07:45"), schedule: sch }));
    expect(n).toHaveLength(1);
    expect(n[0]).toMatchObject({
      kind: "morning",
      dedupeKey: "morning:2026-09-24",
      title: "Faltam 15 min para você sair",
    });
    expect(kinds(base({ now: at("07:30"), schedule: sch }))).toEqual([]); // cedo demais
    expect(
      kinds(base({ now: at("07:45"), schedule: sch, morningPending: 0 })),
    ).toEqual([]);
    // depois da janela de tolerância, perdeu
    expect(kinds(base({ now: at("09:00"), schedule: sch }))).not.toContain(
      "morning",
    );
  });

  it("sem agenda: aviso da manhã às 07:30", () => {
    expect(kinds(base({ now: at("07:40") }))).toEqual(["morning"]);
    expect(kinds(base({ now: at("07:29") }))).toEqual([]);
  });

  it("fora o dia todo ou em ausência: nenhum aviso de rotina", () => {
    const away: DaySchedule[] = [
      { weekday: 4, mode: "away", leave: null, back: null },
    ];
    expect(
      kinds(base({ now: at("07:40"), schedule: away, lateCount: 2 })),
    ).toEqual([]);
    expect(
      kinds(
        base({
          now: at("07:40"),
          absences: [{ from: "2026-09-24", until: "2026-09-30" }],
        }),
      ),
    ).toEqual([]);
  });

  it("silêncio adia o aviso para o fim do silêncio", () => {
    // antes das 07:00 em silêncio; alvo 06:30 → sai às 07:00
    const sch: DaySchedule[] = [
      { weekday: 4, mode: "partial", leave: "06:45", back: "18:00" },
    ];
    expect(kinds(base({ now: at("06:35"), schedule: sch }))).toEqual([]);
    // o alvo (06:30) cai no silêncio → vai para 07:00, mas 07:00 já é depois de sair (06:45)
    expect(kinds(base({ now: at("07:05"), schedule: sch }))).toEqual([]);
    // sem sair: aviso 07:30 mantém
    expect(kinds(base({ now: at("07:35") }))).toEqual(["morning"]);
  });

  it("noite: 20:30, ou 1h depois de voltar", () => {
    expect(kinds(base({ now: at("20:40"), morningPending: 0 }))).toEqual([
      "night",
    ]);
    const sch: DaySchedule[] = [
      { weekday: 4, mode: "partial", leave: "07:00", back: "21:00" },
    ];
    expect(
      kinds(base({ now: at("20:40"), schedule: sch, morningPending: 0 })),
    ).toEqual([]);
    expect(
      kinds(base({ now: at("22:05"), schedule: sch, morningPending: 0 })),
    ).toEqual([]); // 22:00 é silêncio → adiado até 07:00
  });

  it("resumo do dia: às 09:00; com saída, vai para a volta", () => {
    expect(
      kinds(
        base({
          now: at("09:10"),
          morningPending: 0,
          dueCount: 2,
          lateCount: 1,
        }),
      ),
    ).toEqual(["due"]);
    const sch: DaySchedule[] = [
      { weekday: 4, mode: "partial", leave: "08:00", back: "18:00" },
    ];
    const opts = {
      morningPending: 0,
      dueCount: 2,
      lateCount: 1,
      schedule: sch,
    };
    expect(kinds(base({ now: at("09:10"), ...opts }))).toEqual([]);
    expect(kinds(base({ now: at("18:10"), ...opts }))).toEqual(["due"]);
  });

  it("descongelar: no horário exato e só para quem está em casa", () => {
    const meal = {
      id: "m1",
      label: "Frango — Jantar",
      dateKey: "2026-09-24",
      minute: 17 * 60 + 30,
    };
    const n = planNotifications(
      base({
        now: at("17:35"),
        morningPending: 0,
        nightPending: 0,
        defrost: [meal],
      }),
    );
    expect(n.map((x) => x.dedupeKey)).toEqual(["defrost:m1"]);
    const away: DaySchedule[] = [
      { weekday: 4, mode: "partial", leave: "08:00", back: "19:00" },
    ];
    expect(
      kinds(
        base({
          now: at("17:35"),
          morningPending: 0,
          nightPending: 0,
          defrost: [meal],
          schedule: away,
        }),
      ),
    ).toEqual([]);
    // outro dia não dispara
    expect(
      kinds(
        base({
          now: at("17:35"),
          morningPending: 0,
          nightPending: 0,
          defrost: [{ ...meal, dateKey: "2026-09-25" }],
        }),
      ),
    ).toEqual([]);
  });

  it("dia de compras com itens na lista", () => {
    const i = base({
      now: at("10:05"),
      morningPending: 0,
      shoppingOpen: 5,
      shoppingUrgent: 2,
      isShoppingDay: true,
    });
    const n = planNotifications(i);
    expect(n[0]).toMatchObject({ kind: "shopping_day", url: "/compras" });
    expect(n[0].body).toContain("2 urgentes");
    expect(kinds({ ...i, shoppingOpen: 0 })).toEqual([]);
    expect(kinds({ ...i, prefs: prefs({ shopping: false }) })).toEqual([]);
  });

  it("preferências desligam cada tipo", () => {
    expect(kinds(base({ prefs: prefs({ morning: false }) }))).toEqual([]);
  });

  it("avisos por evento respeitam preferência e silêncio", () => {
    expect(canSendEventNow(prefs(), "trade", at("15:00"), TZ)).toBe(true);
    expect(canSendEventNow(prefs(), "trade", at("23:30"), TZ)).toBe(false);
    expect(
      canSendEventNow(prefs({ partner: false }), "trade", at("15:00"), TZ),
    ).toBe(false);
    expect(
      canSendEventNow(
        prefs({ shopping: false }),
        "shopping_urgent",
        at("15:00"),
        TZ,
      ),
    ).toBe(false);
    expect(
      canSendEventNow(prefs({ enabled: false }), "purchase", at("15:00"), TZ),
    ).toBe(false);
  });
});

describe("descongelar no fuso da casa", () => {
  it("retirada no mesmo dia e no dia anterior", async () => {
    const { defrostPullLocal } = await import("../src/index");
    // jantar 19:30 com 8 h → 11:30 do mesmo dia
    expect(defrostPullLocal("2026-09-24", "jantar", 8)).toEqual({
      dateKey: "2026-09-24",
      minute: 11 * 60 + 30,
    });
    // almoço 12:00 com 24 h → meio-dia da véspera
    expect(defrostPullLocal("2026-09-24", "almoco", 24)).toEqual({
      dateKey: "2026-09-23",
      minute: 12 * 60,
    });
    // almoço com 14 h → 22:00 da véspera
    expect(defrostPullLocal("2026-10-01", "almoco", 14)).toEqual({
      dateKey: "2026-09-30",
      minute: 22 * 60,
    });
  });
});
