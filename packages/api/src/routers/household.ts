import { randomInt, randomUUID } from "node:crypto";
import { DEFAULT_REWARDS } from "@ocafy/core";
import {
  db,
  householdMembers,
  households,
  invites,
  litterSettings,
  rooms,
  storeRewards,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { z } from "zod";
import { createHouseholdSchema, joinSchema, roomId } from "../schemas/index";
import { loadSnapshot } from "../snapshot";
import { authedProcedure, memberProcedure, router } from "../trpc";

// Sem 0/O/1/I para o código ser fácil de ditar.
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const newCode = () =>
  Array.from(
    { length: 8 },
    () => CODE_CHARS[randomInt(CODE_CHARS.length)],
  ).join("");

const isUniqueViolation = (e: unknown) =>
  typeof e === "object" &&
  e !== null &&
  ("code" in e ? (e as { code?: string }).code === "23505" : false);

const cause = (e: unknown) => (e as { cause?: unknown } | null)?.cause ?? e;

export const householdRouter = router({
  /** Estado completo da casa (ou `none` se a conta ainda não tem casa). */
  snapshot: authedProcedure.query(async ({ ctx }) => {
    const [member] = await db
      .select()
      .from(householdMembers)
      .where(eq(householdMembers.userId, ctx.userId))
      .limit(1);
    if (!member) return { status: "none" as const };
    return { status: "ready" as const, data: await loadSnapshot(member) };
  }),

  create: authedProcedure
    .input(createHouseholdSchema)
    .mutation(async ({ ctx, input }) => {
      const householdId = randomUUID();
      const roomSlugs = Array.from(new Set([...input.rooms, "casa" as const]));
      try {
        await db.batch([
          db
            .insert(households)
            .values({ id: householdId, name: input.houseName }),
          db.insert(householdMembers).values({
            householdId,
            userId: ctx.userId,
            displayName: input.memberName,
            role: "owner",
            slot: "a",
          }),
          db
            .insert(rooms)
            .values(roomSlugs.map((slug) => ({ householdId, slug }))),
          db.insert(litterSettings).values({
            householdId,
            catsCount: input.litter.cats,
            boxesCount: input.litter.boxes,
            kgPerBox: input.litter.kgPerBox,
            bagKg: input.litter.bagKg,
            minDays: input.litter.minDays,
            maxDays: Math.max(input.litter.minDays, input.litter.maxDays),
            stockBags: input.litterStock,
          }),
          db
            .insert(storeRewards)
            .values(DEFAULT_REWARDS.map((r) => ({ ...r, householdId }))),
        ]);
      } catch (e) {
        if (isUniqueViolation(cause(e))) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Esta conta já tem uma casa.",
          });
        }
        throw e;
      }
      return { householdId };
    }),

  join: authedProcedure.input(joinSchema).mutation(async ({ ctx, input }) => {
    const code = input.code.toUpperCase().replace(/\s/g, "");
    const [invite] = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.code, code),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (!invite) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Convite inválido ou expirado.",
      });
    }
    const [{ n }] = await db
      .select({ n: count() })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, invite.householdId));
    if (n >= 2) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "Esta casa já tem duas pessoas.",
      });
    }
    try {
      await db.batch([
        db.insert(householdMembers).values({
          householdId: invite.householdId,
          userId: ctx.userId,
          displayName: input.memberName,
          role: "member",
          slot: "b",
        }),
        db
          .update(invites)
          .set({ usedAt: new Date() })
          .where(eq(invites.id, invite.id)),
      ]);
    } catch (e) {
      if (isUniqueViolation(cause(e))) {
        throw new TRPCError({
          code: "CONFLICT",
          message:
            "Não foi possível entrar nesta casa (conta já vinculada ou casa cheia).",
        });
      }
      throw e;
    }
    return { householdId: invite.householdId };
  }),

  /** Reaproveita o convite ativo ou gera um novo (7 dias). */
  createInvite: memberProcedure.mutation(async ({ ctx }) => {
    const [{ n }] = await db
      .select({ n: count() })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, ctx.householdId));
    if (n >= 2) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A casa já tem duas pessoas.",
      });
    }
    const [active] = await db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.householdId, ctx.householdId),
          isNull(invites.usedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .limit(1);
    if (active)
      return { code: active.code, expiresAt: active.expiresAt.toISOString() };
    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000);
    const [created] = await db
      .insert(invites)
      .values({ householdId: ctx.householdId, code: newCode(), expiresAt })
      .returning();
    return { code: created.code, expiresAt: created.expiresAt.toISOString() };
  }),

  rename: memberProcedure
    .input(z.object({ name: z.string().trim().min(2).max(24) }))
    .mutation(async ({ ctx, input }) => {
      await db
        .update(householdMembers)
        .set({ displayName: input.name })
        .where(eq(householdMembers.id, ctx.member.id));
      return { ok: true };
    }),

  setRooms: memberProcedure
    .input(z.object({ rooms: z.array(roomId).max(8) }))
    .mutation(async ({ ctx, input }) => {
      const slugs = Array.from(new Set([...input.rooms, "casa" as const]));
      await db.batch([
        db.delete(rooms).where(eq(rooms.householdId, ctx.householdId)),
        db
          .insert(rooms)
          .values(
            slugs.map((slug) => ({ householdId: ctx.householdId, slug })),
          ),
      ]);
      return { ok: true };
    }),

  /** Apaga a casa inteira (todos os dados, dos dois). Só quem criou. */
  delete: memberProcedure.mutation(async ({ ctx }) => {
    if (ctx.member.role !== "owner") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Só quem criou a casa pode apagá-la.",
      });
    }
    await db.delete(households).where(eq(households.id, ctx.householdId));
    return { ok: true };
  }),
});
