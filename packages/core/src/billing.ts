import {
  type BillingInterval,
  GRACE_DAYS,
  type SubscriptionStatus,
} from "./plans";

/**
 * Assinatura: eventos dos provedores (Cakto na web, Google Play via RevenueCat no Android) são
 * normalizados para um formato único e aplicados por uma máquina de estados pura. Assim a regra
 * de negócio (carência, cancelamento, reembolso) é a mesma para qualquer provedor e é testável
 * sem rede.
 */

export type BillingProvider = "cakto" | "play" | "manual";

export type BillingEventType =
  | "activated" // primeira compra aprovada
  | "renewed" // renovação paga
  | "payment_failed" // cobrança recusada
  | "canceled" // cancelou (vale até o fim do período pago)
  | "expired" // acabou de vez
  | "refunded" // reembolso: perde o acesso na hora
  | "chargeback" // contestação: perde o acesso na hora
  | "ignored"; // evento que não muda a assinatura (ex.: Pix gerado)

export interface NormalizedBillingEvent {
  provider: BillingProvider;
  /** Único por provedor: o mesmo evento chegando duas vezes é descartado. */
  eventId: string;
  type: BillingEventType;
  /** Id da assinatura no provedor (chave da assinatura no nosso banco). */
  providerRef: string;
  /** Casa a que a compra pertence (o `ref` enviado no link de pagamento / app_user_id). */
  householdRef: string | null;
  interval: BillingInterval | "monthly" | null;
  /** Fim do período pago informado pelo provedor (se souber). */
  periodEnd: string | null;
  payerEmail: string | null;
  occurredAt: string;
  /** Tipo original do evento (para log e suporte). */
  rawType: string;
}

export interface SubscriptionSnapshot {
  status: SubscriptionStatus;
  interval: BillingInterval | "monthly";
  currentPeriodEnd: string | null;
  graceUntil: string | null;
  cancelAtPeriodEnd: boolean;
}

const DAY = 86_400_000;

export const INTERVAL_DAYS: Record<BillingInterval | "monthly", number> = {
  monthly: 31,
  quarterly: 92,
  yearly: 366,
};

const plus = (iso: string | Date, days: number): string =>
  new Date(new Date(iso).getTime() + days * DAY).toISOString();

/**
 * Aplica um evento ao estado atual. Regras:
 *  - pago (ativação/renovação): ativa e estende o período; limpa carência e cancelamento;
 *  - falha de pagamento: carência de GRACE_DAYS a partir da PRIMEIRA falha (repetições não
 *    estendem a carência);
 *  - cancelamento: mantém o acesso até o fim do período já pago;
 *  - reembolso/contestação/expiração: acesso encerrado.
 */
export function applyBillingEvent(
  prev: SubscriptionSnapshot | null,
  ev: NormalizedBillingEvent,
  now: Date,
): SubscriptionSnapshot {
  const interval = ev.interval ?? prev?.interval ?? "quarterly";
  const base: SubscriptionSnapshot = prev ?? {
    status: "expired",
    interval,
    currentPeriodEnd: null,
    graceUntil: null,
    cancelAtPeriodEnd: false,
  };

  switch (ev.type) {
    case "activated":
    case "renewed": {
      // Não deixa um evento atrasado/repetido encolher um período já estendido.
      const from =
        prev?.currentPeriodEnd && new Date(prev.currentPeriodEnd) > now
          ? prev.currentPeriodEnd
          : now.toISOString();
      const computed = plus(from, INTERVAL_DAYS[interval]);
      const end =
        ev.periodEnd && new Date(ev.periodEnd) > now ? ev.periodEnd : computed;
      const keep =
        prev?.currentPeriodEnd &&
        new Date(prev.currentPeriodEnd) > new Date(end)
          ? prev.currentPeriodEnd
          : end;
      return {
        status: "active",
        interval,
        currentPeriodEnd: keep,
        graceUntil: null,
        cancelAtPeriodEnd: false,
      };
    }
    case "payment_failed": {
      const already = prev?.status === "past_due" && prev.graceUntil;
      return {
        ...base,
        interval,
        status: "past_due",
        graceUntil: already ? prev.graceUntil : plus(now, GRACE_DAYS),
      };
    }
    case "canceled":
      return {
        ...base,
        interval,
        status: "canceled",
        cancelAtPeriodEnd: true,
        graceUntil: null,
      };
    case "expired":
    case "refunded":
    case "chargeback":
      return {
        ...base,
        interval,
        status: "expired",
        currentPeriodEnd:
          ev.type === "expired"
            ? (base.currentPeriodEnd ?? null)
            : now.toISOString(),
        graceUntil: null,
        cancelAtPeriodEnd: base.cancelAtPeriodEnd,
      };
    default:
      return base;
  }
}

