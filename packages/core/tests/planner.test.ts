import { describe, expect, it } from "vitest";
import {
  DEFAULT_PROFILE,
  type HouseProfile,
  type Pet,
  RECURRING_TASKS,
  ROUTINE_TASKS,
  buildRooms,
  defaultRoomCounts,
  diffPlans,
  generatePlan,
  groupPlan,
  kindFromSlug,
  roomsFromCounts,
  slugFor,
  summarizePlan,
} from "../src/index";

const cats: Pet[] = [
  { id: "c1", name: "Gato 1", species: "cat" },
  { id: "c2", name: "Gato 2", species: "cat" },
];
const dog = (size: Pet["size"], over: Partial<Pet> = {}): Pet => ({
  id: "d1",
  name: "Thor",
  species: "dog",
  size,
  coat: "short",
  ...over,
});
const plan = (
  over: Partial<HouseProfile> = {},
  counts = defaultRoomCounts("apartment", "m"),
  pets: Pet[] = [],
) =>
  generatePlan({
    profile: { ...DEFAULT_PROFILE, ...over },
    rooms: roomsFromCounts(counts),
    pets,
  });
const ids = (p: ReturnType<typeof plan>) => p.map((t) => t.id);

describe("cômodos", () => {
  it("mantém os slugs antigos e numera os demais", () => {
    expect(slugFor("quarto", 0)).toBe("quarto1");
    expect(slugFor("quarto", 1)).toBe("quarto2");
    expect(slugFor("banheiro", 0)).toBe("banheiro");
    expect(slugFor("banheiro", 1)).toBe("banheiro_2");
    expect(slugFor("sala", 0)).toBe("sala");
    expect(kindFromSlug("quarto3")).toBe("quarto");
    expect(kindFromSlug("banheiro_2")).toBe("banheiro");
    expect(kindFromSlug("gatos")).toBeNull();
    expect(kindFromSlug("casa")).toBeNull();
  });

  it("rotula e ordena; apelido personalizado vale", () => {
    const rs = buildRooms([
      { kind: "banheiro" },
      { kind: "quarto", label: "Quarto do João" },
      { kind: "quarto" },
      { kind: "banheiro" },
    ]);
    expect(rs.map((r) => r.slug)).toEqual([
      "quarto1",
      "quarto2",
      "banheiro",
      "banheiro_2",
    ]);
    expect(rs.map((r) => r.label)).toEqual([
      "Quarto do João",
      "Quarto 2",
      "Banheiro 1",
      "Banheiro 2",
    ]);
  });
});

describe("planner — compatibilidade com o catálogo antigo", () => {
  it("casal, apartamento, gatos, modo Completo → todas as tarefas antigas continuam existindo", () => {
    const p = plan(
      { intensity: "full" },
      defaultRoomCounts("apartment", "m"),
      cats,
    );
    const legacy = [...ROUTINE_TASKS, ...RECURRING_TASKS].map((t) => t.id);
    const missing = legacy.filter((id) => !ids(p).includes(id));
    expect(missing).toEqual([]);
  });

  it("chaves simples para o 1º exemplar e @slug para os demais", () => {
    const p = plan({}, { ...defaultRoomCounts("apartment", "m"), banheiro: 2 });
    expect(ids(p)).toContain("banheiro");
    expect(ids(p)).toContain("banheiro@banheiro_2");
    const b2 = p.find((t) => t.id === "banheiro@banheiro_2");
    expect(b2?.t).toContain("Banheiro 2");
    expect(b2?.room).toBe("banheiro_2");
  });

  it("é determinístico", () => {
    expect(plan({}, defaultRoomCounts("house", "l"), [dog("giant")])).toEqual(
      plan({}, defaultRoomCounts("house", "l"), [dog("giant")]),
    );
  });
});

