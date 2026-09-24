import {
  DEFAULT_PROFILE,
  type HouseProfile,
  type Pet,
  type PlanInput,
  type PlannedTask,
  type RoomInstance,
  generatePlan,
  roomsFromRows,
} from "@ocafy/core";
import { db, households, pets, rooms } from "@ocafy/db";
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

export const planOf = (
  h: HouseholdRow,
  roomRows: RoomRow[],
  petRows: PetRow[],
): PlannedTask[] =>
  generatePlan({
    profile: profileOf(h),
    rooms: roomsOf(roomRows),
    pets: petRows.map(petOf),
  });

/** Entrada do motor de rotinas para uma casa (3 consultas pequenas, em lote). */
export async function loadPlanInput(householdId: string): Promise<PlanInput> {
  const [[h], roomRows, petRows] = await db.batch([
    db.select().from(households).where(eq(households.id, householdId)),
    db.select().from(rooms).where(eq(rooms.householdId, householdId)),
    db.select().from(pets).where(eq(pets.householdId, householdId)),
  ]);
  if (!h) return { profile: DEFAULT_PROFILE, rooms: [], pets: [] };
  return {
    profile: profileOf(h),
    rooms: roomsOf(roomRows),
    pets: petRows.map(petOf),
  };
}

/** Plano atual da casa. */
export async function loadPlan(householdId: string): Promise<PlannedTask[]> {
  return generatePlan(await loadPlanInput(householdId));
}
