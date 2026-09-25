import { db, notificationPrefs, pushSubscriptions } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray } from "drizzle-orm";
import { prefsFromRow } from "../notifications";
import { pushConfigured, sendPush, vapidPublicKey } from "../push";
import { notifPrefsPatch, pushSubscriptionSchema } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

const MAX_DEVICES = 5;

/** Avisos (opt-in): preferências, aparelhos e teste. */
export const notificationsRouter = router({
  /** Liga/desliga e ajusta os tipos de aviso da própria pessoa. */
  setPrefs: memberProcedure
    .input(notifPrefsPatch)
    .mutation(async ({ ctx, input }) => {
      const set = { ...input, updatedAt: new Date() };
      await db
        .insert(notificationPrefs)
        .values({
          householdId: ctx.householdId,
          memberId: ctx.member.id,
          ...set,
        })
        .onConflictDoUpdate({ target: notificationPrefs.memberId, set });
      return { ok: true };
    }),

  /** Registra o aparelho para receber push (assinatura do navegador). */
  subscribe: memberProcedure
    .input(pushSubscriptionSchema)
    .mutation(async ({ ctx, input }) => {
      await db
        .insert(pushSubscriptions)
        .values({
          householdId: ctx.householdId,
          memberId: ctx.member.id,
          endpoint: input.endpoint,
          p256dh: input.p256dh,
          auth: input.auth,
          userAgent: input.userAgent ?? null,
        })
        .onConflictDoUpdate({
          target: pushSubscriptions.endpoint,
          set: {
            householdId: ctx.householdId,
            memberId: ctx.member.id,
            p256dh: input.p256dh,
            auth: input.auth,
            userAgent: input.userAgent ?? null,
            failCount: 0,
          },
        });
      // no máximo 5 aparelhos por pessoa: os mais antigos saem
      const mine = await db
        .select({ id: pushSubscriptions.id })
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.memberId, ctx.member.id))
        .orderBy(asc(pushSubscriptions.createdAt));
      if (mine.length > MAX_DEVICES) {
        await db.delete(pushSubscriptions).where(
          inArray(
            pushSubscriptions.id,
            mine.slice(0, mine.length - MAX_DEVICES).map((m) => m.id),
          ),
        );
      }
      return { ok: true };
    }),

  unsubscribe: memberProcedure
    .input(pushSubscriptionSchema.pick({ endpoint: true }))
    .mutation(async ({ ctx, input }) => {
      await db
        .delete(pushSubscriptions)
        .where(
          and(
            eq(pushSubscriptions.endpoint, input.endpoint),
            eq(pushSubscriptions.memberId, ctx.member.id),
          ),
        );
      return { ok: true };
    }),

  /** Envia um aviso de teste aos aparelhos da própria pessoa. */
  sendTest: memberProcedure.mutation(async ({ ctx }) => {
    if (!pushConfigured()) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Os avisos ainda não estão ligados neste servidor.",
      });
    }
    const subs = await db
      .select()
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.memberId, ctx.member.id));
    if (!subs.length) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "Nenhum aparelho registrado. Ative os avisos neste aparelho.",
      });
    }
    let sent = 0;
    const gone: string[] = [];
    for (const s of subs) {
      const r = await sendPush(s, {
        title: "Ocafy: tudo certo por aqui",
        body: "Os avisos deste aparelho estão funcionando.",
        url: "/lembretes",
        tag: "test",
      });
      if (r.ok) sent++;
      else if (r.gone) gone.push(s.id);
    }
    if (gone.length)
      await db
        .delete(pushSubscriptions)
        .where(inArray(pushSubscriptions.id, gone));
    return { sent, total: subs.length };
  }),

  /** Chave pública para o navegador assinar (nula = servidor sem push). */
  config: memberProcedure.query(async ({ ctx }) => {
    const [row] = await db
      .select()
      .from(notificationPrefs)
      .where(eq(notificationPrefs.memberId, ctx.member.id));
    return {
      publicKey: vapidPublicKey(),
      prefs: prefsFromRow(row),
    };
  }),
});
