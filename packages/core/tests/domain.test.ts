import { describe, expect, it } from "vitest";
import {
  bagsPerLitterChange,
  calculateDefrostAlert,
  calculateLevel,
  calculateLevelFromFormula,
  calculatePoints,
  calculateRemainingLitter,
  calculateTaskStatus,
  calculateWeeklyGoalProgress,
  computeCoins,
  daysBetween,
  mondayOfDateKey,
  pointsRange,
  xpNeededForLevel,
} from "../src/domain";
import type { LitterSettings, Meal } from "../src/types";

describe("Core Domain Logic", () => {
  describe("daysBetween", () => {
    it("should calculate exact days between two dates regardless of time", () => {
      const dateA = new Date("2026-09-01T10:00:00Z");
      const dateB = new Date("2026-09-05T22:00:00Z");
      expect(daysBetween(dateA, dateB)).toBe(4);
    });
  });

  describe("calculateTaskStatus", () => {
    it("returns 'nunca' if last completion is missing", () => {
      const status = calculateTaskStatus(2, 5, null);
      expect(status.state).toBe("nunca");
      expect(status.daysSinceLast).toBeNull();
    });

    it("returns 'ok' if within minDays", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      const last = new Date("2026-09-09T12:00:00Z").toISOString(); // 1 day ago
      const status = calculateTaskStatus(2, 5, last, now);
      expect(status.state).toBe("ok");
      expect(status.daysSinceLast).toBe(1);
    });

    it("returns 'due' if between minDays and maxDays", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      const last = new Date("2026-09-07T12:00:00Z").toISOString(); // 3 days ago
      const status = calculateTaskStatus(2, 5, last, now);
      expect(status.state).toBe("due");
      expect(status.daysSinceLast).toBe(3);
    });

    it("returns 'late' if after maxDays", () => {
      const now = new Date("2026-09-10T12:00:00Z");
      const last = new Date("2026-09-01T12:00:00Z").toISOString(); // 9 days ago
      const status = calculateTaskStatus(2, 5, last, now);
      expect(status.state).toBe("late");
      expect(status.daysSinceLast).toBe(9);
    });
  });

  describe("calculatePoints", () => {
    it("calculates base points without bonus", () => {
      expect(calculatePoints(10, false)).toBe(15); // 5 + 10
    });

    it("calculates points with bonus window", () => {
      expect(calculatePoints(10, true)).toBe(20); // 5 + 10 + Math.max(2, 5) = 20
    });
  });

  describe("calculateLevel & XP", () => {
    it("calculates level 1 for starting XP", () => {
      const levelInfo = calculateLevel(0);
      expect(levelInfo.level).toBe(1);
      expect(levelInfo.name).toBe("Iniciante");
    });

    it("progresses to level 2 when XP crosses threshold", () => {
      // Level 2 requires 75 * 2 * 1 = 150 XP
      expect(xpNeededForLevel(2)).toBe(150);

      const levelInfo = calculateLevel(150);
      expect(levelInfo.level).toBe(2);
      expect(levelInfo.name).toBe("Ajudante");
    });
  });

  describe("calculateDefrostAlert", () => {
    it("returns null if meal is already cooked or pulled", () => {
      const meal: Meal = {
        id: "1",
        date: "2026-09-24",
        slot: "almoco",
        dish: "Frango Grelhado",
        protein: "frango_file",
        cooked: true,
      };
      expect(calculateDefrostAlert(meal)).toBeNull();
    });

    it("alerts late when now is past meal time", () => {
      const meal: Meal = {
        id: "1",
        date: "2026-09-24",
        slot: "almoco", // 12:00
        dish: "Frango",
        protein: "frango_file", // 24h defrost -> pull at 2026-09-23 12:00
      };
      const now = new Date("2026-09-24T13:00:00");
      const alert = calculateDefrostAlert(meal, now);
      expect(alert?.level).toBe("late");
      expect(alert?.message).toContain("Passou do horário");
    });

    it("alerts late when past defrost start time", () => {
      const meal: Meal = {
        id: "1",
        date: "2026-09-24",
        slot: "almoco", // 12:00
        dish: "Frango",
        protein: "frango_file", // 24h -> pull at 2026-09-23 12:00
      };
      const now = new Date("2026-09-23T15:00:00"); // 3 hours past pull time
      const alert = calculateDefrostAlert(meal, now);
      expect(alert?.level).toBe("late");
      expect(alert?.message).toContain("Retirar agora");
    });
  });

  describe("Litter calculations", () => {
    const settings: LitterSettings = {
      cats: 3,
      boxes: 2,
      kgPerBox: 4,
      bagKg: 4,
      minDays: 5,
      maxDays: 7,
      currentStock: 10,
    };

    it("calculates bags required per change", () => {
      expect(bagsPerLitterChange(settings)).toBe(2); // 2 boxes * 4kg / 4kg = 2 bags
    });

    it("calculates remaining litter after changes", () => {
      expect(calculateRemainingLitter(settings, 3)).toBe(4); // 10 stock - (3 changes * 2 bags) = 4
    });
  });

  describe("calculateLevelFromFormula", () => {
    it("returns level 1 for 0 XP", () => {
      expect(calculateLevelFromFormula(0)).toBe(1);
    });

    it("returns level 2 for 100 XP", () => {
      expect(calculateLevelFromFormula(100)).toBe(2);
    });

    it("returns level 4 for 900 XP", () => {
      expect(calculateLevelFromFormula(900)).toBe(4);
    });
  });

  describe("calculateWeeklyGoalProgress", () => {
    it("calculates partial progress below 1000 XP", () => {
      const progress = calculateWeeklyGoalProgress(500);
      expect(progress.isReached).toBe(false);
      expect(progress.progressPercent).toBe(50);
    });

    it("unlocks reward and achievement at or above 1000 XP", () => {
      const progress = calculateWeeklyGoalProgress(1050);
      expect(progress.isReached).toBe(true);
      expect(progress.progressPercent).toBe(100);
      expect(progress.coinsReward).toBe(100);
      expect(progress.achievementKey).toBe("dupla_implacavel");
    });
  });
});

