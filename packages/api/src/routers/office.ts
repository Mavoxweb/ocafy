import { OFFICE_GOALS, OFFICE_GOAL_XP } from "@ocafy/core";
import {
  completions,
  db,
  inventoryItems,
  officeGoals,
  officeProjects,
  officeSteps,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  completionInput,
  dateKey,
  inventorySchema,
  uuid,
} from "../schemas/index";
import { memberProcedure, router } from "../trpc";

const goalOf = (goalKey: string) => {
  const g = OFFICE_GOALS.find((x) => x.id === goalKey);
  if (!g)
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Objetivo desconhecido.",
    });
  return g;
};

export const officeRouter = router({
  /** Começa o projeto (start = segunda-feira da semana atual, enviada pelo cliente). */
  start: memberProcedure
    .input(z.object({ startDate: dateKey }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(officeProjects)
        .values({ householdId: ctx.householdId, startDate: input.startDate })
        .onConflictDoNothing({ target: officeProjects.householdId });
      return { ok: true };
    }),

  setStep: memberProcedure
    .input(
      z.object({
        goalKey: z.string(),
        index: z.number().int().min(0).max(20),
        value: z.boolean(),
        startDate: dateKey, // usada só se o projeto ainda não começou
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const g = goalOf(input.goalKey);
      if (input.index >= g.steps.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Etapa inexistente.",
        });
      }
      await db.batch([
        db
          .insert(officeProjects)
          .values({ householdId: ctx.householdId, startDate: input.startDate })
          .onConflictDoNothing({ target: officeProjects.householdId }),
        db
          .insert(officeSteps)
          .values({
            householdId: ctx.householdId,
            goalKey: input.goalKey,
            stepIndex: input.index,
            isDone: input.value,
          })
          .onConflictDoUpdate({
            target: [
              officeSteps.householdId,
              officeSteps.goalKey,
              officeSteps.stepIndex,
            ],
            set: { isDone: input.value },
          }),
      ]);
      return { ok: true };
    }),

  /** Conclui o objetivo (exige todas as etapas) e registra o XP. */
  finishGoal: memberProcedure
    .input(z.object({ goalKey: z.string(), completion: completionInput }))
    .mutation(async ({ ctx, input }) => {
      const g = goalOf(input.goalKey);
      const steps = await db
        .select()
        .from(officeSteps)
        .where(
          and(
            eq(officeSteps.householdId, ctx.householdId),
            eq(officeSteps.goalKey, g.id),
            eq(officeSteps.isDone, true),
          ),
        );
      if (new Set(steps.map((s) => s.stepIndex)).size < g.steps.length) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Marque todas as etapas para concluir.",
        });
      }
      const at = new Date(input.completion.at);
      const id = input.completion.id ?? crypto.randomUUID();
      await db.batch([
        db
          .insert(officeGoals)
          .values({
            householdId: ctx.householdId,
            goalKey: g.id,
            completedBy: ctx.member.id,
            completedAt: at,
          })
          .onConflictDoNothing(),
        db
          .insert(completions)
          .values({
            id,
            householdId: ctx.householdId,
            taskKey: "escritorio",
            completedBy: ctx.member.id,
            completedAt: at,
            pointsAwarded: OFFICE_GOAL_XP,
            note: g.t,
            dateKey: input.completion.dateKey,
          })
          .onConflictDoNothing({ target: completions.id }),
      ]);
      return { id };
    }),

  addItem: memberProcedure
    .input(inventorySchema)
    .mutation(async ({ ctx, input }) => {
      const id = input.id ?? crypto.randomUUID();
      await db
        .insert(inventoryItems)
        .values({
          id,
          householdId: ctx.householdId,
          name: input.name,
          category: input.category,
          destination: input.dest,
          createdBy: ctx.member.id,
        })
        .onConflictDoNothing({ target: inventoryItems.id });
      return { id };
    }),

  setItemDest: memberProcedure
    .input(z.object({ id: uuid, dest: inventorySchema.shape.dest }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(inventoryItems)
        .set({ destination: input.dest })
        .where(
          and(
            eq(inventoryItems.id, input.id),
            eq(inventoryItems.householdId, ctx.householdId),
          ),
        );
      return { ok: true };
    }),

  removeItem: memberProcedure
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(inventoryItems)
        .where(
          and(
            eq(inventoryItems.id, input.id),
            eq(inventoryItems.householdId, ctx.householdId),
          ),
        );
      return { ok: true };
    }),
});
