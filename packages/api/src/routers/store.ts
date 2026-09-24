import { computeCoins } from "@ocafy/core";
import { completions, db, rewardPurchases, storeRewards } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { rewardSchema, uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

export const storeRouter = router({
  addReward: memberProcedure
    .input(rewardSchema)
    .mutation(async ({ ctx, input }) => {
      const id = input.id ?? crypto.randomUUID();
      await db
        .insert(storeRewards)
        .values({
          id,
          householdId: ctx.householdId,
          title: input.title,
          costCoins: input.costCoins,
          icon: input.icon,
        })
        .onConflictDoNothing({ target: storeRewards.id });
      return { id };
    }),

  /** Pedido de resgate: o saldo é conferido no servidor. */
  buy: memberProcedure
    .input(z.object({ id: uuid.optional(), rewardId: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [reward] = await db
        .select()
        .from(storeRewards)
        .where(
          and(
            eq(storeRewards.id, input.rewardId),
            eq(storeRewards.householdId, ctx.householdId),
          ),
        );
      if (!reward)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Prêmio não encontrado.",
        });

      const [comps, purchases] = await db.batch([
        db
          .select({
            who: completions.completedBy,
            pts: completions.pointsAwarded,
            dateKey: completions.dateKey,
          })
          .from(completions)
          .where(eq(completions.householdId, ctx.householdId)),
        db
          .select({
            memberId: rewardPurchases.memberId,
            costCoins: rewardPurchases.costCoins,
            status: rewardPurchases.status,
          })
          .from(rewardPurchases)
          .where(eq(rewardPurchases.householdId, ctx.householdId)),
      ]);
      const { balance } = computeCoins(comps, purchases, ctx.member.id);
      if (balance < reward.costCoins) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Moedas da casa insuficientes.",
        });
      }

      const id = input.id ?? crypto.randomUUID();
      await db
        .insert(rewardPurchases)
        .values({
          id,
          householdId: ctx.householdId,
          rewardId: reward.id,
          memberId: ctx.member.id,
          costCoins: reward.costCoins,
          status: "pending",
        })
        .onConflictDoNothing({ target: rewardPurchases.id });
      return { id };
    }),

  /** Só a outra pessoa da casa aprova ou recusa (recusar devolve as moedas). */
  resolve: memberProcedure
    .input(z.object({ id: uuid, approved: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const [p] = await db
        .select()
        .from(rewardPurchases)
        .where(
          and(
            eq(rewardPurchases.id, input.id),
            eq(rewardPurchases.householdId, ctx.householdId),
          ),
        );
      if (!p)
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Pedido não encontrado.",
        });
      if (p.memberId === ctx.member.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Quem pediu não pode aprovar o próprio pedido.",
        });
      }
      if (p.status !== "pending") return { ok: true };
      await db
        .update(rewardPurchases)
        .set({
          status: input.approved ? "approved" : "rejected",
          resolvedAt: new Date(),
        })
        .where(eq(rewardPurchases.id, p.id));
      return { ok: true };
    }),
});
