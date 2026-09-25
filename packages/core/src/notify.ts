/**
 * Motor de lembretes: dado o horário, a agenda da pessoa e o que está pendente, decide QUAIS
 * avisos devem sair agora. É puro e determinístico — o agendador (cron) só carrega os dados,
 * chama `planNotifications` e envia. Quem já recebeu não recebe de novo (chave `dedupeKey`).
 *
 * Regras de horário:
 *  - "fora de casa" (dia todo, ausência ou faixa entre sair e voltar) não recebe avisos de
 *    rotina; se o horário ideal cai na faixa fora, o aviso vai para a hora da volta;
 *  - horário de silêncio (ex.: 22:00–07:00) adia o aviso para o fim do silêncio;
 *  - o aviso vale por uma janela (`graceMin`): se o agendador atrasar, ainda sai; depois dela, não.
 */

export type NotifKind =
  | "morning"
  | "night"
  | "due"
  | "defrost"
  | "shopping_day"
  | "trade"
  | "purchase"
  | "shopping_urgent"
  | "billing";

export interface NotifPrefs {
  enabled: boolean;
  morning: boolean;
  night: boolean;
  due: boolean;
  defrost: boolean;
  partner: boolean;
  shopping: boolean;
  /** "HH:MM" — dentro dessa faixa nada é enviado (adia para o fim). */
  quietStart: string;
  quietEnd: string;
  /** Minutos de antecedência antes de sair de casa. */
  remindBeforeMin: number;
}

export const DEFAULT_PREFS: NotifPrefs = {
  enabled: false,
  morning: true,
  night: true,
  due: true,
  defrost: true,
  partner: true,
  shopping: true,
  quietStart: "22:00",
  quietEnd: "07:00",
  remindBeforeMin: 15,
};

export type DayMode = "home" | "away" | "partial";

export interface DaySchedule {
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** home = em casa o dia todo · away = fora o dia todo · partial = sai e volta. */
  mode: DayMode;
  /** "HH:MM" — só em `partial`. */
  leave: string | null;
  back: string | null;
}

export const DAY_MODE_LABELS: Record<DayMode, string> = {
  home: "Em casa",
  away: "Fora o dia todo",
  partial: "Sai e volta",
};

/** Ausência de uma ou mais datas (viagem, plantão…), ambas inclusas. */
export interface Absence {
  from: string; // YYYY-MM-DD
  until: string;
}

export const DEFAULT_MORNING = "07:30";
export const DEFAULT_NIGHT = "20:30";
export const DEFAULT_DIGEST = "09:00";
export const DEFAULT_SHOPPING = "10:00";

export const toMin = (hhmm: string): number => {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

export const fromMin = (min: number): string => {
  const c = Math.max(0, Math.min(1439, Math.round(min)));
  return `${String(Math.floor(c / 60)).padStart(2, "0")}:${String(c % 60).padStart(2, "0")}`;
};

export interface LocalParts {
  dateKey: string; // YYYY-MM-DD no fuso
  weekday: number;
  /** Minutos desde 00:00 no fuso. */
  minutes: number;
}

/** Data, dia da semana e hora no fuso da casa (Intl, sem dependências). */
export function localParts(date: Date, tz: string): LocalParts {
  const f = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  });
  const p = Object.fromEntries(
    f.formatToParts(date).map((x) => [x.type, x.value]),
  );
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    p.weekday,
  );
  return {
    dateKey: `${p.year}-${p.month}-${p.day}`,
    weekday: wd,
    minutes: Number(p.hour) * 60 + Number(p.minute),
  };
}

export interface Presence {
  /** Ausência marcada cobrindo hoje. */
  absent: boolean;
  mode: DayMode;
  leaveMin: number | null;
  backMin: number | null;
}

export function presenceOn(
  local: LocalParts,
  schedule: DaySchedule[],
  absences: Absence[],
): Presence {
  const absent = absences.some(
    (a) => local.dateKey >= a.from && local.dateKey <= a.until,
  );
  const day = schedule.find((d) => d.weekday === local.weekday);
  const mode: DayMode = day?.mode ?? "home";
  return {
    absent,
    mode,
    leaveMin: mode === "partial" && day?.leave ? toMin(day.leave) : null,
    backMin: mode === "partial" && day?.back ? toMin(day.back) : null,
  };
}

