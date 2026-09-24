import { RECURRING_TASKS, ROUTINE_TASKS } from "@ocafy/core";
import {
  db,
  householdMembers,
  householdTasks,
  households,
  invites,
  taskTemplates,
} from "@ocafy/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { createHouseholdSchema } from "../schemas/index.js";
import { publicProcedure, router } from "../trpc.js";

export const householdRouter = router({
  create: publicProcedure
    .input(createHouseholdSchema)
    .mutation(async ({ input, ctx }) => {
      const [newHousehold] = await db
        .insert(households)
        .values({ name: input.name })
        .returning();

      const userId = ctx.userId || "demo-user-id";

      const [member] = await db
        .insert(householdMembers)
        .values({
          householdId: newHousehold.id,
          userId,
          displayName: input.memberName,
          role: "owner",
          color: "#FFB7C5",
        })
        .returning();

      // Seed initial tasks from catalog
      const tasksToInsert = [
        ...ROUTINE_TASKS.map((t) => ({
          householdId: newHousehold.id,
          templateId: t.id,
          title: t.t,
          roomSlug: t.room,
          category: t.cat,
          type: "routine" as const,
          routineType: t.r,
          mins: t.mins,
          minDays: 1,
          maxDays: 1,
        })),
        ...RECURRING_TASKS.map((t) => ({
          householdId: newHousehold.id,
          templateId: t.id,
          title: t.t,
          roomSlug: t.room,
          category: t.cat,
          type: "recurring" as const,
          mins: t.mins,
          minDays: t.min,
          maxDays: t.max,
          suggestedDay: t.day,
        })),
      ];

      await db.insert(householdTasks).values(tasksToInsert);

      return { household: newHousehold, member };
    }),

  getDetails: publicProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .query(async ({ input }) => {
      const household = await db.query.households.findFirst({
        where: eq(households.id, input.householdId),
      });

      const members = await db.query.householdMembers.findMany({
        where: eq(householdMembers.householdId, input.householdId),
      });

      return { household, members };
    }),

  generateInvite: publicProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000); // 7 days

      const [invite] = await db
        .insert(invites)
        .values({
          householdId: input.householdId,
          code,
          expiresAt,
        })
        .returning();

      return invite;
    }),
});
