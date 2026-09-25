/**
 * Lista de compras: urgência, categorias e o hábito de compra da casa (semanal, quinzenal, mensal).
 * Funções puras; o servidor e o app usam as mesmas regras.
 */

export type ShopUrgency = "now" | "soon" | "later";
export type ShopCadence = "weekly" | "biweekly" | "monthly";

export const URGENCY_ORDER: ShopUrgency[] = ["now", "soon", "later"];

export const URGENCY_LABELS: Record<
  ShopUrgency,
  { name: string; hint: string }
> = {
  now: { name: "Urgente", hint: "Acabou — preciso já" },
  soon: { name: "Próxima ida", hint: "Entra nas próximas compras" },
  later: { name: "Quando der", hint: "Sem pressa" },
};

export const CADENCE_DAYS: Record<ShopCadence, number> = {
  weekly: 7,
  biweekly: 14,
  monthly: 30,
};

export const CADENCE_LABELS: Record<ShopCadence, string> = {
  weekly: "Toda semana",
  biweekly: "A cada 15 dias",
  monthly: "Uma vez por mês",
};

export const SHOP_CATEGORIES = [
  "Hortifruti",
  "Açougue e peixaria",
  "Padaria",
  "Laticínios e frios",
  "Mercearia",
  "Bebidas",
  "Limpeza",
  "Higiene",
  "Pets",
  "Outros",
] as const;
export type ShopCategory = (typeof SHOP_CATEGORIES)[number];

const KEYWORDS: [ShopCategory, RegExp][] = [
  [
    "Hortifruti",
    /\b(alface|tomate|cebola|alho|batata|cenoura|banana|ma[cç][aã]|laranja|lim[aã]o|fruta|verdura|legume|br[oó]colis|abacate|mam[aã]o|uva|morango|couve|pepino)/i,
  ],
  [
    "Açougue e peixaria",
    /\b(frango|carne|bife|file|filé|peixe|salm[aã]o|lingui[cç]a|hamb[uú]rguer|patinho|contra|costela|camar[aã]o|sardinha)/i,
  ],
  ["Padaria", /\b(p[aã]o|bolo|biscoito|torrada|bisnaga)/i],
  [
    "Laticínios e frios",
    /\b(leite|queijo|iogurte|manteiga|requeij[aã]o|presunto|ovo|ovos|creme de leite)/i,
  ],
  [
    "Mercearia",
    /\b(arroz|feij[aã]o|macarr[aã]o|farinha|a[cç][uú]car|caf[eé]|sal|[oó]leo|azeite|molho|atum|milho|aveia|cereal|massa)/i,
  ],
  ["Bebidas", /\b(suco|refrigerante|cerveja|vinho|[aá]gua|chá|cha)\b/i],
  [
    "Limpeza",
    /\b(detergente|sab[aã]o em p[oó]|amaciante|desinfetante|[aá]gua sanit[aá]ria|esponja|papel toalha|saco de lixo|multiuso|cloro|limpa)/i,
  ],
  [
    "Higiene",
    /\b(papel higi[eê]nico|shampoo|condicionador|sabonete|pasta de dente|escova|desodorante|absorvente|fralda)/i,
  ],
  ["Pets", /\b(ra[cç][aã]o|areia|sach[eê]|petisco|coleira)/i],
];

/** Palpite de categoria pelo nome do item (o usuário pode trocar). */
export function guessCategory(name: string): ShopCategory {
  for (const [cat, re] of KEYWORDS) if (re.test(name)) return cat;
  return "Outros";
}

/** Urgentes primeiro, depois próxima ida, depois "quando der"; dentro de cada grupo, os mais antigos antes. */
export function sortShopping<
  T extends { urgency: ShopUrgency; createdAt: string },
>(items: T[]): T[] {
  return [...items].sort(
    (a, b) =>
      URGENCY_ORDER.indexOf(a.urgency) - URGENCY_ORDER.indexOf(b.urgency) ||
      (a.createdAt < b.createdAt ? -1 : 1),
  );
}

const DAY_MS = 24 * 3600 * 1000;

/**
 * Hábito observado: com 3 idas ou mais, o intervalo médio (em dias) vira a sugestão
 * de cadência (< 10 dias → semanal; < 22 → quinzenal; senão mensal).
 */
export function inferCadence(tripDates: string[]): {
  cadence: ShopCadence | null;
  avgDays: number | null;
} {
  const ts = tripDates.map((d) => new Date(d).getTime()).sort((a, b) => a - b);
  if (ts.length < 3) return { cadence: null, avgDays: null };
  let sum = 0;
  for (let i = 1; i < ts.length; i++) sum += ts[i] - ts[i - 1];
  const avg = sum / (ts.length - 1) / DAY_MS;
  return {
    cadence: avg < 10 ? "weekly" : avg < 22 ? "biweekly" : "monthly",
    avgDays: Math.round(avg * 10) / 10,
  };
}

/**
 * Próxima ida sugerida: última ida + cadência; se a casa tem dia preferido, avança até ele.
 * Sem última ida, conta a partir de `now`. Sem cadência, não há sugestão.
 */
export function nextShopDate(
  lastTripAt: string | null,
  cadence: ShopCadence | null,
  day: number | null,
  now: Date,
): Date | null {
  if (!cadence) return null;
  const base = lastTripAt ? new Date(lastTripAt) : now;
  const target = new Date(base.getTime() + CADENCE_DAYS[cadence] * DAY_MS);
  if (day != null && day >= 0 && day <= 6) {
    const diff = (day - target.getDay() + 7) % 7;
    target.setTime(target.getTime() + diff * DAY_MS);
  }
  return target;
}
