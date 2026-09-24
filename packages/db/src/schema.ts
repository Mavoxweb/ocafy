import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

// Households
export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Household Members
export const householdMembers = pgTable("household_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  userId: text("user_id").notNull(), // Linked to Neon Auth user ID
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["owner", "member"] })
    .default("member")
    .notNull(),
  color: text("color").default("#FFB7C5").notNull(),
  totalXp: integer("total_xp").default(0).notNull(),
  coins: integer("coins").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Invites
export const invites = pgTable("invites", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  code: text("code").unique().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Rooms
export const rooms = pgTable("rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  slug: text("slug").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  order: integer("order").default(0).notNull(),
});

// Global Task Templates (catalog)
export const taskTemplates = pgTable("task_templates", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  roomSlug: text("room_slug").notNull(),
  category: text("category").notNull(),
  type: text("type", { enum: ["routine", "recurring"] }).notNull(),
  routineType: text("routine_type", { enum: ["manha", "noite"] }),
  minDays: integer("min_days"),
  maxDays: integer("max_days"),
  mins: integer("mins").notNull(),
  suggestedDay: integer("suggested_day"),
  howTo: text("how_to"),
});

// Household Tasks
export const householdTasks = pgTable("household_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  templateId: text("template_id").references(() => taskTemplates.id),
  title: text("title").notNull(),
  roomSlug: text("room_slug").notNull(),
  category: text("category").notNull(),
  type: text("type", { enum: ["routine", "recurring"] }).notNull(),
  routineType: text("routine_type", { enum: ["manha", "noite"] }),
  minDays: integer("min_days").default(1).notNull(),
  maxDays: integer("max_days").default(7).notNull(),
  mins: integer("mins").default(10).notNull(),
  suggestedDay: integer("suggested_day"),
  isPaused: boolean("is_paused").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Completions
export const completions = pgTable("completions", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  taskId: uuid("task_id")
    .references(() => householdTasks.id, { onDelete: "cascade" })
    .notNull(),
  completedBy: uuid("completed_by")
    .references(() => householdMembers.id)
    .notNull(),
  completedAt: timestamp("completed_at").notNull(),
  pointsAwarded: integer("points_awarded").notNull(),
  note: text("note"),
  dateKey: varchar("date_key", { length: 10 }).notNull(), // YYYY-MM-DD
});

// Meals
export const meals = pgTable("meals", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  dateKey: varchar("date_key", { length: 10 }).notNull(),
  slot: text("slot", { enum: ["almoco", "jantar"] }).notNull(),
  dishName: text("dish_name").notNull(),
  proteinKey: text("protein_key").notNull(),
  defrostHours: integer("defrost_hours").default(24).notNull(),
  pulledBy: uuid("pulled_by").references(() => householdMembers.id),
  cookedBy: uuid("cooked_by").references(() => householdMembers.id),
});

// Pets & Litter
export const pets = pgTable("pets", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  species: text("species", { enum: ["cat", "dog", "other"] }).notNull(),
});

export const litterSettings = pgTable("litter_settings", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  catsCount: integer("cats_count").default(3).notNull(),
  boxesCount: integer("boxes_count").default(2).notNull(),
  kgPerBox: integer("kg_per_box").default(4).notNull(),
  bagKg: integer("bag_kg").default(4).notNull(),
  minDays: integer("min_days").default(5).notNull(),
  maxDays: integer("max_days").default(7).notNull(),
  stockBags: integer("stock_bags").default(10).notNull(),
});

// Projects & Goals
export const projects = pgTable("projects", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  description: text("description"),
  totalWeeks: integer("total_weeks").default(9).notNull(),
  startedAt: timestamp("started_at"),
  isCompleted: boolean("is_completed").default(false).notNull(),
});

export const projectGoals = pgTable("project_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  projectId: uuid("project_id")
    .references(() => projects.id, { onDelete: "cascade" })
    .notNull(),
  weekNumber: integer("week_number").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  completedBy: uuid("completed_by").references(() => householdMembers.id),
  completedAt: timestamp("completed_at"),
});

export const goalSteps = pgTable("goal_steps", {
  id: uuid("id").defaultRandom().primaryKey(),
  goalId: uuid("goal_id")
    .references(() => projectGoals.id, { onDelete: "cascade" })
    .notNull(),
  description: text("description").notNull(),
  isDone: boolean("is_done").default(false).notNull(),
  order: integer("order").default(0).notNull(),
});

// Inventory
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
  photoUrl: text("photo_url"),
});

// Achievements
export const achievements = pgTable("achievements", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => householdMembers.id)
    .notNull(),
  achievementKey: text("achievement_key").notNull(),
  unlockedAt: timestamp("unlocked_at").defaultNow().notNull(),
});

// Push Tokens
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

// Reactions
export const completionReactions = pgTable("completion_reactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  completionId: uuid("completion_id")
    .references(() => completions.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => householdMembers.id)
    .notNull(),
  emoji: text("emoji", {
    enum: ["celebrar", "fogo", "coracao", "palmas"],
  }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Task Trades
export const taskTrades = pgTable("task_trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  taskId: uuid("task_id")
    .references(() => householdTasks.id, { onDelete: "cascade" })
    .notNull(),
  requesterId: uuid("requester_id")
    .references(() => householdMembers.id)
    .notNull(),
  assigneeId: uuid("assignee_id")
    .references(() => householdMembers.id)
    .notNull(),
  status: text("status", { enum: ["pending", "accepted", "rejected"] })
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});

// Household Rewards / Store
export const storeRewards = pgTable("store_rewards", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  title: text("title").notNull(),
  costCoins: integer("cost_coins").notNull(),
  icon: text("icon").default("🎁").notNull(),
  isSystem: boolean("is_system").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Reward Purchases
export const rewardPurchases = pgTable("reward_purchases", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  rewardId: uuid("reward_id")
    .references(() => storeRewards.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => householdMembers.id)
    .notNull(),
  costCoins: integer("cost_coins").notNull(),
  status: text("status", { enum: ["pending", "approved", "rejected"] })
    .default("pending")
    .notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at"),
});
