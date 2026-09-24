import { calculatePoints, calculateTaskStatus } from "@ocafy/core";
import { completions, db, householdMembers, householdTasks } from "@ocafy/db";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { completeTaskSchema } from "../schemas/index.js";
import { publicProcedure, router } from "../trpc.js";

export const tasksRouter = router({
  list: publicProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .query(async ({ input }) => {
      const tasks = await db.query.householdTasks.findMany({
        where: eq(householdTasks.householdId, input.householdId),
      });

      const allCompletions = await db.query.completions.findMany({
        where: eq(completions.householdId, input.householdId),
        orderBy: [desc(completions.completedAt)],
      });

      const mapped = tasks.map((task: typeof householdTasks.$inferSelect) => {
        const lastComp = allCompletions.find(
          (c: typeof completions.$inferSelect) => c.taskId === task.id,
        );
        const status = calculateTaskStatus(
          task.minDays,
          task.maxDays,
          lastComp ? lastComp.completedAt.toISOString() : null,
        );

        return {
          ...task,
          status,
          lastCompletion: lastComp || null,
        };
      });

      return mapped;
    }),

  complete: publicProcedure
    .input(
      completeTaskSchema.extend({
        householdId: z.string().uuid(),
        memberId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const task = await db.query.householdTasks.findFirst({
        where: and(
          eq(householdTasks.id, input.taskId),
          eq(householdTasks.householdId, input.householdId),
        ),
      });

      if (!task) {
        throw new Error("Tarefa não encontrada");
      }

      const points = calculatePoints(task.mins, false);
      const completedAt = new Date();

      const [completion] = await db
        .insert(completions)
        .values({
          householdId: input.householdId,
          taskId: input.taskId,
          completedBy: input.memberId,
          completedAt,
          pointsAwarded: points,
          note: input.note,
          dateKey: input.date,
        })
        .returning();

      const member = await db.query.householdMembers.findFirst({
        where: eq(householdMembers.id, input.memberId),
      });

      if (member) {
        await db
          .update(householdMembers)
          .set({ totalXp: member.totalXp + points })
          .where(eq(householdMembers.id, input.memberId));
      }

      return { completion, pointsAwarded: points };
    }),
});
