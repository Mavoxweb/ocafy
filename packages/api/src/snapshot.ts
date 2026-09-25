import type {
  AgeBand,
  HouseProfile,
  LitterSettings,
  Pet,
  RoomInstance,
} from "@ocafy/core";
import {
  completionReactions,
  completions,
  db,
  householdMembers,
  households,
  inventoryItems,
  invites,
  litterSettings,
  meals,
  officeGoals,
  officeProjects,
  officeSteps,
  pets,
  rewardPurchases,
  rooms,
  storeRewards,
  taskAssignments,
  taskOverrides,
  taskTrades,
} from "@ocafy/db";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { petOf, profileOf, roomsOf } from "./plan";

/**
 * Estado completo da casa, em JSON puro (datas em ISO). O formato espelha o
 * `AppState` do app web para o cliente só precisar trocar o cache.
 */
export interface Snapshot {
  /** Revisão da casa: sobe a cada mudança (trigger no banco). */
  rev: number;
  household: { id: string; name: string; createdAt: string };
  meId: string;
  isOwner: boolean;
  members: {
    id: string;
    name: string;
    slot: "a" | "b" | "c" | "d" | "e" | "f" | "g" | "h";
    /** account = adulto com login; profile = perfil de criança. */
    kind: "account" | "profile";
    ageBand: AgeBand | null;
    /** Versão da foto (null = sem foto); a imagem sai por /api/avatar/:id?v=… */
    avatarVersion: number | null;
  }[];
  /** Perfil da casa: entrada do motor de rotinas (o plano é calculado no cliente, igual ao servidor). */
  profile: HouseProfile;
  rooms: RoomInstance[];
  pets: Pet[];
  /** Quem cuida de cada tarefa (chave da tarefa → id da pessoa). */
  assignments: Record<string, string>;
  litter: Omit<LitterSettings, "currentStock">;
  litterStock: number | null;
  overrides: Record<string, { min?: number; max?: number; off?: boolean }>;
  completions: {
    id: string;
    taskId: string;
    who: string;
    at: string;
    pts: number;
    dateKey: string;
    note?: string;
  }[];
  meals: {
    id: string;
    date: string;
    slot: "almoco" | "jantar";
    dish: string;
    protein: string;
    by: string;
    pulledBy?: string;
    cookedBy?: string;
  }[];
  office: {
    start: string | null;
    done: Record<string, { at: string; who: string }>;
    steps: Record<string, Record<number, boolean>>;
    inventory: {
      id: string;
      name: string;
      category: string;
      dest: "fica" | "outro" | "doar" | "vender" | "lixo";
      who: string;
      at: string;
    }[];
  };
  rewards: { id: string; title: string; costCoins: number; icon: string }[];
  purchases: {
    id: string;
    rewardId: string;
    memberId: string;
    costCoins: number;
    status: "pending" | "approved" | "rejected";
    createdAt: string;
    resolvedAt?: string;
  }[];
  reactions: {
    id: string;
    completionId: string;
    memberId: string;
    emoji: "celebrar" | "fogo" | "coracao" | "palmas";
  }[];
  trades: {
    id: string;
    taskId: string;
    requesterId: string;
    assigneeId: string;
    status: "pending" | "accepted" | "rejected";
    createdAt: string;
    resolvedAt?: string;
  }[];
  /** Convite ativo (só aparece enquanto a casa tem menos de 2 membros). */
  invite: { code: string; expiresAt: string } | null;
}

const iso = (d: Date) => d.toISOString();

/**
 * Uma única ida ao banco: a casa é resolvida por subconsulta a partir do
 * userId (sem consulta prévia do membro). Devolve `null` se a conta não tem casa.
 */
