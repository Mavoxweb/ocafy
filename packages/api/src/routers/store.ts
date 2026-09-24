import { db, householdMembers, rewardPurchases, storeRewards } from "@ocafy/db";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import {
  buyRewardSchema,
  resolvePurchaseSchema,
  rewardSchema,
} from "../schemas/index.js";
import { publicProcedure, router } from "../trpc.js";

export const storeRouter = router({
  listRewards: publicProcedure
    .input(z.object({ householdId: z.string().uuid() }))
    .query(async ({ input }) => {
      const rewards = await db.query.storeRewards.findMany({
        where: eq(storeRewards.householdId, input.householdId),
      });

      return rewards;
    }),

  addReward: publicProcedure
    .input(rewardSchema.extend({ householdId: z.string().uuid() }))
    .mutation(async ({ input }) => {
      const [reward] = await db
        .insert(storeRewards)
        .values({
          householdId: input.householdId,
          title: input.title,
          costCoins: input.costCoins,
          icon: input.icon,
        })
        .returning();

      return reward;
    }),

  buyReward: publicProcedure
    .input(
      buyRewardSchema.extend({
        householdId: z.string().uuid(),
        memberId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const reward = await db.query.storeRewards.findFirst({
        where: and(
          eq(storeRewards.id, input.rewardId),
          eq(storeRewards.householdId, input.householdId),
        ),
      });

      if (!reward) throw new Error("Recompensa não encontrada");

      const member = await db.query.householdMembers.findFirst({
        where: eq(householdMembers.id, input.memberId),
      });

      if (!member || member.coins < reward.costCoins) {
        throw new Error("Moedas da casa insuficientes");
      }

      // Deduct coins
      await db
        .update(householdMembers)
        .set({ coins: member.coins - reward.costCoins })
        .where(eq(householdMembers.id, input.memberId));

      const [purchase] = await db
        .insert(rewardPurchases)
        .values({
          householdId: input.householdId,
          rewardId: input.rewardId,
          memberId: input.memberId,
          costCoins: reward.costCoins,
          status: "pending",
        })
        .returning();

      return purchase;
    }),

  resolvePurchase: publicProcedure
    .input(
      resolvePurchaseSchema.extend({
        householdId: z.string().uuid(),
      }),
    )
    .mutation(async ({ input }) => {
      const purchase = await db.query.rewardPurchases.findFirst({
        where: and(
          eq(rewardPurchases.id, input.purchaseId),
          eq(rewardPurchases.householdId, input.householdId),
        ),
      });

      if (!purchase) throw new Error("Pedido de compra não encontrado");

      const status = input.approved ? "approved" : "rejected";

      // If rejected, refund coins
      if (!input.approved) {
        const member = await db.query.householdMembers.findFirst({
          where: eq(householdMembers.id, purchase.memberId),
        });
        if (member) {
          await db
            .update(householdMembers)
            .set({ coins: member.coins + purchase.costCoins })
            .where(eq(householdMembers.id, purchase.memberId));
        }
      }

      const [updated] = await db
        .update(rewardPurchases)
        .set({ status, resolvedAt: new Date() })
        .where(eq(rewardPurchases.id, input.purchaseId))
        .returning();

      return updated;
    }),
});
