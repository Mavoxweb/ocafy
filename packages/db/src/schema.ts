import {
  boolean,
  index,
  integer,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

/**
 * Regras do modelo:
 * - Tudo é escopado por `household_id` e apagado em cascata com a casa.
 * - Tarefas vivem no catálogo do `@ocafy/core`; aqui guardamos só o que muda
 *   por casa (`task_overrides`) e o histórico (`completions`, por `task_key`).
 * - XP, nível e moedas são derivados das conclusões/compras (nunca gravados).
 * - Os ids podem ser gerados pelo cliente (uuid) para permitir UI otimista.
 */

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Uma conta (Neon Auth) pertence a no máximo uma casa; casal = até 2 membros. */
export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    userId: text("user_id").notNull(), // id do usuário no Neon Auth
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["owner", "member"] })
      .default("member")
      .notNull(),
    slot: text("slot", { enum: ["a", "b"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("household_members_user_uq").on(t.userId),
    uniqueIndex("household_members_slot_uq").on(t.householdId, t.slot),
  ],
);

export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

/** Cômodos ativos da casa (slug = RoomId do core). */
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    slug: text("slug").notNull(),
  },
  (t) => [uniqueIndex("rooms_household_slug_uq").on(t.householdId, t.slug)],
);

/** Ajustes por casa sobre o catálogo: janela de dias e pausa. */
export const taskOverrides = pgTable(
  "task_overrides",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    taskKey: text("task_key").notNull(),
    minDays: integer("min_days"),
    maxDays: integer("max_days"),
    isPaused: boolean("is_paused").default(false).notNull(),
  },
  (t) => [uniqueIndex("task_overrides_uq").on(t.householdId, t.taskKey)],
);

export const completions = pgTable(
  "completions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    taskKey: text("task_key").notNull(),
    completedBy: uuid("completed_by")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    completedAt: timestamp("completed_at").notNull(),
    pointsAwarded: integer("points_awarded").notNull(),
    note: text("note"),
    dateKey: varchar("date_key", { length: 10 }).notNull(), // YYYY-MM-DD
  },
  (t) => [
    index("completions_household_at_idx").on(t.householdId, t.completedAt),
  ],
);

export const meals = pgTable(
  "meals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    dateKey: varchar("date_key", { length: 10 }).notNull(),
    slot: text("slot", { enum: ["almoco", "jantar"] }).notNull(),
    dishName: text("dish_name").notNull(),
    proteinKey: text("protein_key").notNull(),
    createdBy: uuid("created_by").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    pulledBy: uuid("pulled_by").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    cookedBy: uuid("cooked_by").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
  },
  (t) => [index("meals_household_date_idx").on(t.householdId, t.dateKey)],
);

export const litterSettings = pgTable("litter_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  catsCount: integer("cats_count").default(3).notNull(),
  boxesCount: integer("boxes_count").default(2).notNull(),
  kgPerBox: real("kg_per_box").default(4).notNull(),
  bagKg: real("bag_kg").default(4).notNull(),
  minDays: integer("min_days").default(5).notNull(),
  maxDays: integer("max_days").default(7).notNull(),
  /** null = ainda não informado */
  stockBags: integer("stock_bags"),
});

/** Projeto Escritório: estado por casa (objetivos e etapas vêm do catálogo). */
export const officeProjects = pgTable("office_projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  startDate: varchar("start_date", { length: 10 }).notNull(), // segunda-feira
});

export const officeGoals = pgTable(
  "office_goals",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    goalKey: text("goal_key").notNull(),
    completedBy: uuid("completed_by").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    completedAt: timestamp("completed_at").notNull(),
  },
  (t) => [uniqueIndex("office_goals_uq").on(t.householdId, t.goalKey)],
);

export const officeSteps = pgTable(
  "office_steps",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    goalKey: text("goal_key").notNull(),
    stepIndex: integer("step_index").notNull(),
    isDone: boolean("is_done").default(true).notNull(),
  },
  (t) => [
    uniqueIndex("office_steps_uq").on(t.householdId, t.goalKey, t.stepIndex),
  ],
);

export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  destination: text("destination", {
    enum: ["fica", "outro", "doar", "vender", "lixo"],
  })
    .default("fica")
    .notNull(),
  createdBy: uuid("created_by").references(() => householdMembers.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const pushTokens = pgTable("push_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").notNull(),
  token: text("token").notNull(),
  platform: text("platform", { enum: ["web", "android", "ios"] }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const completionReactions = pgTable(
  "completion_reactions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    completionId: uuid("completion_id")
      .references(() => completions.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    emoji: text("emoji", {
      enum: ["celebrar", "fogo", "coracao", "palmas"],
    }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("reactions_uq").on(t.completionId, t.memberId, t.emoji)],
);

export const taskTrades = pgTable("task_trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  taskKey: text("task_key").notNull(),
  requesterId: uuid("requester_id")
    .references(() => householdMembers.id, { onDelete: "cascade" })
    .notNull(),
  assigneeId: uuid("assignee_id")
    .references(() => householdMembers.id, { onDelete: "cascade" })
    .notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] })
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

export const storeRewards = pgTable("store_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  costCoins: integer("cost_coins").notNull(),
  icon: text("icon").default("🎁").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const rewardPurchases = pgTable("reward_purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  rewardId: uuid("reward_id")
    .references(() => storeRewards.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => householdMembers.id, { onDelete: "cascade" })
    .notNull(),
  costCoins: integer("cost_coins").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});
