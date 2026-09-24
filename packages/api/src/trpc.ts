import { db, householdMembers } from "@ocafy/db";
import { TRPCError, initTRPC } from "@trpc/server";
import { eq } from "drizzle-orm";

/** `userId` vem da sessão (Neon Auth), resolvida pelo app que hospeda a API. */
export interface Context {
  userId: string | null;
}

/** Colunas do membro usadas nas procedures (a foto, pesada, fica de fora). */
const memberColumns = {
  id: householdMembers.id,
  householdId: householdMembers.householdId,
  userId: householdMembers.userId,
  displayName: householdMembers.displayName,
  role: householdMembers.role,
  slot: householdMembers.slot,
};

export type Member = {
  [K in keyof typeof memberColumns]: (typeof memberColumns)[K]["_"]["data"];
};

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

export const authedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.userId) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Faça login para continuar.",
    });
  }
  return next({ ctx: { userId: ctx.userId } });
});

/**
 * Toda operação sobre dados da casa passa por aqui: a casa e o membro vêm da
 * sessão, nunca de parâmetros do cliente — o isolamento entre casas depende disso.
 */
export const memberProcedure = authedProcedure.use(async ({ ctx, next }) => {
  const [member] = await db
    .select(memberColumns)
    .from(householdMembers)
    .where(eq(householdMembers.userId, ctx.userId))
    .limit(1);
  if (!member) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "NO_HOUSEHOLD",
    });
  }
  return next({
    ctx: { userId: ctx.userId, member, householdId: member.householdId },
  });
});
