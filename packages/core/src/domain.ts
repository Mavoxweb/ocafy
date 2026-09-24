import { PROTEIN_MAP } from "./catalog.js";
import type {
  LitterSettings,
  Meal,
  ProteinInfo,
  TaskStatus,
  TaskStatusState,
} from "./types.js";

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
