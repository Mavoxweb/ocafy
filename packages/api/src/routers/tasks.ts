import {
  OFFICE_GOALS,
  bagsPerLitterChange,
  pointsRange,
  resolveTask,
} from "@ocafy/core";
import {
  completions,
  db,
  householdMembers,
  litterSettings,
  officeGoals,
  taskAssignments,
  taskOverrides,
} from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import type { BatchItem } from "drizzle-orm/batch";
import { z } from "zod";
import { loadPlan } from "../plan";
import { assertProfileOfHousehold } from "../roster";
import { completeTaskSchema, uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

type Ops = [BatchItem<"pg">, ...BatchItem<"pg">[]];

const bagsOf = (l: typeof litterSettings.$inferSelect) =>
  bagsPerLitterChange({
    cats: l.catsCount,
    boxes: l.boxesCount,
    kgPerBox: l.kgPerBox,
    bagKg: l.bagKg,
    minDays: l.minDays,
    maxDays: l.maxDays,
    currentStock: l.stockBags ?? 0,
  });

const MAX_BACKDATE_MS = 60 * 24 * 3600 * 1000;

export const tasksRouter = router({
  complete: memberProcedure
    .input(completeTaskSchema)
    .mutation(async ({ ctx, input }) => {
      const task = resolveTask(await loadPlan(ctx.householdId), input.taskKey);
      if (!task)
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta tarefa não faz parte da rotina da sua casa.",
        });

      const at = new Date(input.at);
      const now = Date.now();
      if (
        at.getTime() > now + 5 * 60_000 ||
        at.getTime() < now - MAX_BACKDATE_MS
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Data fora do período permitido (até 60 dias atrás).",
        });
      }

      // O cliente calcula bônus, mas o XP fica dentro da faixa possível da tarefa.
      const range = pointsRange(task.mins);
      const pts = Math.min(range.max, Math.max(range.min, input.pts));
      const id = input.id ?? crypto.randomUUID();
      // O responsável pode registrar por um perfil de criança da própria casa.
      const creditedTo = input.forMemberId
        ? await assertProfileOfHousehold(ctx.householdId, input.forMemberId)
        : ctx.member.id;

      const ops: Ops = [
        db
          .insert(completions)
          .values({
            id,
            householdId: ctx.householdId,
            taskKey: input.taskKey,
            completedBy: creditedTo,
            completedAt: at,
            pointsAwarded: pts,
            note: input.note || null,
            dateKey: input.dateKey,
          })
          .onConflictDoNothing({ target: completions.id }),
      ];

      if (input.taskKey === "area_troca") {
        const [l] = await db
          .select()
          .from(litterSettings)
          .where(eq(litterSettings.householdId, ctx.householdId));
        if (l) {
          ops.push(
            db
              .update(litterSettings)
              .set({
                stockBags: sql`greatest(0, ${litterSettings.stockBags} - ${bagsOf(l)})`,
              })
              .where(
                and(
                  eq(litterSettings.householdId, ctx.householdId),
                  sql`${litterSettings.stockBags} is not null`,
                ),
              ),
          );
        }
      }
      await db.batch(ops);
      return { id, pts };
    }),

  /** Desfazer/apagar um registro (qualquer pessoa da casa). Reverte efeitos colaterais. */
  remove: memberProcedure
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      const [c] = await db
        .select()
        .from(completions)
        .where(
          and(
            eq(completions.id, input.id),
            eq(completions.householdId, ctx.householdId),
          ),
        );
      if (!c) return { ok: true }; // idempotente

      const ops: Ops = [
        db
          .delete(completions)
          .where(
            and(
              eq(completions.id, c.id),
              eq(completions.householdId, ctx.householdId),
            ),
          ),
      ];

      if (c.taskKey === "area_troca") {
        const [l] = await db
          .select()
          .from(litterSettings)
          .where(eq(litterSettings.householdId, ctx.householdId));
        if (l?.stockBags != null) {
          ops.push(
            db
              .update(litterSettings)
              .set({ stockBags: l.stockBags + bagsOf(l) })
              .where(eq(litterSettings.householdId, ctx.householdId)),
          );
        }
      }

      if (c.taskKey === "escritorio") {
        const goal = OFFICE_GOALS.find((g) => g.t === c.note);
        if (goal) {
          ops.push(
            db
              .delete(officeGoals)
              .where(
                and(
                  eq(officeGoals.householdId, ctx.householdId),
                  eq(officeGoals.goalKey, goal.id),
                ),
              ),
          );
        }
      }

      await db.batch(ops);
      return { ok: true };
    }),

  /** Janela de dias (mín/máx) ou pausa de uma tarefa recorrente. */
  setOverride: memberProcedure
    .input(
      z
        .object({
          taskKey: z.string().min(1).max(60),
          min: z.number().int().min(1).max(365).optional(),
          max: z.number().int().min(1).max(365).optional(),
          paused: z.boolean().optional(),
        })
        .refine(
          (v) => (v.min == null) === (v.max == null),
          "Envie mínimo e máximo juntos.",
        )
        .refine(
          (v) => v.min == null || v.max == null || v.min <= v.max,
          "Mínimo maior que o máximo.",
        ),
    )
    .mutation(async ({ ctx, input }) => {
      const task = resolveTask(await loadPlan(ctx.householdId), input.taskKey);
      if (!task?.recurring) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Tarefa não configurável.",
        });
      }
      const set = {
        ...(input.min != null
          ? { minDays: input.min, maxDays: input.max }
          : {}),
        ...(input.paused != null ? { isPaused: input.paused } : {}),
      };
      if (!Object.keys(set).length) return { ok: true };
      await db
        .insert(taskOverrides)
        .values({
          householdId: ctx.householdId,
          taskKey: input.taskKey,
          ...set,
        })
        .onConflictDoUpdate({
          target: [taskOverrides.householdId, taskOverrides.taskKey],
          set,
        });
      return { ok: true };
    }),

  /** Define quem cuida da tarefa (uma pessoa por tarefa; `null` desfaz). */
  assign: memberProcedure
    .input(
      z.object({
        taskKey: z.string().min(1).max(60),
        memberId: uuid.nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (input.memberId === null) {
        await db
          .delete(taskAssignments)
          .where(
            and(
              eq(taskAssignments.householdId, ctx.householdId),
              eq(taskAssignments.taskKey, input.taskKey),
            ),
          );
        return { ok: true };
      }
      const task = resolveTask(await loadPlan(ctx.householdId), input.taskKey);
      if (!task) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Esta tarefa não faz parte da rotina da sua casa.",
        });
      }
      const [member] = await db
        .select({ id: householdMembers.id })
        .from(householdMembers)
        .where(
          and(
            eq(householdMembers.id, input.memberId),
            eq(householdMembers.householdId, ctx.householdId),
          ),
        );
      if (!member) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Pessoa não encontrada nesta casa.",
        });
      }
      await db
        .insert(taskAssignments)
        .values({
          householdId: ctx.householdId,
          taskKey: input.taskKey,
          memberId: member.id,
        })
        .onConflictDoUpdate({
          target: [taskAssignments.householdId, taskAssignments.taskKey],
          set: { memberId: member.id },
        });
      return { ok: true };
    }),
});
