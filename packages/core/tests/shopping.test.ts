import { describe, expect, it } from "vitest";
import {
  guessCategory,
  inferCadence,
  nextShopDate,
  sortShopping,
} from "../src/index";

const day = (n: number) => new Date(Date.UTC(2026, 8, n, 12)).toISOString();

describe("lista de compras", () => {
  it("adivinha a categoria pelo nome", () => {
    expect(guessCategory("Tomate")).toBe("Hortifruti");
    expect(guessCategory("filé de frango")).toBe("Açougue e peixaria");
    expect(guessCategory("Leite integral")).toBe("Laticínios e frios");
    expect(guessCategory("Papel higiênico")).toBe("Higiene");
    expect(guessCategory("Areia para gato")).toBe("Pets");
    expect(guessCategory("coisa qualquer")).toBe("Outros");
  });

  it("ordena por urgência e, dentro dela, pelos mais antigos", () => {
    const list = sortShopping([
      { id: "a", urgency: "later", createdAt: "2026-09-01" },
      { id: "b", urgency: "now", createdAt: "2026-09-03" },
      { id: "c", urgency: "soon", createdAt: "2026-09-02" },
      { id: "d", urgency: "now", createdAt: "2026-09-02" },
    ]);
    expect(list.map((x) => x.id)).toEqual(["d", "b", "c", "a"]);
  });

  it("infere a cadência pelo intervalo médio entre idas (mínimo 3)", () => {
    expect(inferCadence([day(1), day(8)])).toEqual({
      cadence: null,
      avgDays: null,
    });
    expect(inferCadence([day(1), day(8), day(15)]).cadence).toBe("weekly");
    expect(inferCadence([day(1), day(15), day(29)]).cadence).toBe("biweekly");
    expect(
      inferCadence([
        new Date(Date.UTC(2026, 5, 1)).toISOString(),
        new Date(Date.UTC(2026, 6, 2)).toISOString(),
        new Date(Date.UTC(2026, 7, 2)).toISOString(),
      ]).cadence,
    ).toBe("monthly");
  });

  it("sugere a próxima ida pela cadência e pelo dia preferido", () => {
    const now = new Date(day(10));
    expect(nextShopDate(null, null, null, now)).toBeNull();
    const weekly = nextShopDate(day(3), "weekly", null, now);
    expect(weekly?.toISOString().slice(0, 10)).toBe("2026-09-10");
    // dia preferido: sábado (6) depois de 10/09 (quinta) → 12/09
    const sat = nextShopDate(day(3), "weekly", 6, now);
    expect(sat?.getDay()).toBe(6);
    expect(sat?.toISOString().slice(0, 10)).toBe("2026-09-12");
    // sem última ida, conta a partir de agora
    expect(
      nextShopDate(null, "biweekly", null, now)?.toISOString().slice(0, 10),
    ).toBe("2026-09-24");
  });
});
