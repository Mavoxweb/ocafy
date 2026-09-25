import { toMin } from "@ocafy/core";
import { db, memberAbsences, memberSchedule } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, count, eq } from "drizzle-orm";
import { z } from "zod";
import { absenceSchema, dayScheduleSchema, uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

const MAX_ABSENCES = 20;

/** Agenda pessoal do adulto: como é cada dia da semana e ausências longas. */
export const agendaRouter = router({
  setDay: memberProcedure
    .input(dayScheduleSchema)
    .mutation(async ({ ctx, input }) => {
      if (
        input.mode === "partial" &&
        (!input.leave || !input.back || toMin(input.leave) >= toMin(input.back))
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Informe a saída e uma volta depois da saída.",
        });
      }
      const partial = input.mode === "partial";
      const values = {
        householdId: ctx.householdId,
        memberId: ctx.member.id,
        weekday: input.weekday,
        mode: input.mode,
        leaveTime: partial ? input.leave : null,
        backTime: partial ? input.back : null,
      };
      await db
        .insert(memberSchedule)
        .values(values)
        .onConflictDoUpdate({
          target: [memberSchedule.memberId, memberSchedule.weekday],
          set: values,
        });
      return { ok: true };
    }),

  addAbsence: memberProcedure
    .input(absenceSchema)
    .mutation(async ({ ctx, input }) => {
      if (input.from > input.until) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A data final vem depois da inicial.",
        });
      }
      const [{ n }] = await db
        .select({ n: count() })
        .from(memberAbsences)
        .where(eq(memberAbsences.memberId, ctx.member.id));
      if (n >= MAX_ABSENCES) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Muitas ausências cadastradas. Remova as antigas.",
        });
      }
      const [row] = await db
        .insert(memberAbsences)
        .values({
          householdId: ctx.householdId,
          memberId: ctx.member.id,
          fromDate: input.from,
          untilDate: input.until,
          note: input.note || null,
        })
        .returning({ id: memberAbsences.id });
      return { id: row.id };
    }),

  removeAbsence: memberProcedure
    .input(z.object({ id: uuid }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(memberAbsences)
        .where(
          and(
            eq(memberAbsences.id, input.id),
            eq(memberAbsences.memberId, ctx.member.id),
          ),
        );
      return { ok: true };
    }),
});
