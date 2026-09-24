import { db, meals } from "@ocafy/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { mealSchema, uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

const scope = (householdId: string, id: string) =>
  and(eq(meals.id, id), eq(meals.householdId, householdId));

export const mealsRouter = router({
  add: memberProcedure.input(mealSchema).mutation(async ({ ctx, input }) => {
    const id = input.id ?? crypto.randomUUID();
    await db
      .insert(meals)
      .values({
        id,
        householdId: ctx.householdId,
        dateKey: input.dateKey,
        slot: input.slot,
        dishName: input.dish,
        proteinKey: input.protein,
        createdBy: ctx.member.id,
      })
      .onConflictDoNothing({ target: meals.id });
    return { id };
  }),

  setPulled: memberProcedure
    .input(z.object({ id: uuid, value: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(meals)
        .set({ pulledBy: input.value ? ctx.member.id : null })
        .where(scope(ctx.householdId, input.id));
      return { ok: true };
    }),

  setCooked: memberProcedure
    .input(z.object({ id: uuid, value: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(meals)
        .set({ cookedBy: input.value ? ctx.member.id : null })
        .where(scope(ctx.householdId, input.id));
      return { ok: true };
    }),

  remove: memberProcedure
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(meals).where(scope(ctx.householdId, input.id));
      return { ok: true };
    }),
});
