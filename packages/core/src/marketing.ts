/**
 * Marketing interno: avisos e promoções que a equipe programa pelo painel admin, sem deploy.
 * Regra pura de elegibilidade — o servidor monta a lista e o conjunto de "já vistas"; aqui só se
 * decide QUAL campanha (no máximo uma) aparece agora para uma pessoa.
 */

export type CampaignKind = "modal" | "banner";
export type CampaignAudience = "all" | "free" | "plus";

export interface Campaign {
  id: string;
  title: string;
  body: string;
  ctaLabel: string | null;
  ctaUrl: string | null;
  kind: CampaignKind;
  audience: CampaignAudience;
  active: boolean;
  priority: number;
  startsAt: string;
  endsAt: string | null;
  dismissible: boolean;
}

export const CAMPAIGN_TITLE_MAX = 60;
export const CAMPAIGN_BODY_MAX = 280;
export const CAMPAIGN_CTA_MAX = 30;

/** Está dentro da janela de datas e marcada como ativa? */
export function isCampaignLive(c: Campaign, now: Date): boolean {
  if (!c.active) return false;
  if (new Date(c.startsAt) > now) return false;
  if (c.endsAt && new Date(c.endsAt) <= now) return false;
  return true;
}

export const campaignMatchesAudience = (
  c: Campaign,
  plan: "free" | "plus",
): boolean => c.audience === "all" || c.audience === plan;

/**
 * Escolhe a campanha a mostrar agora (a de maior prioridade entre as elegíveis).
 * `seenIds`: campanhas que já satisfizeram a pessoa e não devem voltar — o chamador decide o que
 * conta como "vista" (banner: só quando dispensada; modal: já basta ter sido exibida uma vez).
 */
export function pickCampaign(
  campaigns: Campaign[],
  opts: { now: Date; plan: "free" | "plus"; seenIds: ReadonlySet<string> },
): Campaign | null {
  const eligible = campaigns
    .filter((c) => isCampaignLive(c, opts.now))
    .filter((c) => campaignMatchesAudience(c, opts.plan))
    .filter((c) => !opts.seenIds.has(c.id))
    .sort((a, b) => b.priority - a.priority || (a.id < b.id ? -1 : 1));
  return eligible[0] ?? null;
}

/** Link interno (abre no próprio app) ou externo — só usado para decidir como navegar. */
export const isExternalUrl = (url: string): boolean =>
  /^https?:\/\//i.test(url);