/** A pessoa está em casa neste minuto do dia? */
export function isHomeAt(p: Presence, minute: number): boolean {
  if (p.absent || p.mode === "away") return false;
  if (p.mode === "partial") {
    if (p.leaveMin != null && p.backMin != null) {
      return minute < p.leaveMin || minute >= p.backMin;
    }
    if (p.leaveMin != null) return minute < p.leaveMin;
  }
  return true;
}

function inQuiet(minute: number, start: number, end: number): boolean {
  if (start === end) return false;
  return start < end
    ? minute >= start && minute < end
    : minute >= start || minute < end;
}

/** Empurra o horário para fora do silêncio (fim do silêncio). */
function outOfQuiet(target: number, prefs: NotifPrefs): number {
  const s = toMin(prefs.quietStart);
  const e = toMin(prefs.quietEnd);
  return inQuiet(target, s, e) ? e : target;
}

export interface MealAlertInput {
  id: string;
  label: string;
  /** Minuto do dia (no fuso) em que é para retirar; o dia é conferido por `dateKey`. */
  dateKey: string;
  minute: number;
}

export interface NotifyInput {
  now: Date;
  tz: string;
  prefs: NotifPrefs;
  schedule: DaySchedule[];
  absences: Absence[];
  /** Rotina da manhã/noite ainda não feita hoje. */
  morningPending: number;
  nightPending: number;
  /** Recorrentes na janela / atrasadas (para o resumo do dia). */
  dueCount: number;
  lateCount: number;
  /** Proteínas a retirar do congelador hoje. */
  defrost: MealAlertInput[];
  /** Itens abertos na lista de compras e quantos são urgentes. */
  shoppingOpen: number;
  shoppingUrgent: number;
  /** Hoje é o dia sugerido de compras? */
  isShoppingDay: boolean;
  /** Tolerância (min) para o agendador atrasar sem perder o aviso. */
  graceMin?: number;
}