export async function loadSnapshot(userId: string): Promise<Snapshot | null> {
  const hid = sql`(select ${householdMembers.householdId} from ${householdMembers} where ${householdMembers.userId} = ${userId})`;
  const now = new Date();

  const [
    memberRows,
    [household],
    roomRows,
    petRows,
    [litter],
    overrideRows,
    completionRows,
    mealRows,
    [project],
    goalRows,
    stepRows,
    inventoryRows,
    rewardRows,
    purchaseRows,
    reactionRows,
    tradeRows,
    inviteRows,
    assignmentRows,
  ] = await db.batch([
    db
      .select({
        id: householdMembers.id,
        userId: householdMembers.userId,
        displayName: householdMembers.displayName,
        role: householdMembers.role,
        slot: householdMembers.slot,
        avatarVersion: householdMembers.avatarVersion,
        kind: householdMembers.kind,
        ageBand: householdMembers.ageBand,
      })
      .from(householdMembers)
      .where(eq(householdMembers.householdId, hid)),
    db.select().from(households).where(eq(households.id, hid)),
    db.select().from(rooms).where(eq(rooms.householdId, hid)),
    db.select().from(pets).where(eq(pets.householdId, hid)),
    db.select().from(litterSettings).where(eq(litterSettings.householdId, hid)),
    db.select().from(taskOverrides).where(eq(taskOverrides.householdId, hid)),
    db.select().from(completions).where(eq(completions.householdId, hid)),
    db.select().from(meals).where(eq(meals.householdId, hid)),
    db.select().from(officeProjects).where(eq(officeProjects.householdId, hid)),
    db.select().from(officeGoals).where(eq(officeGoals.householdId, hid)),
    db.select().from(officeSteps).where(eq(officeSteps.householdId, hid)),
    db.select().from(inventoryItems).where(eq(inventoryItems.householdId, hid)),
    db.select().from(storeRewards).where(eq(storeRewards.householdId, hid)),
    db
      .select()
      .from(rewardPurchases)
      .where(eq(rewardPurchases.householdId, hid)),
    db
      .select()
      .from(completionReactions)
      .where(eq(completionReactions.householdId, hid)),
    db.select().from(taskTrades).where(eq(taskTrades.householdId, hid)),
    db
      .select()
      .from(invites)
      .where(
        and(
          eq(invites.householdId, hid),
          isNull(invites.usedAt),
          gt(invites.expiresAt, now),
        ),
      ),
    db
      .select()
      .from(taskAssignments)
      .where(eq(taskAssignments.householdId, hid)),
  ]);

  const member = memberRows.find((m) => m.userId === userId);
  if (!member || !household) return null;

  const overrides: Snapshot["overrides"] = {};
  for (const o of overrideRows) {
    overrides[o.taskKey] = {
      ...(o.minDays != null ? { min: o.minDays } : {}),
      ...(o.maxDays != null ? { max: o.maxDays } : {}),
      ...(o.isPaused ? { off: true } : {}),
    };
  }

  const steps: Snapshot["office"]["steps"] = {};
  for (const s of stepRows) {
    steps[s.goalKey] ??= {};
    steps[s.goalKey][s.stepIndex] = s.isDone;
  }
  const done: Snapshot["office"]["done"] = {};
  for (const g of goalRows) {
    done[g.goalKey] = { at: iso(g.completedAt), who: g.completedBy ?? "" };
  }

  const invite = memberRows.length < 2 ? inviteRows[0] : undefined;

  return {
    rev: household.rev,
    household: {
      id: household.id,
      name: household.name,
      createdAt: iso(household.createdAt),
    },
    meId: member.id,
    isOwner: member.role === "owner",
    members: memberRows
      .sort((a, b) => a.slot.localeCompare(b.slot))
      .map((m) => ({
        id: m.id,
        name: m.displayName,
        slot: m.slot,
        avatarVersion: m.avatarVersion,
        kind: m.kind,
        ageBand: m.ageBand,
      })),
    assignments: Object.fromEntries(
      assignmentRows.map((a) => [a.taskKey, a.memberId]),
    ),
    profile: profileOf(household),
    rooms: roomsOf(roomRows),
    pets: petRows.map(petOf),
    litter: litter
      ? {
          cats: litter.catsCount,
          boxes: litter.boxesCount,
          kgPerBox: litter.kgPerBox,
          bagKg: litter.bagKg,
          minDays: litter.minDays,
          maxDays: litter.maxDays,
        }
      : { cats: 3, boxes: 2, kgPerBox: 4, bagKg: 4, minDays: 5, maxDays: 7 },
    litterStock: litter?.stockBags ?? null,
    overrides,
    completions: completionRows.map((c) => ({
      id: c.id,
      taskId: c.taskKey,
      who: c.completedBy,
      at: iso(c.completedAt),
      pts: c.pointsAwarded,
      dateKey: c.dateKey,
      ...(c.note ? { note: c.note } : {}),
    })),
    meals: mealRows.map((m) => ({
      id: m.id,
      date: m.dateKey,
      slot: m.slot,
      dish: m.dishName,
      protein: m.proteinKey,
      by: m.createdBy ?? "",
      ...(m.pulledBy ? { pulledBy: m.pulledBy } : {}),
      ...(m.cookedBy ? { cookedBy: m.cookedBy } : {}),
    })),
    office: {
      start: project?.startDate ?? null,
      done,
      steps,
      inventory: inventoryRows.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        dest: i.destination,
        who: i.createdBy ?? "",
        at: iso(i.createdAt),
      })),
    },
    rewards: rewardRows.map((r) => ({
      id: r.id,
      title: r.title,
      costCoins: r.costCoins,
      icon: r.icon,
    })),
    purchases: purchaseRows.map((p) => ({
      id: p.id,
      rewardId: p.rewardId,
      memberId: p.memberId,
      costCoins: p.costCoins,
      status: p.status,
      createdAt: iso(p.createdAt),
      ...(p.resolvedAt ? { resolvedAt: iso(p.resolvedAt) } : {}),
    })),
    reactions: reactionRows.map((r) => ({
      id: r.id,
      completionId: r.completionId,
      memberId: r.memberId,
      emoji: r.emoji,
    })),
    trades: tradeRows.map((t) => ({
      id: t.id,
      taskId: t.taskKey,
      requesterId: t.requesterId,
      assigneeId: t.assigneeId,
      status: t.status,
      createdAt: iso(t.createdAt),
      ...(t.resolvedAt ? { resolvedAt: iso(t.resolvedAt) } : {}),
    })),
    invite: invite
      ? { code: invite.code, expiresAt: iso(invite.expiresAt) }
      : null,
  };
}
