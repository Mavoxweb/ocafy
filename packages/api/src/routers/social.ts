import { completionReactions, completions, db, taskTrades } from "@ocafy/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { reactionSchema, tradeSchema } from "../schemas/index.js";
import { publicProcedure, router } from "../trpc.js";

export const socialRouter = router({
  addReaction: publicProcedure
    .input(
      reactionSchema.extend({
        householdId: z.string().uuid(),
        memberId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const [reaction] = await db
        .insert(completionReactions)
        .values({
          householdId: input.householdId,
          completionId: input.completionId,
          memberId: input.memberId,
          emoji: input.emoji,
        })
        .returning();

      return reaction;
    }),

  requestTrade: publicProcedure
    .input(
      tradeSchema.extend({
        householdId: z.string().uuid(),
        requesterId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const [trade] = await db
        .insert(taskTrades)
        .values({
          householdId: input.householdId,
          taskId: input.taskId,
          requesterId: input.requesterId,
          assigneeId: input.assigneeId,
          status: "pending",
        })
        .returning();

      return trade;
    }),

  respondTrade: publicProcedure
    .input(
      z.object({
        tradeId: z.string().uuid(),
        householdId: z.string().uuid(),
        accept: z.boolean(),
      }),
    )
    .mutation(async ({ input }) => {
      const status = input.accept ? "accepted" : "rejected";

      const [updated] = await db
        .update(taskTrades)
        .set({ status, resolvedAt: new Date() })
        .where(
          and(
            eq(taskTrades.id, input.tradeId),
            eq(taskTrades.householdId, input.householdId),
          ),
        )
        .returning();

      return updated;
    }),
});
