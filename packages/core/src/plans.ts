/**
 * Planos e recursos liberados (entitlements). Regras puras: o servidor decide o que cada casa
 * pode fazer; o app apenas reflete. Nada aqui apaga dados — o que passa do limite continua
 * existindo, só não dá para ADICIONAR mais.
 */

export type PlanId = "free" | "plus";

export interface Entitlements {
  /** Modo Família (3+ pessoas, perfis de criança). */
  family: boolean;
  maxPets: number;
  /** Projetos pessoais ativos (hoje: o Projeto Escritório). */
  maxProjects: number;
}

export const PLAN_ENTITLEMENTS: Record<PlanId, Entitlements> = {
  free: { family: false, maxPets: 1, maxProjects: 1 },
  plus: { family: true, maxPets: 99, maxProjects: 99 },
};

export interface PlanInfo {
  id: PlanId;
  name: string;
  tagline: string;
  features: string[];
}

export const PLANS: Record<PlanId, PlanInfo> = {
  free: {
    id: "free",
    name: "Grátis",
    tagline: "Tudo o que precisa para criar o hábito",
    features: [
      "Modo Solo e Casal",
      "1 pet e 1 projeto pessoal",
      "Rotinas, lista de compras e lembretes",
      "Placar, conquistas e lojinha",
    ],
  },
  plus: {
    id: "plus",
    name: "Plus",
    tagline: "Para casas cheias e rotinas completas",
    features: [
      "Modo Família com perfis de criança",
      "Pets e projetos ilimitados",
      "Tudo do plano Grátis",
      "Apoia o desenvolvimento do Ocafy",
    ],
  },
};

export type BillingInterval = "quarterly" | "yearly";

/** Preços em centavos de real (hipótese do documento de produto; editáveis depois no painel). */
export const PLUS_PRICES: Record<BillingInterval, number> = {
  quarterly: 2490,
  yearly: 7990,
};

export const TRIAL_DAYS = 14;
/** Dias de carência depois de uma falha de pagamento (o Plus continua ativo). */
export const GRACE_DAYS = 7;

export const formatBRL = (cents: number): string =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/* ================= resolução do plano de uma casa ================= */

export type GrantSource = "trial" | "founder" | "manual" | "promo";

/** Liberação concedida à casa (teste, cortesia, ajuste manual do admin…). */
export interface PlanGrant {
  plan: PlanId;
  source: GrantSource;
  startsAt: string;
  /** Nulo = sem prazo. */
  expiresAt: string | null;
  revokedAt: string | null;
  /** Ajustes finos ("liberar 3 pets nesta casa"): números viram o maior; booleanos, "ou". */
  overrides?: Partial<Entitlements> | null;
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "past_due"
  | "canceled"
  | "expired";

export interface SubscriptionState {
  status: SubscriptionStatus;
  currentPeriodEnd: string | null;
  graceUntil: string | null;
}

/** A assinatura dá acesso ao Plus agora? */
export function subscriptionGrantsPlus(
  sub: SubscriptionState | null | undefined,
  now: Date,
): boolean {
  if (!sub) return false;
  const t = now.getTime();
  const end = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).getTime()
    : 0;
  switch (sub.status) {
    case "active":
    case "trialing":
      return end === 0 ? true : end > t;
    case "canceled": // cancelou, mas o que já foi pago vale até o fim do período
      return end > t;
    case "past_due": // falha de pagamento: carência
      return (
        (sub.graceUntil ? new Date(sub.graceUntil).getTime() : 0) > t || end > t
      );
    default:
      return false;
  }
}

export const grantIsActive = (g: PlanGrant, now: Date): boolean => {
  const t = now.getTime();
  return (
    !g.revokedAt &&
    new Date(g.startsAt).getTime() <= t &&
    (!g.expiresAt || new Date(g.expiresAt).getTime() > t)
  );
};

export type PlanSource = "subscription" | GrantSource | null;

export interface ResolvedPlan {
  plan: PlanId;
  /** De onde vem o acesso Plus (null = plano grátis). */
  source: PlanSource;
  /** Quando o acesso Plus atual termina (null = sem prazo ou grátis). */
  expiresAt: string | null;
  /** Em teste? Até quando. */
  trialEndsAt: string | null;
  /** Pagamento falhou e a casa está na carência. */
  pastDue: boolean;
  entitlements: Entitlements;
}

