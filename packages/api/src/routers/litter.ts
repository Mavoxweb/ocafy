import { db, litterSettings } from "@ocafy/db";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { litterInput } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

export const litterRouter = router({
  update: memberProcedure
    .input(litterInput.partial())
    .mutation(async ({ ctx, input }) => {
      const [cur] = await db
        .select()
        .from(litterSettings)
        .where(eq(litterSettings.householdId, ctx.householdId));

      let min = input.minDays ?? cur?.minDays ?? 5;
      let max = input.maxDays ?? cur?.maxDays ?? 7;
      // Mantém mín ≤ máx: quem foi editado "empurra" o outro.
      if (input.minDays != null && min > max) max = min;
      if (input.maxDays != null && max < min) min = max;

      const values = {
        householdId: ctx.householdId,
        catsCount: input.cats ?? cur?.catsCount ?? 3,
        boxesCount: input.boxes ?? cur?.boxesCount ?? 2,
        kgPerBox: input.kgPerBox ?? cur?.kgPerBox ?? 4,
        bagKg: input.bagKg ?? cur?.bagKg ?? 4,
        minDays: min,
        maxDays: max,
      };
      await db.insert(litterSettings).values(values).onConflictDoUpdate({
        target: litterSettings.householdId,
        set: values,
      });
      return { ok: true };
    }),

  /** Ajuste relativo (+/-) para não perder cliques concorrentes dos dois. */
  adjustStock: memberProcedure
    .input(z.object({ delta: z.number().int().min(-100).max(100) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(litterSettings)
        .values({
          householdId: ctx.householdId,
          stockBags: Math.max(0, input.delta),
        })
        .onConflictDoUpdate({
          target: litterSettings.householdId,
          set: {
            stockBags: sql`greatest(0, coalesce(${litterSettings.stockBags}, 0) + ${input.delta})`,
          },
        });
      return { ok: true };
    }),
});
