import { PSEUDO_TASKS } from "./catalog";
import {
  type Condition,
  LIBRARY,
  LIBRARY_BY_ID,
  type TaskLevel,
  type TaskTemplate,
} from "./library";
import type {
  AgeBand,
  Dwelling,
  HouseProfile,
  Intensity,
  Kid,
  Pet,
  RoomInstance,
  RoomKind,
} from "./profile";
import { ageAtLeast } from "./profile";
import type { TaskCategory } from "./types";

/**
 * Planner: perfil da casa (+ cômodos + pets) → lista de tarefas da casa.
 * É uma função PURA e determinística: o servidor e o app calculam o mesmo plano.
 *
 * Chaves de tarefa (usadas no histórico de conclusões):
 *   - o 1º exemplar de um modelo mantém a chave simples (`aspirar`, `banheiro`, …) — compatível
 *     com todo o histórico anterior;
 *   - os demais exemplares levam `@<slug do cômodo ou id do pet>` (`banheiro@banheiro_2`).
 */

export interface PlanInput {
  profile: HouseProfile;
  rooms: RoomInstance[];
  pets: Pet[];
  /** Crianças da casa (perfis sem login): ativam tarefas por idade. */
  kids?: Kid[];
}

export interface PlannedTask {
  /** Chave da tarefa (usada em conclusões, sobrescritas e trocas). */
  id: string;
  templateId: string;
  kind: "routine" | "recurring";
  /** Bloco da rotina diária (só rotinas). */
  r?: "manha" | "noite";
  /** Título; pode conter {A}/{B} (nomes das pessoas) resolvidos na tela. */
  t: string;
  /** slug do cômodo, "casa" ou "pets". */
  room: string;
  roomLabel: string;
  roomKind?: RoomKind;
  petId?: string;
  petName?: string;
  cat: TaskCategory;
  mins: number;
  min: number;
  max: number;
  day?: number;
  how: string;
  level: TaskLevel;
  /** Faixa etária mínima sugerida para uma criança fazer a tarefa. */
  suitableFrom?: AgeBand;
}

const LEVEL_RANK: Record<TaskLevel, number> = {
  core: 0,
  standard: 1,
  extra: 2,
};
const INTENSITY_MAX_LEVEL: Record<Intensity, number> = {
  light: 0,
  standard: 1,
  full: 2,
};
const INTENSITY_FACTOR: Record<Intensity, number> = {
  light: 1.5,
  standard: 1,
  full: 0.75,
};

interface Ctx {
  profile: HouseProfile;
  rooms: RoomInstance[];
  pets: Pet[];
  kids: Kid[];
  pet?: Pet;
}

export function evalCondition(c: Condition | undefined, ctx: Ctx): boolean {
  if (!c) return true;
  if (c.all && !c.all.every((x) => evalCondition(x, ctx))) return false;
  if (c.any && !c.any.some((x) => evalCondition(x, ctx))) return false;
  if (c.not && evalCondition(c.not, ctx)) return false;
  if (c.dwelling && !c.dwelling.includes(ctx.profile.dwelling as Dwelling))
    return false;
  if (c.mode && !c.mode.includes(ctx.profile.mode)) return false;
  if (c.hasRoom && !ctx.rooms.some((r) => r.kind === c.hasRoom)) return false;
  if (c.hasPet && !ctx.pets.some((p) => p.species === c.hasPet)) return false;
  if (
    c.kidMin &&
    !ctx.kids.some((k) => ageAtLeast(k.ageBand, c.kidMin as AgeBand))
  )
    return false;
  if (c.flag && !ctx.profile[c.flag]) return false;
  if (c.petSize && !(ctx.pet?.size && c.petSize.includes(ctx.pet.size)))
    return false;
  if (c.petCoat && ctx.pet?.coat !== c.petCoat) return false;
  if (c.petOutdoor != null && !!ctx.pet?.outdoorAccess !== c.petOutdoor)
    return false;
  return true;
}