/**
 * Passo do aviso de cobrança que já deveria ter sido enviado (0 = nenhum ainda):
 *   1 = no dia da falha · 2 = dia 3 · 3 = último dia (dia 6, véspera do fim da carência).
 */
export function dunningStepDue(graceUntil: string | null, now: Date): number {
  if (!graceUntil) return 0;
  const since =
    (now.getTime() - new Date(graceUntil).getTime()) / DAY + GRACE_DAYS;
  if (since < 0) return 0;
  return since >= GRACE_DAYS - 1 ? 3 : since >= 3 ? 2 : 1;
}

/** Depois de quantos dias sem evento uma assinatura "ativa" vencida é dada como expirada. */
export const STALE_ACTIVE_DAYS = 3;

/** Assinatura que segue "ativa/cancelada/em atraso" mas já passou do prazo: hora de expirar. */
export function shouldExpire(
  sub: Pick<SubscriptionSnapshot, "status" | "currentPeriodEnd" | "graceUntil">,
  now: Date,
): boolean {
  const t = now.getTime();
  const end = sub.currentPeriodEnd
    ? new Date(sub.currentPeriodEnd).getTime()
    : null;
  const grace = sub.graceUntil ? new Date(sub.graceUntil).getTime() : null;
  switch (sub.status) {
    case "past_due":
      return (grace ?? 0) <= t && (end ?? 0) <= t;
    case "canceled":
      return end != null && end <= t;
    case "active":
    case "trialing":
      return end != null && end + STALE_ACTIVE_DAYS * DAY <= t;
    default:
      return false;
  }
}

/* ================= adaptadores de provedores ================= */

type Json = Record<string, unknown>;
const obj = (v: unknown): Json =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : {};
const str = (v: unknown): string | null =>
  typeof v === "string" && v.trim()
    ? v.trim()
    : typeof v === "number"
      ? String(v)
      : null;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Procura o id da casa (uuid) nos campos onde o provedor devolve o que enviamos no link. */
function findHouseholdRef(root: Json, keys: string[]): string | null {
  const seen = new Set<unknown>();
  const walk = (node: unknown, depth: number): string | null => {
    if (depth > 4 || !node || typeof node !== "object" || seen.has(node))
      return null;
    seen.add(node);
    for (const [k, v] of Object.entries(node as Json)) {
      if (
        keys.includes(k.toLowerCase()) &&
        typeof v === "string" &&
        UUID_RE.test(v.trim())
      )
        return v.trim().toLowerCase();
    }
    for (const v of Object.values(node as Json)) {
      const r = walk(v, depth + 1);
      if (r) return r;
    }
    return null;
  };
  return walk(root, 0);
}

const guessInterval = (raw: unknown): BillingInterval | "monthly" | null => {
  const s = String(raw ?? "").toLowerCase();
  if (/year|anual|annual|12/.test(s)) return "yearly";
  if (/quarter|trimest|tri|3/.test(s)) return "quarterly";
  if (/month|mensal|1\b/.test(s)) return "monthly";
  return null;
};

