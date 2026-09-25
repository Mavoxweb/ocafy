import { type HouseMode, MODE_LIMITS } from "@ocafy/core";
import { db, householdMembers, households } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";

export const limitsOf = (mode: string) =>
  MODE_LIMITS[(mode in MODE_LIMITS ? mode : "couple") as HouseMode];

/** Adultos (com login) e perfis de criança da casa, com os slots já usados. */
export async function loadRoster(householdId: string) {
  const [rows, [house]] = await db.batch([
    db
      .select({
        kind: householdMembers.kind,
        slot: householdMembers.slot,
      })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, householdId)),
    db
      .select({ mode: households.mode })
      .from(households)
      .where(eq(households.id, householdId)),
  ]);
  return {
    mode: house?.mode ?? "couple",
    adults: rows.filter((r) => r.kind === "account").length,
    kids: rows.filter((r) => r.kind === "profile").length,
    slots: rows.map((r) => r.slot as string),
  };
}

export const fullMessage = (mode: string) =>
  mode === "solo"
    ? "Esta casa está no modo Solo. Mude para Casal ou Família em Minha casa para convidar alguém."
    : mode === "couple"
      ? "A casa já tem duas pessoas. Para incluir mais adultos, mude para o modo Família em Minha casa."
      : "A casa já tem o máximo de adultos.";

/** Confere que o id é de um perfil de criança desta casa e o devolve. */
export async function assertProfileOfHousehold(
  householdId: string,
  memberId: string,
): Promise<string> {
  const [row] = await db
    .select({ id: householdMembers.id })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(householdMembers.householdId, householdId),
        eq(householdMembers.kind, "profile"),
      ),
    );
  if (!row) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Perfil não encontrado nesta casa.",
    });
  }
  return row.id;
}
