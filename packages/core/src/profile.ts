/**
 * Perfil da casa: quem mora, onde, com quais cômodos e pets. É a ENTRADA do motor de
 * rotinas (planner.ts): o mesmo perfil sempre gera o mesmo plano de tarefas.
 */

export type HouseMode = "solo" | "couple" | "family";
export type Dwelling = "apartment" | "house" | "townhouse" | "studio";
export type HouseSize = "s" | "m" | "l";
export type Intensity = "light" | "standard" | "full";

export interface HouseProfile {
  mode: HouseMode;
  dwelling: Dwelling;
  size: HouseSize;
  /** Leve = só o essencial; Padrão = essencial + manutenção; Completo = tudo, com janelas mais curtas. */
  intensity: Intensity;
  cooksAtHome: boolean;
  usesFrozen: boolean;
  hasWasher: boolean;
  hasPlants: boolean;
  hasCar: boolean;
  /** Projeto pessoal "Escritório" (trilha de 9 semanas) ativo para esta casa. */
  officeProject: boolean;
}

export const DEFAULT_PROFILE: HouseProfile = {
  mode: "couple",
  dwelling: "apartment",
  size: "m",
  intensity: "standard",
  cooksAtHome: true,
  usesFrozen: true,
  hasWasher: true,
  hasPlants: false,
  hasCar: false,
  officeProject: false,
};

export const MODE_LABELS: Record<HouseMode, string> = {
  solo: "Moro sozinho(a)",
  couple: "Casal",
  family: "Família",
};

export const DWELLING_LABELS: Record<Dwelling, string> = {
  apartment: "Apartamento",
  house: "Casa",
  townhouse: "Sobrado",
  studio: "Kitnet / Studio",
};

export const SIZE_LABELS: Record<HouseSize, string> = {
  s: "Pequena",
  m: "Média",
  l: "Grande",
};

export const INTENSITY_LABELS: Record<
  Intensity,
  { name: string; hint: string }
> = {
  light: {
    name: "Leve",
    hint: "Só o essencial, com janelas mais folgadas",
  },
  standard: {
    name: "Padrão",
    hint: "Essencial + manutenção da casa",
  },
  full: {
    name: "Completo",
    hint: "Tudo, com janelas mais curtas",
  },
};

/* ================= pessoas da casa ================= */

/** Faixas etárias dos perfis de criança (sem login; controlados por um responsável). */
export type AgeBand = "child_4_6" | "child_7_9" | "child_10_12" | "teen_13_17";

export const AGE_BAND_ORDER: AgeBand[] = [
  "child_4_6",
  "child_7_9",
  "child_10_12",
  "teen_13_17",
];

export const AGE_BANDS: Record<AgeBand, { label: string; hint: string }> = {
  child_4_6: { label: "4 a 6 anos", hint: "Tarefas simples, sempre com ajuda" },
  child_7_9: { label: "7 a 9 anos", hint: "Já cuida de tarefas pequenas" },
  child_10_12: { label: "10 a 12 anos", hint: "Rotinas com mais autonomia" },
  teen_13_17: { label: "13 a 17 anos", hint: "Quase tudo, com combinado" },
};

export const isAgeBand = (v: string): v is AgeBand =>
  (AGE_BAND_ORDER as string[]).includes(v);

/** `band` já alcança a faixa mínima `min`? */
export const ageAtLeast = (band: AgeBand, min: AgeBand): boolean =>
  AGE_BAND_ORDER.indexOf(band) >= AGE_BAND_ORDER.indexOf(min);

/** Criança da casa, para o motor de rotinas. */
export interface Kid {
  id: string;
  ageBand: AgeBand;
}

/** Slots (cores) das pessoas da casa: o 1º livre é dado a quem entra. */
export const MEMBER_SLOTS = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export type MemberSlot = (typeof MEMBER_SLOTS)[number];

