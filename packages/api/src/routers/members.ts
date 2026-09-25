import { MODE_LIMITS, nextFreeSlot } from "@ocafy/core";
import { db, householdMembers } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { assertWithinPlan, loadEntitlements } from "../entitlements";
import { loadRoster } from "../roster";
import { memberProfileSchema, uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

const profileWhere = (householdId: string, id: string) =>
  and(
    eq(householdMembers.id, id),
    eq(householdMembers.householdId, householdId),
    eq(householdMembers.kind, "profile"),
  );

/**
 * Perfis de criança: sem login, controlados pelos adultos da casa. Só existem no modo Família.
 * O responsável registra as tarefas por elas (ver tasks.complete → forMemberId).
 */
export const membersRouter = router({
  addProfile: memberProcedure
    .input(memberProfileSchema)
    .mutation(async ({ ctx, input }) => {
      const roster = await loadRoster(ctx.householdId);
      // Perfis de criança são do plano Plus (quem já tem os que criou continua vendo e usando).
      const plan = await loadEntitlements(ctx.householdId);
      assertWithinPlan(
        plan.entitlements,
        { mode: "couple", pets: 0, projects: 0 },
        { mode: "family", pets: 0, projects: 0 },
      );
      if (roster.mode !== "family") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Perfis de criança existem no modo Família.",
        });
      }
      if (roster.kids >= MODE_LIMITS.family.kids) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `No máximo ${MODE_LIMITS.family.kids} perfis de criança.`,
        });
      }
      const slot = nextFreeSlot(roster.slots);
      if (!slot) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "A casa já tem o máximo de pessoas.",
        });
      }
      try {
        const [row] = await db
          .insert(householdMembers)
          .values({
            householdId: ctx.householdId,
            userId: null,
            kind: "profile",
            ageBand: input.ageBand,
            displayName: input.name,
            role: "member",
            slot,
          })
          .returning({ id: householdMembers.id });
        return { id: row.id };
      } catch (e) {
        const code = (e as { cause?: { code?: string } })?.cause?.code;
        if (code === "23505") {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Alguém acabou de entrar; tente de novo.",
          });
        }
        throw e;
      }
    }),

  updateProfile: memberProcedure
    .input(memberProfileSchema.partial().extend({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const set = {
        ...(input.name ? { displayName: input.name } : {}),
        ...(input.ageBand ? { ageBand: input.ageBand } : {}),
      };
      if (!Object.keys(set).length) return { ok: true };
      await db
        .update(householdMembers)
        .set(set)
        .where(profileWhere(ctx.householdId, input.id));
      return { ok: true };
    }),

  /** Remove o perfil e o histórico dele (o histórico é dele; não fica órfão na casa). */
  removeProfile: memberProcedure
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(householdMembers)
        .where(profileWhere(ctx.householdId, input.id));
      return { ok: true };
    }),
});
