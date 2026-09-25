import {
  DEFAULT_PROFILE,
  type HouseProfile,
  type Kid,
  type Pet,
  type PlanInput,
  type PlannedTask,
  type RoomInstance,
  generatePlan,
  roomsFromRows,
} from "@ocafy/core";
import { db, householdMembers, households, pets, rooms } from "@ocafy/db";
import { eq } from "drizzle-orm";

type HouseholdRow = typeof households.$inferSelect;
type PetRow = typeof pets.$inferSelect;
type RoomRow = typeof rooms.$inferSelect;

export const profileOf = (h: HouseholdRow): HouseProfile => ({
  mode: h.mode,
  dwelling: h.dwelling,
  size: h.size,
  intensity: h.intensity,
  cooksAtHome: h.cooksAtHome,
  usesFrozen: h.usesFrozen,
  hasWasher: h.hasWasher,
  hasPlants: h.hasPlants,
  hasCar: h.hasCar,
  officeProject: h.officeProject,
});

export const petOf = (p: PetRow): Pet => ({
  id: p.id,
  name: p.name,
  species: p.species,
  ...(p.size ? { size: p.size } : {}),
  ...(p.coat ? { coat: p.coat } : {}),
  ...(p.outdoorAccess != null ? { outdoorAccess: p.outdoorAccess } : {}),
  ...(p.litter ? { litter: p.litter } : {}),
});

export const roomsOf = (rows: RoomRow[]): RoomInstance[] => roomsFromRows(rows);

/** Perfis de criança (com faixa etária) entre as pessoas da casa. */
export const kidsOf = (
  rows: { id: string; kind: string; ageBand: string | null }[],
): Kid[] =>
  rows
    .filter((r) => r.kind === "profile" && r.ageBand)
    .map((r) => ({ id: r.id, ageBand: r.ageBand as Kid["ageBand"] }));

/** Entrada do motor de rotinas para uma casa (consultas pequenas, em lote). */
export async function loadPlanInput(householdId: string): Promise<PlanInput> {
  const [[h], roomRows, petRows, memberRows] = await db.batch([
    db.select().from(households).where(eq(households.id, householdId)),
    db.select().from(rooms).where(eq(rooms.householdId, householdId)),
    db.select().from(pets).where(eq(pets.householdId, householdId)),
    db
      .select({
        id: householdMembers.id,
        kind: householdMembers.kind,
        ageBand: householdMembers.ageBand,
      })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId)),
  ]);
  if (!h) return { profile: DEFAULT_PROFILE, rooms: [], pets: [], kids: [] };
  return {
    profile: profileOf(h),
    rooms: roomsOf(roomRows),
    pets: petRows.map(petOf),
    kids: kidsOf(memberRows),
  };
}

/** Plano atual da casa. */
export async function loadPlan(householdId: string): Promise<PlannedTask[]> {
  return generatePlan(await loadPlanInput(householdId));
}