/** Limites por modo: adultos com conta e perfis de criança. */
export const MODE_LIMITS: Record<HouseMode, { adults: number; kids: number }> =
  {
    solo: { adults: 1, kids: 0 },
    couple: { adults: 2, kids: 0 },
    family: { adults: 4, kids: 6 },
  };

/** Primeiro slot livre (ou null se a casa está cheia). */
export const nextFreeSlot = (used: string[]): MemberSlot | null =>
  MEMBER_SLOTS.find((s) => !used.includes(s)) ?? null;

/* ================= cômodos ================= */

export type RoomKind =
  | "quarto"
  | "banheiro"
  | "lavabo"
  | "sala"
  | "cozinha"
  | "servico"
  | "varanda"
  | "quintal"
  | "garagem"
  | "escritorio"
  | "piscina";

export interface RoomKindInfo {
  label: string;
  plural: string;
  max: number;
}

/** Ordem = ordem de exibição. */
export const ROOM_KINDS: Record<RoomKind, RoomKindInfo> = {
  quarto: { label: "Quarto", plural: "Quartos", max: 8 },
  banheiro: { label: "Banheiro", plural: "Banheiros", max: 6 },
  lavabo: { label: "Lavabo", plural: "Lavabos", max: 3 },
  sala: { label: "Sala", plural: "Salas", max: 3 },
  cozinha: { label: "Cozinha", plural: "Cozinhas", max: 2 },
  servico: { label: "Área de serviço", plural: "Áreas de serviço", max: 1 },
  varanda: { label: "Varanda", plural: "Varandas", max: 3 },
  quintal: { label: "Quintal", plural: "Quintais", max: 1 },
  garagem: { label: "Garagem", plural: "Garagens", max: 1 },
  escritorio: { label: "Escritório", plural: "Escritórios", max: 2 },
  piscina: { label: "Piscina", plural: "Piscinas", max: 1 },
};

export const ROOM_KIND_ORDER = Object.keys(ROOM_KINDS) as RoomKind[];

export const isRoomKind = (k: string): k is RoomKind => k in ROOM_KINDS;

export interface RoomInstance {
  /** Identidade estável do cômodo (também usada nas chaves das tarefas). */
  slug: string;
  kind: RoomKind;
  /** Nome exibido (apelido do usuário ou o padrão). */
  label: string;
  position: number;
}

/**
 * Slug canônico. O 1º de cada tipo mantém o slug antigo (quarto1, sala, cozinha,
 * banheiro, servico) — assim as casas criadas antes dos cômodos com quantidade
 * continuam com as mesmas chaves de tarefa e histórico.
 */
export function slugFor(kind: RoomKind, index: number): string {
  if (kind === "quarto") return `quarto${index + 1}`;
  return index === 0 ? kind : `${kind}_${index + 1}`;
}

/** Tipo a partir de um slug antigo/novo (null = não é um cômodo). */
export function kindFromSlug(slug: string): RoomKind | null {
  const base = slug.replace(/_\d+$/, "").replace(/^quarto\d+$/, "quarto");
  return isRoomKind(base) ? base : null;
}

export function defaultRoomLabel(
  kind: RoomKind,
  index: number,
  total: number,
): string {
  const base = ROOM_KINDS[kind].label;
  if (total <= 1) return base;
  if (kind === "quarto" && index === 0) return "Quarto principal";
  return `${base} ${index + 1}`;
}

export interface RoomInput {
  kind: RoomKind;
  /** Apelido opcional (ex.: "Quarto do João"). */
  label?: string | null;
}

export interface BuiltRoom extends RoomInstance {
  /** Apelido digitado pelo usuário (null = nome padrão, que se ajusta à quantidade). */
  custom: string | null;
}

