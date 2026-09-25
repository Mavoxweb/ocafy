import { dataRequests, db } from "@ocafy/db";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { exportAccountData, openDataRequest } from "../lgpd";
import { authedProcedure, router } from "../trpc";

/**
 * Direitos do titular (LGPD), em autoatendimento:
 *  - exportar: a cópia dos dados sai na hora (e fica registrada como pedido concluído);
 *  - excluir: abre um pedido para a equipe executar em até 15 dias (vale para a conta toda).
 */
export const accountRouter = router({
  /** Cópia dos meus dados (JSON). Registra o pedido como concluído. */
  exportMyData: authedProcedure.mutation(async ({ ctx }) => {
    const data = await exportAccountData(ctx.userId);
    const req = await openDataRequest(ctx.userId, "export");
    await db
      .update(dataRequests)
      .set({
        status: "done",
        completedAt: new Date(),
        handledBy: "autoatendimento",
        evidence: `Exportação gerada pelo próprio titular em ${new Date().toISOString()}`,
      })
      .where(eq(dataRequests.id, req.id));
    return {
      filename: `ocafy-meus-dados-${new Date().toISOString().slice(0, 10)}.json`,
      data,
    };
  }),

  /** Pede a exclusão da conta e dos dados. A equipe confirma e executa. */
  requestDeletion: authedProcedure
    .input(z.object({ note: z.string().trim().max(300).optional() }))
    .mutation(async ({ ctx, input }) => {
      const r = await openDataRequest(ctx.userId, "delete", input.note);
      return {
        id: r.id,
        status: r.status,
        dueAt: r.dueAt.toISOString(),
      };
    }),

  myRequests: authedProcedure.query(async ({ ctx }) => {
    const rows = await db
      .select()
      .from(dataRequests)
      .where(eq(dataRequests.userId, ctx.userId))
      .orderBy(desc(dataRequests.requestedAt))
      .limit(10);
    return rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      status: r.status,
      requestedAt: r.requestedAt.toISOString(),
      dueAt: r.dueAt.toISOString(),
      completedAt: r.completedAt?.toISOString() ?? null,
    }));
  }),
});