const CAKTO_EVENTS: Record<string, BillingEventType> = {
  purchase_approved: "activated",
  subscription_created: "activated",
  subscription_renewed: "renewed",
  subscription_renewal_refused: "payment_failed",
  subscription_canceled: "canceled",
  subscription_expired: "expired",
  refund: "refunded",
  chargeback: "chargeback",
};

/**
 * Cakto (web). ATENÇÃO: o formato foi montado a partir da documentação pública e é tolerante
 * a variações; valide contra um webhook real de teste antes de ligar em produção.
 * Esperado: { secret, event, data: { id, refId, customer: { email }, offer/subscription: {...} } }
 * O `ref` do link de pagamento (id da casa) deve voltar em algum campo `ref`/`refid`/`sck`/`src`/`utm_*`.
 */
export function parseCaktoEvent(
  payload: unknown,
): NormalizedBillingEvent | null {
  const root = obj(payload);
  const rawType = str(root.event) ?? str(root.type);
  if (!rawType) return null;
  const data = obj(root.data);
  const sub = obj(data.subscription);
  const customer = obj(data.customer);
  const type = CAKTO_EVENTS[rawType] ?? "ignored";
  const ref =
    str(sub.id) ?? str(data.subscriptionId) ?? str(data.refId) ?? str(data.id);
  const eventId = `${str(data.id) ?? str(root.id) ?? ref ?? "?"}:${rawType}:${
    str(sub.next_payment_date) ?? str(data.paidAt) ?? str(data.createdAt) ?? ""
  }`;
  const nextDate = str(sub.next_payment_date) ?? str(sub.nextPaymentDate);
  return {
    provider: "cakto",
    eventId,
    type,
    providerRef: ref ?? eventId,
    householdRef: findHouseholdRef(root, [
      "ref",
      "refid",
      "sck",
      "src",
      "household_id",
      "householdid",
      "utm_content",
      "utm_term",
      "utm_campaign",
    ]),
    interval: guessInterval(
      sub.recurrence_period ??
        sub.recurrencePeriod ??
        obj(data.offer).name ??
        obj(data.offer).type,
    ),
    periodEnd:
      nextDate && !Number.isNaN(Date.parse(nextDate))
        ? new Date(nextDate).toISOString()
        : null,
    payerEmail: str(customer.email)?.toLowerCase() ?? null,
    occurredAt: new Date().toISOString(),
    rawType,
  };
}

const RC_EVENTS: Record<string, BillingEventType> = {
  INITIAL_PURCHASE: "activated",
  RENEWAL: "renewed",
  UNCANCELLATION: "renewed",
  PRODUCT_CHANGE: "renewed",
  CANCELLATION: "canceled",
  EXPIRATION: "expired",
  BILLING_ISSUE: "payment_failed",
};

/**
 * Google Play via RevenueCat. Formato documentado: { api_version, event: { id, type, app_user_id,
 * original_app_user_id, product_id, expiration_at_ms, event_timestamp_ms, ... } }. Configure o
 * `app_user_id` do RevenueCat como o id da casa.
 */
export function parseRevenueCatEvent(
  payload: unknown,
): NormalizedBillingEvent | null {
  const ev = obj(obj(payload).event);
  const rawType = str(ev.type);
  const id = str(ev.id);
  if (!rawType || !id) return null;
  const app = str(ev.app_user_id) ?? str(ev.original_app_user_id);
  const exp =
    typeof ev.expiration_at_ms === "number" ? ev.expiration_at_ms : null;
  const ts =
    typeof ev.event_timestamp_ms === "number" ? ev.event_timestamp_ms : null;
  return {
    provider: "play",
    eventId: id,
    type: RC_EVENTS[rawType] ?? "ignored",
    providerRef: str(ev.original_app_user_id) ?? app ?? id,
    householdRef: app && UUID_RE.test(app) ? app.toLowerCase() : null,
    interval: guessInterval(ev.product_id),
    periodEnd: exp ? new Date(exp).toISOString() : null,
    payerEmail: null,
    occurredAt: new Date(ts ?? Date.now()).toISOString(),
    rawType,
  };
}