/** Transforma a lista pedida (em ordem) em cômodos com slug e rótulo canônicos. */
export function buildRooms(entries: RoomInput[]): BuiltRoom[] {
  const total: Partial<Record<RoomKind, number>> = {};
  for (const e of entries) total[e.kind] = (total[e.kind] ?? 0) + 1;
  const seen: Partial<Record<RoomKind, number>> = {};
  const sorted = [...entries]
    .map((e, i) => ({ e, i }))
    .sort(
      (a, b) =>
        ROOM_KIND_ORDER.indexOf(a.e.kind) - ROOM_KIND_ORDER.indexOf(b.e.kind) ||
        a.i - b.i,
    );
  return sorted.map(({ e }, position) => {
    const idx = seen[e.kind] ?? 0;
    seen[e.kind] = idx + 1;
    const custom = e.label?.trim().slice(0, 30) || null;
    return {
      slug: slugFor(e.kind, idx),
      kind: e.kind,
      label: custom ?? defaultRoomLabel(e.kind, idx, total[e.kind] ?? 1),
      position,
      custom,
    };
  });
}

/** Número do slug (quarto2 → 2, banheiro_3 → 3, sala → 1). */
const slugNumber = (slug: string): number =>
  Number(/(\d+)$/.exec(slug)?.[1] ?? 1);

/**
 * Cômodos a partir das linhas guardadas (slug, tipo e apelido). Ignora linhas que não são
 * cômodos (`gatos`/`casa` de casas antigas) e ordena por tipo e número, então casas criadas
 * antes dos cômodos com quantidade têm exatamente os mesmos slugs e chaves de tarefa.
 */
export function roomsFromRows(
  rows: { slug: string; kind: string; label?: string | null }[],
): RoomInstance[] {
  const valid = rows
    .map((r) => ({
      slug: r.slug,
      kind: (isRoomKind(r.kind)
        ? r.kind
        : kindFromSlug(r.slug)) as RoomKind | null,
      label: r.label?.trim() || null,
    }))
    .filter(
      (r): r is { slug: string; kind: RoomKind; label: string | null } =>
        r.kind !== null,
    )
    .sort(
      (a, b) =>
        ROOM_KIND_ORDER.indexOf(a.kind) - ROOM_KIND_ORDER.indexOf(b.kind) ||
        slugNumber(a.slug) - slugNumber(b.slug),
    );
  const total: Partial<Record<RoomKind, number>> = {};
  for (const r of valid) total[r.kind] = (total[r.kind] ?? 0) + 1;
  const seen: Partial<Record<RoomKind, number>> = {};
  return valid.map((r, position) => {
    const idx = seen[r.kind] ?? 0;
    seen[r.kind] = idx + 1;
    return {
      slug: r.slug,
      kind: r.kind,
      label: r.label ?? defaultRoomLabel(r.kind, idx, total[r.kind] ?? 1),
      position,
    };
  });
}

export type RoomCounts = Partial<Record<RoomKind, number>>;

/** Cômodos sugeridos para começar (o usuário ajusta com os contadores). */
export function defaultRoomCounts(
  dwelling: Dwelling,
  size: HouseSize,
): RoomCounts {
  if (dwelling === "studio") {
    return { quarto: 0, banheiro: 1, sala: 0, cozinha: 1, servico: 0 };
  }
  const byHouse = dwelling === "house" || dwelling === "townhouse";
  const base: RoomCounts = {
    quarto: size === "s" ? 1 : size === "m" ? 2 : 3,
    banheiro: size === "l" ? 2 : 1,
    lavabo: size === "l" ? 1 : 0,
    sala: 1,
    cozinha: 1,
    servico: 1,
  };
  if (byHouse) {
    base.quintal = 1;
    base.garagem = size === "s" ? 0 : 1;
  } else if (size !== "s") {
    base.varanda = 1;
  }
  return base;
}

export function roomsFromCounts(
  counts: RoomCounts,
  labels: Record<string, string> = {},
): RoomInstance[] {
  const entries: RoomInput[] = [];
  for (const kind of ROOM_KIND_ORDER) {
    const n = Math.max(0, Math.min(counts[kind] ?? 0, ROOM_KINDS[kind].max));
    for (let i = 0; i < n; i++)
      entries.push({ kind, label: labels[slugFor(kind, i)] });
  }
  return buildRooms(entries);
}

