import {
  type Coat,
  DEFAULT_PROFILE,
  type DogSize,
  HOUSE_TEMPLATES,
  type HouseProfile,
  type Pet,
  type PetLitter,
  type PetSpecies,
  type PlannedTask,
  ROOM_KINDS,
  ROOM_KIND_ORDER,
  type RoomCounts,
  type RoomInstance,
  countsOf,
  defaultRoomCounts,
  defaultRoomLabel,
  generatePlan,
  roomsFromCounts,
  slugFor,
} from "@ocafy/core";
import { uid } from "./dates";
import type { AppState } from "./store";

/**
 * Rascunho da casa: o que o onboarding e a tela "Minha casa" editam antes de salvar.
 * Tudo aqui é puro — a prévia do plano usa o mesmo motor de rotinas do servidor.
 */

/** Família chega na próxima versão: por enquanto só Solo e Casal. */
export type EditableProfile = Omit<HouseProfile, "mode"> & {
  mode: "solo" | "couple";
};

export interface PetDraft {
  /** Chave local (estável na edição). */
  key: string;
  /** Id no servidor, se já existe (mantém o histórico). */
  id?: string;
  name: string;
  species: PetSpecies;
  size: DogSize;
  coat: Coat;
  outdoorAccess: boolean;
  litter: PetLitter;
}

export interface HouseDraft {
  profile: EditableProfile;
  counts: RoomCounts;
  /** Apelidos por slug (só os digitados). */
  labels: Record<string, string>;
  pets: PetDraft[];
}

const editable = (p: HouseProfile): EditableProfile => ({
  ...p,
  mode: p.mode === "solo" ? "solo" : "couple",
});

export function initialDraft(): HouseDraft {
  const profile = editable(DEFAULT_PROFILE);
  return {
    profile,
    counts: defaultRoomCounts(profile.dwelling, profile.size),
    labels: {},
    pets: [],
  };
}

export function newPet(species: PetSpecies, index: number): PetDraft {
  const names: Record<PetSpecies, string> = {
    dog: "Cão",
    cat: "Gato",
    bird: "Ave",
    fish: "Peixe",
    rodent: "Roedor",
    reptile: "Réptil",
    other: "Pet",
  };
  return {
    key: uid(),
    name: `${names[species]} ${index}`,
    species,
    size: "medium",
    coat: "short",
    outdoorAccess: false,
    litter: "litter",
  };
}

/** Modelo pronto do onboarding (modo + tipo de casa + pets). */
export function draftFromTemplate(id: string): HouseDraft {
  const tpl = HOUSE_TEMPLATES.find((t) => t.id === id);
  const d = initialDraft();
  if (!tpl) return d;
  const profile = editable({ ...d.profile, ...tpl.profile });
  return {
    profile,
    counts: defaultRoomCounts(profile.dwelling, profile.size),
    labels: {},
    pets: tpl.pets.map((p) => ({
      key: uid(),
      name: p.name,
      species: p.species,
      size: p.size ?? "medium",
      coat: p.coat ?? "short",
      outdoorAccess: p.outdoorAccess ?? false,
      litter: p.litter ?? "litter",
    })),
  };
}

/** Rascunho a partir da casa atual (tela "Minha casa"). */
export function draftFromState(s: AppState): HouseDraft {
  const labels: Record<string, string> = {};
  const seen: Record<string, number> = {};
  const total = countsOf(s.rooms);
  for (const r of s.rooms) {
    const idx = seen[r.kind] ?? 0;
    seen[r.kind] = idx + 1;
    if (r.label !== defaultRoomLabel(r.kind, idx, total[r.kind] ?? 1))
      labels[slugFor(r.kind, idx)] = r.label;
  }
  return {
    profile: editable(s.profile),
    counts: total,
    labels,
    pets: s.pets.map((p) => ({
      key: p.id,
      id: p.id,
      name: p.name,
      species: p.species,
      size: p.size ?? "medium",
      coat: p.coat ?? "short",
      outdoorAccess: p.outdoorAccess ?? false,
      litter: p.litter ?? "litter",
    })),
  };
}

export const draftRooms = (d: HouseDraft): RoomInstance[] =>
  roomsFromCounts(d.counts, d.labels);

export const draftPets = (d: HouseDraft): Pet[] =>
  d.pets.map((p) => ({
    id: p.id ?? p.key,
    name: p.name.trim() || "Pet",
    species: p.species,
    ...(p.species === "dog"
      ? { size: p.size, coat: p.coat, outdoorAccess: p.outdoorAccess }
      : {}),
    ...(p.species === "cat" ? { litter: p.litter } : {}),
  }));

export const draftPlan = (d: HouseDraft): PlannedTask[] =>
  generatePlan({
    profile: d.profile,
    rooms: draftRooms(d),
    pets: draftPets(d),
  });

/** Payload da API (cômodos em ordem, com apelido só onde o usuário digitou). */
export function draftToInput(d: HouseDraft) {
  const rooms: { kind: (typeof ROOM_KIND_ORDER)[number]; label?: string }[] =
    [];
  for (const kind of ROOM_KIND_ORDER) {
    const n = Math.max(0, Math.min(d.counts[kind] ?? 0, ROOM_KINDS[kind].max));
    for (let i = 0; i < n; i++) {
      const label = d.labels[slugFor(kind, i)]?.trim();
      rooms.push(label ? { kind, label } : { kind });
    }
  }
  return {
    profile: d.profile,
    rooms,
    pets: d.pets.map((p) => ({
      ...(p.id ? { id: p.id } : {}),
      name: p.name.trim() || "Pet",
      species: p.species,
      size: p.species === "dog" ? p.size : null,
      coat: p.species === "dog" ? p.coat : null,
      outdoorAccess: p.species === "dog" ? p.outdoorAccess : null,
      litter: p.species === "cat" ? p.litter : null,
    })),
  };
}