describe("planner — adaptação à casa", () => {
  it("sem banheiro cadastrado não há tarefas de banheiro; sem pets, nada de pets", () => {
    const p = plan({}, { ...defaultRoomCounts("apartment", "m"), banheiro: 0 });
    expect(p.some((t) => t.roomKind === "banheiro")).toBe(false);
    expect(p.some((t) => t.cat === "pets" || t.cat === "gatos")).toBe(false);
    expect(ids(p)).not.toContain("area_troca");
  });

  it("gatos ativam areia e cuidados usando as chaves antigas", () => {
    const p = plan({}, defaultRoomCounts("apartment", "m"), cats);
    for (const k of [
      "m_areia",
      "n_areia",
      "m_gatos",
      "potes_gatos",
      "area_troca",
    ]) {
      expect(ids(p)).toContain(k);
    }
  });

  it("porte do cão muda passeio, brincadeira e janela do banho", () => {
    const mini = plan({}, defaultRoomCounts("apartment", "m"), [dog("mini")]);
    const giant = plan({}, defaultRoomCounts("apartment", "m"), [dog("giant")]);
    const walk = (p: typeof mini) => p.find((t) => t.id === "dog_walk_am@d1");
    expect(walk(mini)?.mins).toBe(15);
    expect(walk(giant)?.mins).toBe(45);
    expect(ids(mini)).not.toContain("dog_play@d1");
    expect(ids(giant)).toContain("dog_play@d1");
    const bath = (p: typeof mini) => p.find((t) => t.id === "dog_bath@d1");
    expect(bath(mini)?.min).toBe(21);
    expect(bath(giant)?.min).toBe(14);
  });

  it("cocô no quintal só se houver quintal; escovar depende da pelagem", () => {
    const semQuintal = plan({}, defaultRoomCounts("apartment", "m"), [
      dog("medium"),
    ]);
    const comQuintal = plan(
      { dwelling: "house" },
      defaultRoomCounts("house", "m"),
      [dog("medium")],
    );
    expect(ids(semQuintal)).not.toContain("dog_poop@d1");
    expect(ids(comQuintal)).toContain("dog_poop@d1");
    const longo = plan({}, defaultRoomCounts("apartment", "m"), [
      dog("medium", { coat: "long" }),
    ]);
    expect(ids(longo)).toContain("dog_brush_long@d1");
    expect(ids(longo)).not.toContain("dog_brush@d1");
  });

  it("dois cães geram tarefas separadas, com o nome de cada um", () => {
    const p = plan({}, defaultRoomCounts("apartment", "m"), [
      dog("small", { id: "a", name: "Rex" }),
      dog("large", { id: "b", name: "Bob" }),
    ]);
    expect(p.find((t) => t.id === "dog_walk_am@a")?.t).toContain("Rex");
    expect(p.find((t) => t.id === "dog_walk_am@b")?.t).toContain("Bob");
  });

  it("modo solo: sem tarefa da 2ª pessoa e título neutro", () => {
    const p = plan({ mode: "solo" });
    expect(ids(p)).not.toContain("roupa_b");
    expect(p.find((t) => t.id === "roupa_a")?.t).toBe("Lavar as roupas");
    const c = plan({ mode: "couple" });
    expect(ids(c)).toContain("roupa_b");
    expect(c.find((t) => t.id === "roupa_a")?.t).toContain("{A}");
  });

  it("casa tem calçada, caixa d'água e quintal; apartamento não", () => {
    const apto = plan(
      { intensity: "full" },
      defaultRoomCounts("apartment", "m"),
    );
    const casa = plan(
      { dwelling: "house", intensity: "full" },
      defaultRoomCounts("house", "m"),
    );
    for (const k of ["calcada", "caixa_dagua", "quintal_varrer"]) {
      expect(ids(apto)).not.toContain(k);
      expect(ids(casa)).toContain(k);
    }
  });

  it("sem congelados, sem máquina e sem cozinhar", () => {
    const p = plan({ usesFrozen: false, hasWasher: false, cooksAtHome: false });
    for (const k of [
      "m_congelador",
      "n_amanha",
      "roupa_a",
      "roupa_b",
      "toalhas",
      "maquina",
      "cardapio",
      "mealprep",
    ]) {
      expect(ids(p)).not.toContain(k);
    }
    expect(ids(p)).toContain("roupa_lavanderia");
  });

  it("plantas e carro são opcionais", () => {
    expect(ids(plan())).not.toContain("plants_water");
    expect(
      ids(plan({ hasPlants: true, hasCar: true, intensity: "full" })),
    ).toEqual(expect.arrayContaining(["plants_water", "car_wash"]));
  });

  it("intensidade: Leve < Padrão < Completo, e a janela escala", () => {
    const l = plan({ intensity: "light" });
    const s = plan({ intensity: "standard" });
    const f = plan({ intensity: "full" });
    expect(l.length).toBeLessThan(s.length);
    expect(s.length).toBeLessThan(f.length);
    const win = (p: typeof s) => p.find((t) => t.id === "banheiro");
    expect(win(l)?.max).toBeGreaterThan(win(s)?.max ?? 0);
    expect(win(f)?.max).toBeLessThan(win(s)?.max ?? 99);
    // janelas curtas (lixo 1–2) nunca escalam
    expect(l.find((t) => t.id === "lixo")?.max).toBe(2);
  });

  it("tamanho da casa escala o tempo de aspirar", () => {
    const m = (size: "s" | "m" | "l") =>
      plan({ size }).find((t) => t.id === "aspirar")?.mins;
    expect(m("s")).toBe(15);
    expect(m("m")).toBe(20);
    expect(m("l")).toBe(30);
  });

  it("2º quarto tem ventilação; 1 quarto só não", () => {
    const dois = plan(
      { intensity: "full" },
      { ...defaultRoomCounts("apartment", "m"), quarto: 2 },
    );
    const um = plan(
      { intensity: "full" },
      { ...defaultRoomCounts("apartment", "m"), quarto: 1 },
    );
    expect(ids(dois)).toContain("q2_ventilar");
    expect(ids(um)).not.toContain("q2_ventilar");
  });
});

describe("planner — diff, resumo e agrupamento", () => {
  it("adotar um cão só adiciona tarefas (e nada some)", () => {
    const antes = plan({}, defaultRoomCounts("apartment", "m"));
    const depois = plan({}, defaultRoomCounts("apartment", "m"), [
      dog("large"),
    ]);
    const d = diffPlans(antes, depois);
    expect(d.removed).toEqual([]);
    expect(d.added.length).toBeGreaterThan(5);
    expect(d.added.every((t) => t.petId === "d1")).toBe(true);
  });

  it("resumo cresce com a intensidade e agrupa por cômodo/pet", () => {
    const l = summarizePlan(plan({ intensity: "light" }));
    const f = summarizePlan(
      plan({ intensity: "full" }, defaultRoomCounts("apartment", "m"), [
        dog("large"),
      ]),
    );
    expect(f.minutesPerDay).toBeGreaterThan(l.minutesPerDay);
    const g = groupPlan(
      plan({}, defaultRoomCounts("apartment", "m"), [dog("large")]),
    );
    expect(g.some((x) => x.key === "pet:d1")).toBe(true);
    expect(g.some((x) => x.key === "casa")).toBe(true);
  });
});