export function countsOf(rooms: { kind: RoomKind }[]): RoomCounts {
  const c: RoomCounts = {};
  for (const r of rooms) c[r.kind] = (c[r.kind] ?? 0) + 1;
  return c;
}

/* ================= pets ================= */

export type PetSpecies =
  | "dog"
  | "cat"
  | "bird"
  | "fish"
  | "rodent"
  | "reptile"
  | "other";
export type DogSize = "mini" | "small" | "medium" | "large" | "giant";
export type Coat = "short" | "long";
export type PetLitter = "litter" | "pad" | "none";

export interface Pet {
  id: string;
  name: string;
  species: PetSpecies;
  /** Só para cães. */
  size?: DogSize;
  coat?: Coat;
  outdoorAccess?: boolean;
  litter?: PetLitter;
}

export const PET_SPECIES: Record<PetSpecies, { label: string; icon: string }> =
  {
    dog: { label: "Cão", icon: "🐶" },
    cat: { label: "Gato", icon: "🐱" },
    bird: { label: "Ave", icon: "🐦" },
    fish: { label: "Peixe", icon: "🐟" },
    rodent: { label: "Roedor / coelho", icon: "🐹" },
    reptile: { label: "Réptil", icon: "🦎" },
    other: { label: "Outro", icon: "🐾" },
  };

export const DOG_SIZES: Record<DogSize, { label: string; weight: string }> = {
  mini: { label: "Mini", weight: "até 5 kg" },
  small: { label: "Pequeno", weight: "5–10 kg" },
  medium: { label: "Médio", weight: "10–25 kg" },
  large: { label: "Grande", weight: "25–45 kg" },
  giant: { label: "Gigante", weight: "45 kg ou mais" },
};

export const DOG_SIZE_ORDER: DogSize[] = [
  "mini",
  "small",
  "medium",
  "large",
  "giant",
];

/* ================= modelos prontos do onboarding ================= */

export interface HouseTemplate {
  id: string;
  name: string;
  hint: string;
  profile: Partial<HouseProfile>;
  pets: Omit<Pet, "id">[];
  kids?: { name: string; ageBand: AgeBand }[];
}

export const HOUSE_TEMPLATES: HouseTemplate[] = [
  {
    id: "solo_apto",
    name: "Moro sozinho(a) em apartamento",
    hint: "Rotina enxuta, sem duelo",
    profile: {
      mode: "solo",
      dwelling: "apartment",
      size: "s",
      intensity: "light",
    },
    pets: [],
  },
  {
    id: "casal_sem_pets",
    name: "Casal sem pets",
    hint: "Divisão justa entre os dois",
    profile: { mode: "couple", dwelling: "apartment", size: "m" },
    pets: [],
  },
  {
    id: "casal_gatos",
    name: "Casal com gatos",
    hint: "Areia, potes e escovação",
    profile: { mode: "couple", dwelling: "apartment", size: "m" },
    pets: [
      { name: "Gato 1", species: "cat" },
      { name: "Gato 2", species: "cat" },
    ],
  },
  {
    id: "casal_cao_grande",
    name: "Casal com cão grande",
    hint: "Passeios, banho e cuidados",
    profile: { mode: "couple", dwelling: "house", size: "m" },
    pets: [
      {
        name: "Thor",
        species: "dog",
        size: "large",
        coat: "short",
        outdoorAccess: true,
      },
    ],
  },
  {
    id: "familia_cao",
    name: "Família com criança e cão",
    hint: "Tarefas por idade e passeios",
    profile: { mode: "family", dwelling: "house", size: "m" },
    pets: [
      {
        name: "Thor",
        species: "dog",
        size: "medium",
        coat: "short",
        outdoorAccess: true,
      },
    ],
    kids: [{ name: "Criança 1", ageBand: "child_7_9" }],
  },
];
