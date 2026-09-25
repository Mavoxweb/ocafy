import { resolveTask } from "@ocafy/core";
import {
  completionReactions,
  completions,
  db,
  householdMembers,
  taskTrades,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { loadPlan } from "../plan";
import { reactionSchema, uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

export const socialRouter = router({
  /** Liga/desliga a reação do membro em uma conclusão da casa. */
  toggleReaction: memberProcedure
    .input(reactionSchema)
    .mutation(async ({ ctx, input }) => {
      const [c] = await db
        .select({ id: completions.id })
        .from(completions)
        .where(
          and(
            eq(completions.id, input.completionId),
            eq(completions.householdId, ctx.householdId),
          ),
        );
      if (!c)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Registro não encontrado.",
        });

      const where = and(
        eq(completionReactions.completionId, input.completionId),
        eq(completionReactions.memberId, ctx.member.id),
        eq(completionReactions.emoji, input.emoji),
      );
      const [existing] = await db
        .select()
        .from(completionReactions)
        .where(where);
      if (existing) {
        await db.delete(completionReactions).where(where);
        return { active: false };
      }
      await db
        .insert(completionReactions)
        .values({
          householdId: ctx.householdId,
          completionId: input.completionId,
          memberId: ctx.member.id,
          emoji: input.emoji,
        })
        .onConflictDoNothing();
      return { active: true };
    }),

  requestTrade: memberProcedure
    .input(
      z.object({
        id: uuid.optional(),
        taskKey: z.string().min(1).max(60),
        /** Adulto que vai ajudar. Opcional quando só há um outro adulto. */
        toMemberId: uuid.optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!resolveTask(await loadPlan(ctx.householdId), input.taskKey)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tarefa desconhecida.",
        });
      }
      const others = await db
        .select({ id: householdMembers.id })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.householdId, ctx.householdId),
            eq(householdMembers.kind, "account"),
            ne(householdMembers.id, ctx.member.id),
          ),
        );
      const other = input.toMemberId
        ? others.find((o) => o.id === input.toMemberId)
        : others.length === 1
          ? others[0]
          : undefined;
      if (input.toMemberId && !other) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escolha um adulto da casa.",
        });
      }
      if (!other && others.length > 1) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Escolha quem vai ajudar.",
        });
      }
      if (!other) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Convide a outra pessoa para pedir ajuda.",
        });
      }
      const [dup] = await db
        .select()
        .from(taskTrades)
        .where(
          and(
            eq(taskTrades.householdId, ctx.householdId),
            eq(taskTrades.taskKey, input.taskKey),
            eq(taskTrades.status, "pending"),
            eq(taskTrades.assigneeId, other.id),
          ),
        );
      if (dup) return { id: dup.id };
      const id = input.id ?? crypto.randomUUID();
      await db
        .insert(taskTrades)
        .values({
          id,
          householdId: ctx.householdId,
          taskKey: input.taskKey,
          requesterId: ctx.member.id,
          assigneeId: other.id,
        })
        .onConflictDoNothing({ target: taskTrades.id });
      return { id };
    }),

  respondTrade: memberProcedure
    .input(z.object({ id: uuid, accept: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [t] = await db
        .select()
        .from(taskTrades)
        .where(
          and(
            eq(taskTrades.id, input.id),
            eq(taskTrades.householdId, ctx.householdId),
          ),
        );
      if (!t)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado.",
        });
      if (t.assigneeId !== ctx.member.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Este pedido não é para você.",
        });
      }
      if (t.status !== "pending") return { ok: true };
      await db
        .update(taskTrades)
        .set({
          status: input.accept ? "accepted" : "rejected",
          resolvedAt: new Date(),
        })
        .where(eq(taskTrades.id, t.id));
      return { ok: true };
    }),
});