const mergeEntitlements = (
  base: Entitlements,
  over: Partial<Entitlements> | null | undefined,
): Entitlements => ({
  family: base.family || over?.family === true,
  maxPets: Math.max(base.maxPets, over?.maxPets ?? 0),
  maxProjects: Math.max(base.maxProjects, over?.maxProjects ?? 0),
});

/**
 * Plano efetivo da casa. Vale o MELHOR entre a assinatura e as liberações ativas; os ajustes
 * (`overrides`) de qualquer liberação ativa se somam.
 */
export function resolvePlan(
  now: Date,
  grants: PlanGrant[],
  subscription?: SubscriptionState | null,
): ResolvedPlan {
  const active = grants.filter((g) => grantIsActive(g, now));
  const plusGrants = active.filter((g) => g.plan === "plus");
  const subPlus = subscriptionGrantsPlus(subscription, now);

  let ent = PLAN_ENTITLEMENTS.free;
  const isPlus = subPlus || plusGrants.length > 0;
  if (isPlus) ent = PLAN_ENTITLEMENTS.plus;
  for (const g of active) ent = mergeEntitlements(ent, g.overrides);

  // "Fonte" principal: assinatura > cortesia/manual/promo > teste.
  const rank: Record<string, number> = {
    subscription: 5,
    founder: 4,
    manual: 3,
    promo: 2,
    trial: 1,
  };
  let source: PlanSource = null;
  let expiresAt: string | null = null;
  if (subPlus) {
    source = "subscription";
    expiresAt =
      subscription?.status === "past_due"
        ? (subscription.graceUntil ?? subscription.currentPeriodEnd)
        : (subscription?.currentPeriodEnd ?? null);
  }
  for (const g of plusGrants) {
    if (source == null || (rank[g.source] ?? 0) > (rank[source] ?? 0)) {
      source = g.source;
      expiresAt = g.expiresAt;
    }
  }
  const trial = plusGrants
    .filter((g) => g.source === "trial")
    .sort((a, b) => ((a.expiresAt ?? "") < (b.expiresAt ?? "") ? 1 : -1))[0];

  return {
    plan: isPlus ? "plus" : "free",
    source,
    expiresAt,
    trialEndsAt: source === "trial" ? (trial?.expiresAt ?? null) : null,
    pastDue: subscription?.status === "past_due" && subPlus,
    entitlements: ent,
  };
}

/* ================= verificações de limite ================= */

export type PlanViolation = "family" | "pets" | "projects";

export const VIOLATION_MESSAGES: Record<PlanViolation, string> = {
  family: "O modo Família faz parte do plano Plus.",
  pets: "Seu plano permite mais pets só no Plus.",
  projects: "Mais de um projeto pessoal faz parte do plano Plus.",
};

export interface Usage {
  mode: string;
  pets: number;
  projects: number;
}

/**
 * O que o passo de `current` para `next` não pode fazer no plano atual. Só barra AUMENTOS:
 * quem já tem 3 pets (de quando era Plus) continua com 3, mas não adiciona o 4º.
 */
export function planViolations(
  ent: Entitlements,
  current: Usage,
  next: Usage,
): PlanViolation[] {
  const out: PlanViolation[] = [];
  if (next.mode === "family" && current.mode !== "family" && !ent.family)
    out.push("family");
  if (next.pets > ent.maxPets && next.pets > current.pets) out.push("pets");
  if (next.projects > ent.maxProjects && next.projects > current.projects)
    out.push("projects");
  return out;
}

/** Marca de erro que o app reconhece para mostrar o convite ao Plus. */
export const PLAN_LIMIT_PREFIX = "PLAN_LIMIT:";

export const planLimitMessage = (v: PlanViolation): string =>
  `${PLAN_LIMIT_PREFIX}${v}|${VIOLATION_MESSAGES[v]}`;

/** Extrai (violação, texto) de uma mensagem de erro do servidor, se for de limite de plano. */
export function parsePlanLimit(
  message: string | undefined,
): { violation: PlanViolation; text: string } | null {
  if (!message?.startsWith(PLAN_LIMIT_PREFIX)) return null;
  const rest = message.slice(PLAN_LIMIT_PREFIX.length);
  const [violation, ...text] = rest.split("|");
  return { violation: violation as PlanViolation, text: text.join("|") };
}
