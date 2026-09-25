import { guessCategory } from "@ocafy/core";
import { db, households, shoppingItems, shoppingTrips } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, count, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { shoppingItemSchema, uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

const MAX_OPEN_ITEMS = 300;

const own = (householdId: string, id: string) =>
  and(eq(shoppingItems.id, id), eq(shoppingItems.householdId, householdId));

/** Lista de compras compartilhada, com urgência e hábito de compra da casa. */
export const shoppingRouter = router({
  add: memberProcedure
    .input(shoppingItemSchema)
    .mutation(async ({ ctx, input }) => {
      const [{ n }] = await db
        .select({ n: count() })
        .from(shoppingItems)
        .where(
          and(
            eq(shoppingItems.householdId, ctx.householdId),
            eq(shoppingItems.status, "open"),
          ),
        );
      if (n >= MAX_OPEN_ITEMS) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A lista está cheia. Conclua ou remova alguns itens.",
        });
      }
      const id = input.id ?? crypto.randomUUID();
      await db
        .insert(shoppingItems)
        .values({
          id,
          householdId: ctx.householdId,
          name: input.name,
          quantity: input.quantity || null,
          category: input.category ?? guessCategory(input.name),
          urgency: input.urgency ?? "soon",
          addedBy: ctx.member.id,
        })
        .onConflictDoNothing({ target: shoppingItems.id });
      return { id };
    }),

  update: memberProcedure
    .input(shoppingItemSchema.partial().extend({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const set = {
        ...(input.name != null ? { name: input.name } : {}),
        ...(input.quantity !== undefined
          ? { quantity: input.quantity || null }
          : {}),
        ...(input.category != null ? { category: input.category } : {}),
        ...(input.urgency != null ? { urgency: input.urgency } : {}),
      };
      if (!Object.keys(set).length) return { ok: true };
      await db
        .update(shoppingItems)
        .set(set)
        .where(own(ctx.householdId, input.id));
      return { ok: true };
    }),

  /** Marca/desmarca como comprado (modo mercado). */
  setBought: memberProcedure
    .input(z.object({ id: uuid, bought: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(shoppingItems)
        .set(
          input.bought
            ? {
                status: "bought",
                boughtBy: ctx.member.id,
                boughtAt: new Date(),
              }
            : { status: "open", boughtBy: null, boughtAt: null },
        )
        .where(own(ctx.householdId, input.id));
      return { ok: true };
    }),

  remove: memberProcedure
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      await db.delete(shoppingItems).where(own(ctx.householdId, input.id));
      return { ok: true };
    }),

  /**
   * "Terminei as compras": registra a ida ao mercado (alimenta o hábito) e limpa da lista
   * o que foi comprado. O que ficou sem marcar continua na lista.
   */
  finishTrip: memberProcedure.mutation(async ({ ctx }) => {
    const bought = await db
      .select({ id: shoppingItems.id })
      .from(shoppingItems)
      .where(
        and(
          eq(shoppingItems.householdId, ctx.householdId),
          eq(shoppingItems.status, "bought"),
        ),
      );
    if (!bought.length) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Marque ao menos um item como comprado.",
      });
    }
    await db.batch([
      db.insert(shoppingTrips).values({
        householdId: ctx.householdId,
        doneBy: ctx.member.id,
        itemsCount: bought.length,
      }),
      db
        .delete(shoppingItems)
        .where(
          and(
            eq(shoppingItems.householdId, ctx.householdId),
            eq(shoppingItems.status, "bought"),
          ),
        ),
    ]);
    return { items: bought.length };
  }),

  /** Hábito de compra: frequência e dia preferido (null = não informado). */
  setHabit: memberProcedure
    .input(
      z.object({
        cadence: z.enum(["weekly", "biweekly", "monthly"]).nullable(),
        day: z.number().int().min(0).max(6).nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await db
        .update(households)
        .set({
          shopCadence: input.cadence,
          shopDay: input.cadence ? input.day : null,
          rev: sql`${households.rev} + 1`,
        })
        .where(eq(households.id, ctx.householdId));
      return { ok: true };
    }),
});
