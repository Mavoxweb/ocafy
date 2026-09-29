import { db, marketingCampaigns } from "@ocafy/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { recordCampaignEvent } from "../marketing";
import { uuid } from "../schemas/index";
import { memberProcedure, router } from "../trpc";

/**
 * Marketing interno, lado do app: registra o que a pessoa fez com o aviso que a `snapshot`
 * mandou mostrar (exibido, clicado ou dispensado). Cada tipo de evento é gravado uma vez por
 * pessoa e campanha — repetir a chamada não duplica.
 */
export const campaignRouter = router({
  acknowledge: memberProcedure
    .input(
      z.object({
        id: uuid,
        action: z.enum(["shown", "clicked", "dismissed"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [c] = await db
        .select({ id: marketingCampaigns.id })
        .from(marketingCampaigns)
        .where(eq(marketingCampaigns.id, input.id));
      if (!c) return { ok: true }; // campanha pode ter sido apagada nesse meio-tempo
      await recordCampaignEvent(
        input.id,
        ctx.householdId,
        ctx.member.id,
        input.action,
      );
      return { ok: true };
    }),
});