describe("moedas da casa", () => {
  const c = (who: string, pts: number, dateKey: string) => ({
    who,
    pts,
    dateKey,
  });

  it("dá 1 moeda a cada 10 XP", () => {
    const r = computeCoins([c("a", 95, "2026-09-21")], [], "a");
    expect(r).toEqual({ earned: 9, spent: 0, balance: 9 });
  });

  it("bate a meta semanal da dupla: +100 para cada um", () => {
    const week = [c("a", 600, "2026-09-21"), c("b", 400, "2026-09-23")];
    expect(computeCoins(week, [], "a").earned).toBe(60 + 100);
    expect(computeCoins(week, [], "b").earned).toBe(40 + 100);
  });

  it("conta compras pendentes e aprovadas, mas não as recusadas", () => {
    const comps = [c("a", 1000, "2026-09-21")];
    const p = (status: "pending" | "approved" | "rejected") => ({
      memberId: "a",
      costCoins: 30,
      status,
    });
    expect(
      computeCoins(comps, [p("pending"), p("approved"), p("rejected")], "a")
        .spent,
    ).toBe(60);
  });

  it("nunca fica negativo", () => {
    const r = computeCoins(
      [],
      [{ memberId: "a", costCoins: 50, status: "approved" }],
      "a",
    );
    expect(r.balance).toBe(0);
  });
});

describe("pointsRange / mondayOfDateKey", () => {
  it("aceita base até base + maior bônus", () => {
    expect(pointsRange(20)).toEqual({ min: 25, max: 25 + 10 });
    expect(pointsRange(1)).toEqual({ min: 6, max: 6 + 3 });
  });
  it("acha a segunda-feira da semana", () => {
    expect(mondayOfDateKey("2026-09-24")).toBe("2026-09-21"); // quinta
    expect(mondayOfDateKey("2026-09-27")).toBe("2026-09-21"); // domingo
    expect(mondayOfDateKey("2026-09-21")).toBe("2026-09-21");
  });
});