function scaleWindow(
  min: number,
  max: number,
  factor: number,
): [number, number] {
  if (max < 3 || factor === 1) return [min, max];
  const mn = Math.max(1, Math.round(min * factor));
  return [mn, Math.max(mn, Math.round(max * factor))];
}

const fillTitle = (title: string, vars: Record<string, string>) =>
  title.replace(/\{(pet|room)\}/g, (_m, k: string) => vars[k] ?? "");

/** "banheiro@banheiro_2" → { templateId: "banheiro", instance: "banheiro_2" } */
export function parseTaskKey(key: string): {
  templateId: string;
  instance?: string;
} {
  const i = key.indexOf("@");
  return i < 0
    ? { templateId: key }
    : { templateId: key.slice(0, i), instance: key.slice(i + 1) };
}

export function generatePlan(
  input: PlanInput,
  library: TaskTemplate[] = LIBRARY,
): PlannedTask[] {
  const { profile } = input;
  const rooms = [...input.rooms].sort((a, b) => a.position - b.position);
  const base = { profile, rooms, pets: input.pets, kids: input.kids ?? [] };
  const maxRank = INTENSITY_MAX_LEVEL[profile.intensity];
  const factor = INTENSITY_FACTOR[profile.intensity];
  const out: PlannedTask[] = [];

  for (const tpl of library) {
    if (LEVEL_RANK[tpl.level] > maxRank) continue;

    const emit = (
      first: boolean,
      target: {
        slug?: string;
        label: string;
        roomKind?: RoomKind;
        pet?: Pet;
        group?: string;
      },
      count: number,
    ) => {
      const pet = target.pet;
      const ctx: Ctx = { ...base, ...(pet ? { pet } : {}) };
      if (!evalCondition(tpl.when, ctx)) return;

      const rawTitle = tpl.titles?.[profile.mode] ?? tpl.title;
      let title = fillTitle(rawTitle, {
        pet: pet?.name ?? "",
        room: target.label,
      });
      if (tpl.scope === "room" && count > 1 && !rawTitle.includes("{room}")) {
        title = `${title} — ${target.label}`;
      }

      const mins =
        (pet?.size && tpl.minsByPet?.[pet.size]) ??
        tpl.minsBySize?.[profile.size] ??
        tpl.mins;
      const win = pet?.size ? tpl.windowByPet?.[pet.size] : undefined;
      const [min, max] =
        tpl.kind === "routine"
          ? [1, 1]
          : scaleWindow(win?.[0] ?? tpl.min, win?.[1] ?? tpl.max, factor);

      const suffix = target.pet?.id ?? target.slug;
      const id = first || !suffix ? tpl.id : `${tpl.id}@${suffix}`;

      out.push({
        id: tpl.scope === "pet" ? `${tpl.id}@${pet?.id}` : id,
        templateId: tpl.id,
        kind: tpl.kind,
        ...(tpl.block ? { r: tpl.block } : {}),
        t: title,
        room:
          tpl.scope === "pet"
            ? "pets"
            : (target.slug ?? target.group ?? "casa"),
        roomLabel: tpl.scope === "pet" ? (pet?.name ?? "Pets") : target.label,
        ...(target.roomKind ? { roomKind: target.roomKind } : {}),
        ...(pet ? { petId: pet.id, petName: pet.name } : {}),
        cat: tpl.cat,
        mins,
        min,
        max,
        ...(tpl.day != null ? { day: tpl.day } : {}),
        how: tpl.how,
        level: tpl.level,
        ...(tpl.suitableFrom ? { suitableFrom: tpl.suitableFrom } : {}),
      });
    };

    if (tpl.scope === "household") {
      const g = tpl.group ?? "casa";
      emit(true, { label: g === "pets" ? "Pets" : "Casa toda", group: g }, 1);
    } else if (tpl.scope === "room" && tpl.roomKind) {
      const all = rooms.filter((r) => r.kind === tpl.roomKind);
      const picked =
        tpl.instances === "primary"
          ? all.slice(0, 1)
          : tpl.instances === "extra"
            ? all.slice(1)
            : all;
      picked.forEach((r, i) =>
        emit(
          i === 0,
          { slug: r.slug, label: r.label, roomKind: r.kind },
          picked.length,
        ),
      );
    } else if (tpl.scope === "pet" && tpl.species) {
      const pets = input.pets.filter((p) => p.species === tpl.species);
      for (const p of pets) emit(true, { label: p.name, pet: p }, pets.length);
    }
  }
  return out;
}

