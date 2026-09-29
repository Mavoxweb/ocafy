import {
  type Campaign,
  type CampaignAudience,
  type CampaignKind,
  pickCampaign,
} from "@ocafy/core";
import {
  db,
  households,
  marketingCampaignEvents,
  marketingCampaigns,
} from "@ocafy/db";
import { desc, eq, sql } from "drizzle-orm";

/**
 * Marketing interno: qual campanha (no máximo uma) uma pessoa vê agora, e o registro de
 * exibição/clique/dispensa que decide se ela volta a aparecer. Tudo calculado no servidor —
 * o app só mostra o que a `snapshot` manda.
 */

type CampaignRow = typeof marketingCampaigns.$inferSelect;

export const campaignOf = (r: CampaignRow): Campaign => ({
  id: r.id,
  title: r.title,
  body: r.body,
  ctaLabel: r.ctaLabel,
  ctaUrl: r.ctaUrl,
  kind: r.kind,
  audience: r.audience,
  active: r.active,
  priority: r.priority,
  startsAt: r.startsAt.toISOString(),
  endsAt: r.endsAt?.toISOString() ?? null,
  dismissible: r.dismissible,
});

/**
 * Campanha a mostrar para esta pessoa agora (ou null). Um "banner" sai da lista quando dispensado
 * ou quando a pessoa clica no botão (já agiu, não precisa insistir); um "modal" já sai assim que
 * foi mostrado uma vez (não fica reaparecendo a cada atualização da tela).
 */
export async function pickCampaignFor(
  memberId: string,
  plan: "free" | "plus",
  now = new Date(),
): Promise<Campaign | null> {
  const [rows, events] = await Promise.all([
    db
      .select()
      .from(marketingCampaigns)
      .where(eq(marketingCampaigns.active, true)),
    db
      .select({
        campaignId: marketingCampaignEvents.campaignId,
        kind: marketingCampaignEvents.kind,
      })
      .from(marketingCampaignEvents)
      .where(eq(marketingCampaignEvents.memberId, memberId)),
  ]);
  if (!rows.length) return null;
  const campaigns = rows.map(campaignOf);
  const kindOf = new Map(campaigns.map((c) => [c.id, c.kind]));
  const seenIds = new Set(
    events
      .filter(
        (e) =>
          e.kind === "dismissed" ||
          e.kind === "clicked" ||
          (e.kind === "shown" && kindOf.get(e.campaignId) === "modal"),
      )
      .map((e) => e.campaignId),
  );
  return pickCampaign(campaigns, { now, plan, seenIds });
}

/**
 * Registra o efeito de uma campanha (exibida/clicada/dispensada) para esta pessoa. Uma pessoa
 * conta uma vez por tipo de evento: repetir a chamada (ex.: "shown" a cada nova aba) não duplica
 * nem infla as estatísticas.
 */
export async function recordCampaignEvent(
  campaignId: string,
  householdId: string,
  memberId: string,
  kind: "shown" | "clicked" | "dismissed",
): Promise<void> {
  await db
    .insert(marketingCampaignEvents)
    .values({ campaignId, householdId, memberId, kind })
    .onConflictDoNothing();
}

/** Bump manual do `rev` de todas as casas: uma mudança de campanha vale para todo mundo na hora. */
export async function bumpAllHouseholds(): Promise<void> {
  await db.update(households).set({ rev: sql`${households.rev} + 1` });
}

export interface CampaignStats {
  shown: number;
  clicked: number;
  dismissed: number;
}

export async function campaignStats(
  campaignId: string,
): Promise<CampaignStats> {
  const rows = await db
    .select({
      kind: marketingCampaignEvents.kind,
      n: sql<number>`count(*)`,
    })
    .from(marketingCampaignEvents)
    .where(eq(marketingCampaignEvents.campaignId, campaignId))
    .groupBy(marketingCampaignEvents.kind);
  const by = Object.fromEntries(rows.map((r) => [r.kind, Number(r.n)]));
  return {
    shown: by.shown ?? 0,
    clicked: by.clicked ?? 0,
    dismissed: by.dismissed ?? 0,
  };
}

export async function getCampaign(id: string) {
  const [row] = await db
    .select()
    .from(marketingCampaigns)
    .where(eq(marketingCampaigns.id, id));
  return row ?? null;
}

export async function listCampaignsWithStats() {
  const rows = await db
    .select()
    .from(marketingCampaigns)
    .orderBy(desc(marketingCampaigns.createdAt));
  const stats = await Promise.all(rows.map((r) => campaignStats(r.id)));
  return rows.map((r, i) => ({ campaign: r, stats: stats[i] }));
}

export interface CampaignInput {
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  kind: CampaignKind;
  audience: CampaignAudience;
  priority: number;
  startsAt: Date;
  endsAt: Date | null;
  dismissible: boolean;
}

export async function createCampaign(input: CampaignInput, createdBy: string) {
  const [row] = await db
    .insert(marketingCampaigns)
    .values({ ...input, active: false, createdBy })
    .returning();
  return row;
}

export async function updateCampaign(
  id: string,
  input: Partial<CampaignInput>,
) {
  const [row] = await db
    .update(marketingCampaigns)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(marketingCampaigns.id, id))
    .returning();
  return row;
}

export async function setCampaignActive(id: string, active: boolean) {
  const [row] = await db
    .update(marketingCampaigns)
    .set({ active, updatedAt: new Date() })
    .where(eq(marketingCampaigns.id, id))
    .returning();
  return row;
}

export async function deleteCampaignIfUnused(id: string): Promise<boolean> {
  const [{ n }] = await db
    .select({ n: sql<number>`count(*)` })
    .from(marketingCampaignEvents)
    .where(eq(marketingCampaignEvents.campaignId, id));
  if (Number(n) > 0) return false;
  await db.delete(marketingCampaigns).where(eq(marketingCampaigns.id, id));
  return true;
}