export interface DueNotification {
  kind: NotifKind;
  /** Único por pessoa: se já foi enviado, não repete. */
  dedupeKey: string;
  title: string;
  body: string;
  /** Rota do app aberta ao tocar. */
  url: string;
}

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export function planNotifications(input: NotifyInput): DueNotification[] {
  const { prefs } = input;
  if (!prefs.enabled) return [];
  const grace = input.graceMin ?? 45;
  const local = localParts(input.now, input.tz);
  const presence = presenceOn(local, input.schedule, input.absences);
  const out: DueNotification[] = [];

  /** O aviso está dentro da janela [alvo, alvo + tolerância]? */
  const due = (target: number) =>
    local.minutes >= target && local.minutes < target + grace;
  const home = (m: number) => isHomeAt(presence, m);

  // --- rotina da manhã: antes de sair (ou 07:30 se fica em casa) ---
  if (prefs.morning && input.morningPending > 0) {
    let target: number;
    let leaving = false;
    if (presence.leaveMin != null && !presence.absent) {
      target = presence.leaveMin - prefs.remindBeforeMin;
      leaving = true;
    } else {
      target = toMin(DEFAULT_MORNING);
    }
    target = outOfQuiet(Math.max(0, target), prefs);
    if (home(target) && due(target)) {
      out.push({
        kind: "morning",
        dedupeKey: `morning:${local.dateKey}`,
        title: leaving
          ? `Faltam ${prefs.remindBeforeMin} min para você sair`
          : "Bom dia! Rotina da manhã",
        body: `${plural(input.morningPending, "item", "itens")} da rotina da manhã ${input.morningPending === 1 ? "espera" : "esperam"} por você.`,
        url: "/",
      });
    }
  }

  // --- reset da noite: quando volta (+1h) ou 20:30 ---
  if (prefs.night && input.nightPending > 0) {
    let target =
      presence.backMin != null
        ? Math.max(presence.backMin + 60, toMin(DEFAULT_NIGHT) - 120)
        : toMin(DEFAULT_NIGHT);
    target = outOfQuiet(Math.min(target, 1439), prefs);
    if (home(target) && due(target)) {
      out.push({
        kind: "night",
        dedupeKey: `night:${local.dateKey}`,
        title: "Reset da noite",
        body: `${plural(input.nightPending, "item", "itens")} para a casa amanhecer pronta.`,
        url: "/",
      });
    }
  }

  // --- resumo das tarefas na janela / atrasadas ---
  const pending = input.dueCount + input.lateCount;
  if (prefs.due && pending > 0) {
    let target = outOfQuiet(toMin(DEFAULT_DIGEST), prefs);
    // se 09:00 cai no horário fora de casa, vai para a volta
    if (!home(target) && presence.backMin != null && !presence.absent)
      target = presence.backMin;
    if (home(target) && due(target)) {
      out.push({
        kind: "due",
        dedupeKey: `due:${local.dateKey}`,
        title: "Tarefas de hoje",
        body:
          input.lateCount > 0
            ? `${plural(pending, "tarefa", "tarefas")} na janela — ${plural(input.lateCount, "atrasada", "atrasadas")}.`
            : `${plural(pending, "tarefa entrou", "tarefas entraram")} na janela.`,
        url: "/rotinas",
      });
    }
  }

  // --- descongelar proteína: no horário exato, se estiver em casa ---
  if (prefs.defrost) {
    for (const m of input.defrost) {
      if (m.dateKey !== local.dateKey) continue;
      const target = outOfQuiet(m.minute, prefs);
      if (home(target) && due(target)) {
        out.push({
          kind: "defrost",
          dedupeKey: `defrost:${m.id}`,
          title: "Retire a proteína do congelador",
          body: m.label,
          url: "/cozinha",
        });
      }
    }
  }

  // --- dia de compras ---
  if (prefs.shopping && input.isShoppingDay && input.shoppingOpen > 0) {
    let target = outOfQuiet(toMin(DEFAULT_SHOPPING), prefs);
    if (!home(target) && presence.backMin != null && !presence.absent)
      target = presence.backMin;
    if (home(target) && due(target)) {
      out.push({
        kind: "shopping_day",
        dedupeKey: `shopping_day:${local.dateKey}`,
        title: "Dia de compras",
        body:
          input.shoppingUrgent > 0
            ? `${plural(input.shoppingOpen, "item", "itens")} na lista — ${plural(input.shoppingUrgent, "urgente", "urgentes")}.`
            : `${plural(input.shoppingOpen, "item", "itens")} na lista.`,
        url: "/compras",
      });
    }
  }

  return out;
}

/**
 * Avisos disparados por um evento (pedido de troca, resgate, item urgente): saem na hora, mas
 * respeitam o silêncio e a preferência. Não dependem de estar em casa — alguém pediu.
 */
export function canSendEventNow(
  prefs: NotifPrefs,
  kind: "trade" | "purchase" | "shopping_urgent",
  now: Date,
  tz: string,
): boolean {
  if (!prefs.enabled) return false;
  if (kind === "shopping_urgent" ? !prefs.shopping : !prefs.partner)
    return false;
  const local = localParts(now, tz);
  return !inQuiet(
    local.minutes,
    toMin(prefs.quietStart),
    toMin(prefs.quietEnd),
  );
}

/** Horário das refeições no fuso da casa (minutos desde 00:00). */
export const MEAL_MINUTES = { almoco: 12 * 60, jantar: 19 * 60 + 30 } as const;

/**
 * Quando retirar a proteína do congelador, no fuso da casa (independe do fuso do servidor):
 * horário da refeição menos as horas de descongelamento, podendo cair no dia anterior.
 */
export function defrostPullLocal(
  dateKey: string,
  slot: keyof typeof MEAL_MINUTES,
  hours: number,
): { dateKey: string; minute: number } {
  const total = MEAL_MINUTES[slot] - Math.round(hours * 60);
  if (total >= 0) return { dateKey, minute: total };
  const d = new Date(`${dateKey}T12:00:00Z`);
  const days = Math.ceil(-total / 1440);
  d.setUTCDate(d.getUTCDate() - days);
  return { dateKey: d.toISOString().slice(0, 10), minute: total + days * 1440 };
}