/* ================= consulta e comparação ================= */

export function indexPlan(plan: PlannedTask[]): Map<string, PlannedTask> {
  return new Map(plan.map((t) => [t.id, t]));
}

export interface PlanDiff {
  added: PlannedTask[];
  removed: PlannedTask[];
}

export function diffPlans(
  before: PlannedTask[],
  after: PlannedTask[],
): PlanDiff {
  const b = indexPlan(before);
  const a = indexPlan(after);
  return {
    added: after.filter((t) => !b.has(t.id)),
    removed: before.filter((t) => !a.has(t.id)),
  };
}

export interface PlanSummary {
  routineMorning: number;
  routineNight: number;
  recurring: number;
  /** Minutos por dia, em média (rotinas + recorrentes diluídas na janela). */
  minutesPerDay: number;
  /** Parte de `minutesPerDay` que vem dos pets (passeios, cuidados…). */
  petMinutesPerDay: number;
}

export function summarizePlan(plan: PlannedTask[]): PlanSummary {
  let morning = 0;
  let night = 0;
  let recurring = 0;
  let minutes = 0;
  let petMinutes = 0;
  for (const t of plan) {
    const before = minutes;
    if (t.kind === "routine") {
      if (t.r === "manha") morning++;
      else night++;
      minutes += t.mins;
    } else {
      recurring++;
      minutes += t.mins / Math.max(1, (t.min + t.max) / 2);
    }
    if (t.petId) petMinutes += minutes - before;
  }
  return {
    routineMorning: morning,
    routineNight: night,
    recurring,
    minutesPerDay: Math.round(minutes),
    petMinutesPerDay: Math.round(petMinutes),
  };
}

/** Agrupa por cômodo/pet para a tela de prévia. */
export function groupPlan(
  plan: PlannedTask[],
): { key: string; label: string; count: number }[] {
  const groups = new Map<
    string,
    { key: string; label: string; count: number }
  >();
  for (const t of plan) {
    const key = t.petId ? `pet:${t.petId}` : t.room;
    const label = t.petName ?? t.roomLabel;
    const g = groups.get(key) ?? { key, label, count: 0 };
    g.count++;
    groups.set(key, g);
  }
  return [...groups.values()];
}

/**
 * Tarefa válida para conclusão: as do plano atual ou as geradas por ações do app
 * (descongelar, cozinhar, objetivo do escritório). Usado pelo servidor para validar
 * chaves e limitar o XP.
 */
export function resolveTask(
  plan: PlannedTask[] | Map<string, PlannedTask>,
  key: string,
): { id: string; mins: number; recurring: boolean } | undefined {
  const map = plan instanceof Map ? plan : indexPlan(plan);
  const t = map.get(key);
  if (t) return { id: t.id, mins: t.mins, recurring: t.kind === "recurring" };
  const p = PSEUDO_TASKS.find((x) => x.id === key);
  return p ? { id: p.id, mins: p.mins, recurring: false } : undefined;
}

/** Modelo da biblioteca a partir de uma chave (mesmo que a tarefa já não esteja no plano). */
export function templateOfKey(key: string): TaskTemplate | undefined {
  return LIBRARY_BY_ID[parseTaskKey(key).templateId];
}
