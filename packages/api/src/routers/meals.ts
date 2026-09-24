import { calculateDefrostAlert } from "@ocafy/core";
import { db, meals } from "@ocafy/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { mealSchema } from "../schemas/index.js";
import { publicProcedure, router } from "../trpc.js";

export const mealsRouter = router({
  list: publicProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .query(async ({ input }) => {
      const allMeals = await db.query.meals.findMany({
        where: eq(meals.householdId, input.householdId),
      });

      const now = new Date();
      return allMeals.map((m: typeof meals.$inferSelect) => {
        const alert = calculateDefrostAlert(
          {
            id: m.id,
            date: m.dateKey,
            slot: m.slot,
            dish: m.dishName,
            protein: m.proteinKey,
            cooked: !!m.cookedBy,
            pulled: !!m.pulledBy,
          },
          now,
        );

        return { ...m, alert };
      });
    }),

  addMeal: publicProcedure
    .input(mealSchema.extend({ householdId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [newMeal] = await db
        .insert(meals)
        .values({
          householdId: input.householdId,
          dateKey: input.dateKey,
          slot: input.slot,
          dishName: input.dishName,
          proteinKey: input.proteinKey,
          defrostHours: input.defrostHours,
        })
        .returning();

      return newMeal;
    }),

  togglePulled: publicProcedure
    .input(
      z.object({
        mealId: z.string().uuid(),
        memberId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const meal = await db.query.meals.findFirst({
        where: eq(meals.id, input.mealId),
      });

      if (!meal) throw new Error("Refeição não encontrada");

      const newPulledBy = meal.pulledBy ? null : input.memberId;
      const [updated] = await db
        .update(meals)
        .set({ pulledBy: newPulledBy })
        .where(eq(meals.id, input.mealId))
        .returning();

      return updated;
    }),
});
