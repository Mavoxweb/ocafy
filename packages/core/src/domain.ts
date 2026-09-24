import { PROTEIN_MAP } from "./catalog";
import type {
  LitterSettings,
  Meal,
  ProteinInfo,
  TaskStatus,
  TaskStatusState,
} from "./types";

export function daysBetween(dateA: Date, dateB: Date): number {
  const startA = new Date(
    dateA.getFullYear(),
    dateA.getMonth(),
    dateA.getDate(),
  );
  const startB = new Date(
    dateB.getFullYear(),
    dateB.getMonth(),
    dateB.getDate(),
  );
  return Math.round(
    (startB.getTime() - startA.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function calculateTaskStatus(
  minDays: number,
  maxDays: number,
  lastCompletionAt: string | null | undefined,
  currentDate: Date = new Date(),
): TaskStatus {
  if (!lastCompletionAt) {
    return {
      state: "nunca",
      daysSinceLast: null,
      minDays,
      maxDays,
      lastCompletion: null,
    };
  }

  const lastDate = new Date(lastCompletionAt);
  const diff = daysBetween(lastDate, currentDate);

  let state: TaskStatusState;
  if (diff < minDays) {
    state = "ok";
  } else if (diff <= maxDays) {
    state = "due";
  } else {
    state = "late";
  }

  return {
    state,
    daysSinceLast: diff,
    minDays,
    maxDays,
    lastCompletion: { at: lastCompletionAt, who: "user" },
  };
}

export function calculatePoints(mins: number, bonusWindow = false): number {
  const base = 5 + mins;
  const bonus = bonusWindow ? Math.max(2, Math.round(mins * 0.5)) : 0;
  return base + bonus;
}

const LEVEL_NAMES = [
  "Iniciante",
  "Ajudante",
  "Caprichoso",
  "Organizado",
  "Impecável",
  "Mestre do Lar",
  "Lenda da Casa",
];

export function xpNeededForLevel(level: number): number {
  return 75 * level * (level - 1);
}

export interface LevelInfo {
  level: number;
  currentXp: number;
  xpInCurrentLevel: number;
  xpForNextLevel: number;
  name: string;
}

export function calculateLevel(totalXp: number): LevelInfo {
  let level = 1;
  while (totalXp >= xpNeededForLevel(level + 1)) {
    level++;
  }

  const curNeeded = xpNeededForLevel(level);
  const nextNeeded = xpNeededForLevel(level + 1);
  const xpInCurrentLevel = totalXp - curNeeded;
  const xpForNextLevel = nextNeeded - curNeeded;
  const name = LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)];

  return {
    level,
    currentXp: totalXp,
    xpInCurrentLevel,
    xpForNextLevel,
    name,
  };
}

export interface DefrostAlert {
  level: "ok" | "due" | "late";
  message: string;
  pullTime: Date | null;
}

export function getMealTime(
  mealDateStr: string,
  slot: "almoco" | "jantar",
): Date {
  const [y, m, d] = mealDateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (slot === "almoco") {
    date.setHours(12, 0, 0, 0);
  } else {
    date.setHours(19, 30, 0, 0);
  }
  return date;
}

export function calculateDefrostAlert(
  meal: Meal,
  now: Date = new Date(),
): DefrostAlert | null {
  if (meal.cooked || meal.pulled) return null;

  const protein = PROTEIN_MAP[meal.protein];
  if (!protein || protein.hours === 0) return null;

  const mealTime = getMealTime(meal.date, meal.slot);
  const pullTime = new Date(mealTime.getTime() - protein.hours * 3600 * 1000);

  if (now > mealTime) {
    return {
      level: "late",
      message: "Passou do horário sem retirar",
      pullTime,
    };
  }
  if (now >= pullTime) {
    return { level: "late", message: "Retirar agora da proteína", pullTime };
  }
  if (pullTime.getTime() - now.getTime() <= 14 * 3600 * 1000) {
    return { level: "due", message: "Retirar em breve", pullTime };
  }

  return { level: "ok", message: "Tudo certo", pullTime };
}

export function bagsPerLitterChange(settings: LitterSettings): number {
  return Math.max(
    1,
    Math.ceil((settings.boxes * settings.kgPerBox) / (settings.bagKg || 4)),
  );
}

export function calculateRemainingLitter(
  settings: LitterSettings,
  totalChangesDone: number,
): number {
  const bagsUsed = totalChangesDone * bagsPerLitterChange(settings);
  return Math.max(0, settings.currentStock - bagsUsed);
}

export function calculateLevelFromFormula(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

export interface WeeklyGoalProgress {
  targetXp: number;
  currentXp: number;
  progressPercent: number;
  isReached: boolean;
  coinsReward: number;
  achievementKey: string;
}

export function calculateWeeklyGoalProgress(
  weeklyXp: number,
): WeeklyGoalProgress {
  const targetXp = 1000;
  const currentXp = Math.max(0, weeklyXp);
  const isReached = currentXp >= targetXp;
  const progressPercent = Math.min(
    100,
    Math.floor((currentXp / targetXp) * 100),
  );
  return {
    targetXp,
    currentXp,
    progressPercent,
    isReached,
    coinsReward: 100,
    achievementKey: "dupla_implacavel",
  };
}

/* ---------- datas (YYYY-MM-DD) ---------- */

export function dateKeyOf(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Segunda-feira (YYYY-MM-DD) da semana de uma data no formato YYYY-MM-DD. */
export function mondayOfDateKey(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  return dateKeyOf(date);
}

/* ---------- pontos ---------- */

/**
 * Faixa de XP aceita para uma tarefa: base (5 + minutos) até base + o maior
 * bônus possível (janela: metade dos minutos, mín. 2; rotina: +3).
 * Usada pela API para não confiar cegamente no valor enviado pelo cliente.
 */
export function pointsRange(mins: number): { min: number; max: number } {
  const base = calculatePoints(mins, false);
  const bonus = Math.max(3, Math.max(2, Math.round(mins * 0.5)));
  return { min: base, max: base + bonus };
}

/* ---------- moedas da casa ---------- */

/** 1 moeda a cada 10 XP; a meta semanal da dupla rende bônus para cada um. */
export const XP_PER_COIN = 10;

export interface CoinCompletion {
  who: string;
  pts: number;
  dateKey: string;
}

export interface CoinPurchase {
  memberId: string;
  costCoins: number;
  status: "pending" | "approved" | "rejected";
}

export interface CoinBalance {
  earned: number;
  spent: number;
  balance: number;
}

/**
 * Moedas são derivadas (nunca gravadas): desfazer uma tarefa ou recusar uma
 * compra nunca deixa o saldo dessincronizado.
 * saldo = ⌊XP/10⌋ + 100 × semanas com meta batida − compras não recusadas
 */
export function computeCoins(
  completions: CoinCompletion[],
  purchases: CoinPurchase[],
  memberId: string,
): CoinBalance {
  const byWeek = new Map<string, number>();
  let xp = 0;
  for (const c of completions) {
    if (c.who === memberId) xp += c.pts;
    const wk = mondayOfDateKey(c.dateKey);
    byWeek.set(wk, (byWeek.get(wk) ?? 0) + c.pts);
  }
  let weeks = 0;
  for (const weekXp of byWeek.values()) {
    if (calculateWeeklyGoalProgress(weekXp).isReached) weeks++;
  }
  const reward = calculateWeeklyGoalProgress(0).coinsReward;
  const earned = Math.floor(xp / XP_PER_COIN) + weeks * reward;
  const spent = purchases
    .filter((p) => p.memberId === memberId && p.status !== "rejected")
    .reduce((a, p) => a + p.costCoins, 0);
  return { earned, spent, balance: Math.max(0, earned - spent) };
}
