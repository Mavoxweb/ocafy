import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
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
  /** Sobe a cada mudança em qualquer tabela da casa (triggers): o app só baixa o snapshot se mudou. */
  rev: bigint("rev", { mode: "number" }).default(0).notNull(),
  /** Perfil da casa (entrada do motor de rotinas). Ver @ocafy/core → HouseProfile. */
  mode: text("mode", { enum: ["solo", "couple", "family"] })
    .default("couple")
    .notNull(),
  dwelling: text("dwelling", {
    enum: ["apartment", "house", "townhouse", "studio"],
  })
    .default("apartment")
    .notNull(),
  size: text("size", { enum: ["s", "m", "l"] })
    .default("m")
    .notNull(),
  intensity: text("intensity", { enum: ["light", "standard", "full"] })
    .default("standard")
    .notNull(),
  cooksAtHome: boolean("cooks_at_home").default(true).notNull(),
  usesFrozen: boolean("uses_frozen").default(true).notNull(),
  hasWasher: boolean("has_washer").default(true).notNull(),
  hasPlants: boolean("has_plants").default(false).notNull(),
  hasCar: boolean("has_car").default(false).notNull(),
  officeProject: boolean("office_project").default(false).notNull(),
  /** Fuso da casa (lembretes e "hoje" usam este fuso). */
  timezone: text("timezone").default("America/Sao_Paulo").notNull(),
  /** Hábito de compra: a cada quanto tempo vão ao mercado (null = não informado). */
  shopCadence: text("shop_cadence", {
    enum: ["weekly", "biweekly", "monthly"],
  }),
  /** Dia da semana preferido para as compras (0 = domingo). */
  shopDay: integer("shop_day"),
  onboardedAt: timestamp("onboarded_at"),
  /** Casa suspensa pelo admin (abuso, chargeback…): só leitura do próprio snapshot. */
  suspendedAt: timestamp("suspended_at"),
  suspendedReason: text("suspended_reason"),
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
    /** id do usuário no Neon Auth. Nulo nos perfis de criança (sem login). */
    userId: text("user_id"),
    /** account = adulto com login; profile = perfil de criança gerenciado por um responsável. */
    kind: text("kind", { enum: ["account", "profile"] })
      .default("account")
      .notNull(),
    ageBand: text("age_band", {
      enum: ["child_4_6", "child_7_9", "child_10_12", "teen_13_17"],
    }),
    displayName: text("display_name").notNull(),
    role: text("role", { enum: ["owner", "member"] })
      .default("member")
      .notNull(),
    slot: text("slot", {
      enum: ["a", "b", "c", "d", "e", "f", "g", "h"],
    }).notNull(),
    /** Foto de perfil já recortada/reduzida no cliente (base64). Nunca vai no snapshot: sai por /api/avatar/:id. */
    avatarData: text("avatar_data"),
    avatarType: text("avatar_type"),
    /** Muda a cada troca de foto; entra na URL para invalidar o cache do navegador. */
    avatarVersion: bigint("avatar_version", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("household_members_user_uq").on(t.userId),
    uniqueIndex("household_members_slot_uq").on(t.householdId, t.slot),
  ],
);

export const invites = pgTable(
  "invites",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    code: text("code").unique().notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("invites_household_idx").on(t.householdId)],
);

/** Cômodos ativos da casa (slug = RoomId do core). */
export const rooms = pgTable(
  "rooms",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    slug: text("slug").notNull(),
    /** Tipo do cômodo (quarto, banheiro…). Vazio em linhas antigas: deriva-se do slug. */
    kind: text("kind").default("").notNull(),
    /** Apelido do cômodo (null = nome padrão). */
    label: text("label"),
    position: integer("position").default(0).notNull(),
  },
  (t) => [uniqueIndex("rooms_household_slug_uq").on(t.householdId, t.slug)],
);

/** Pets da casa: geram tarefas próprias (passeios, banho, areia…). */
export const pets = pgTable(
  "pets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    species: text("species", {
      enum: ["dog", "cat", "bird", "fish", "rodent", "reptile", "other"],
    }).notNull(),
    size: text("size", { enum: ["mini", "small", "medium", "large", "giant"] }),
    coat: text("coat", { enum: ["short", "long"] }),
    outdoorAccess: boolean("outdoor_access"),
    litter: text("litter", { enum: ["litter", "pad", "none"] }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("pets_household_idx").on(t.householdId)],
);

/** Passos do onboarding (por conta, antes de existir casa): mede onde as pessoas desistem. */
export const onboardingEvents = pgTable(
  "onboarding_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    step: text("step").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("onboarding_events_user_idx").on(t.userId, t.createdAt)],
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

/** Quem cuida de cada tarefa (ex.: "guardar os brinquedos" → a criança). Uma pessoa por tarefa. */
export const taskAssignments = pgTable(
  "task_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    taskKey: text("task_key").notNull(),
    memberId: uuid("member_id")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [uniqueIndex("task_assignments_uq").on(t.householdId, t.taskKey)],
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

export const inventoryItems = pgTable(
  "inventory_items",
  {
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
  },
  (t) => [index("inventory_household_idx").on(t.householdId)],
);

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
  (t) => [
    uniqueIndex("reactions_uq").on(t.completionId, t.memberId, t.emoji),
    index("reactions_household_idx").on(t.householdId),
  ],
);

export const taskTrades = pgTable(
  "task_trades",
  {
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
  },
  (t) => [index("trades_household_idx").on(t.householdId)],
);

export const storeRewards = pgTable(
  "store_rewards",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    title: text("title").notNull(),
    costCoins: integer("cost_coins").notNull(),
    icon: text("icon").default("🎁").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("rewards_household_idx").on(t.householdId)],
);

export const rewardPurchases = pgTable(
  "reward_purchases",
  {
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
  },
  (t) => [index("purchases_household_idx").on(t.householdId)],
);

/** Lista de compras compartilhada da casa. */
export const shoppingItems = pgTable(
  "shopping_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    name: text("name").notNull(),
    quantity: text("quantity"),
    category: text("category"),
    /** now = acabou/urgente; soon = próxima ida; later = quando der. */
    urgency: text("urgency", { enum: ["now", "soon", "later"] })
      .default("soon")
      .notNull(),
    status: text("status", { enum: ["open", "bought"] })
      .default("open")
      .notNull(),
    addedBy: uuid("added_by").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    boughtBy: uuid("bought_by").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    boughtAt: timestamp("bought_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("shopping_items_household_idx").on(t.householdId, t.status)],
);

/** Cada ida ao mercado concluída: alimenta o hábito de compra da casa. */
export const shoppingTrips = pgTable(
  "shopping_trips",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    doneBy: uuid("done_by").references(() => householdMembers.id, {
      onDelete: "set null",
    }),
    itemsCount: integer("items_count").default(0).notNull(),
    doneAt: timestamp("done_at").defaultNow().notNull(),
  },
  (t) => [index("shopping_trips_household_idx").on(t.householdId, t.doneAt)],
);

/** Agenda semanal de cada adulto: em casa, fora o dia todo, ou sai e volta (lembretes respeitam isso). */
export const memberSchedule = pgTable(
  "member_schedule",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    weekday: integer("weekday").notNull(), // 0 = domingo
    mode: text("mode", { enum: ["home", "away", "partial"] })
      .default("home")
      .notNull(),
    leaveTime: text("leave_time"), // HH:MM
    backTime: text("back_time"),
  },
  (t) => [uniqueIndex("member_schedule_uq").on(t.memberId, t.weekday)],
);

/** Ausências de vários dias (viagem, plantão…). */
export const memberAbsences = pgTable(
  "member_absences",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    fromDate: varchar("from_date", { length: 10 }).notNull(),
    untilDate: varchar("until_date", { length: 10 }).notNull(),
    note: text("note"),
  },
  (t) => [index("member_absences_member_idx").on(t.memberId)],
);

/** Preferências de aviso por pessoa. Nada é enviado sem `enabled` (opt-in). */
export const notificationPrefs = pgTable("notification_prefs", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  memberId: uuid("member_id")
    .references(() => householdMembers.id, { onDelete: "cascade" })
    .unique()
    .notNull(),
  enabled: boolean("enabled").default(false).notNull(),
  morning: boolean("morning").default(true).notNull(),
  night: boolean("night").default(true).notNull(),
  due: boolean("due").default(true).notNull(),
  defrost: boolean("defrost").default(true).notNull(),
  partner: boolean("partner").default(true).notNull(),
  shopping: boolean("shopping").default(true).notNull(),
  quietStart: text("quiet_start").default("22:00").notNull(),
  quietEnd: text("quiet_end").default("07:00").notNull(),
  remindBeforeMin: integer("remind_before_min").default(15).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/** Dispositivos que aceitaram receber push (Web Push / VAPID). */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastSuccessAt: timestamp("last_success_at"),
    failCount: integer("fail_count").default(0).notNull(),
  },
  (t) => [
    uniqueIndex("push_subscriptions_endpoint_uq").on(t.endpoint),
    index("push_subscriptions_member_idx").on(t.memberId),
  ],
);

/** Registro de cada aviso (evita duplicar, ajuda o suporte e o painel admin). */
export const notificationLog = pgTable(
  "notification_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    memberId: uuid("member_id")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    kind: text("kind").notNull(),
    dedupeKey: text("dedupe_key").notNull(),
    status: text("status", { enum: ["sent", "failed", "no_device"] }).notNull(),
    detail: text("detail"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("notification_log_dedupe_uq").on(t.memberId, t.dedupeKey),
    index("notification_log_created_idx").on(t.createdAt),
  ],
);

/** Liberações de plano por casa: teste, cortesia, ajuste manual do admin. Nunca apagadas (auditoria). */
export const entitlementGrants = pgTable(
  "entitlement_grants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    plan: text("plan", { enum: ["free", "plus"] }).notNull(),
    source: text("source", {
      enum: ["trial", "founder", "manual", "promo"],
    }).notNull(),
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    /** Nulo = sem prazo. */
    expiresAt: timestamp("expires_at"),
    revokedAt: timestamp("revoked_at"),
    /** Ajustes finos: { family?: boolean, maxPets?: number, maxProjects?: number }. */
    overrides: jsonb("overrides"),
    reason: text("reason"),
    /** "system" ou o e-mail de quem concedeu no painel. */
    grantedBy: text("granted_by").default("system").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("entitlement_grants_household_idx").on(t.householdId)],
);

/** Assinatura paga da casa (web/Cakto, Google Play/RevenueCat ou manual). */
export const subscriptions = pgTable(
  "subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    provider: text("provider", { enum: ["cakto", "play", "manual"] }).notNull(),
    /** Identificador da assinatura no provedor (idempotência). */
    providerRef: text("provider_ref").notNull(),
    plan: text("plan", { enum: ["plus"] })
      .default("plus")
      .notNull(),
    interval: text("interval", { enum: ["monthly", "quarterly", "yearly"] })
      .default("quarterly")
      .notNull(),
    status: text("status", {
      enum: ["active", "trialing", "past_due", "canceled", "expired"],
    }).notNull(),
    currentPeriodEnd: timestamp("current_period_end"),
    /** Fim da carência depois de uma falha de pagamento. */
    graceUntil: timestamp("grace_until"),
    cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
    payerEmail: text("payer_email"),
    /** Último aviso de cobrança enviado (0 = nenhum). */
    dunningStep: integer("dunning_step").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("subscriptions_provider_ref_uq").on(t.provider, t.providerRef),
    index("subscriptions_household_idx").on(t.householdId),
  ],
);

/** Todo evento recebido dos provedores, guardado cru e processado uma única vez (idempotente). */
export const billingEvents = pgTable(
  "billing_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    provider: text("provider", { enum: ["cakto", "play", "manual"] }).notNull(),
    /** Id do evento no provedor: o mesmo evento chegando duas vezes é ignorado. */
    eventId: text("event_id").notNull(),
    type: text("type").notNull(),
    householdId: uuid("household_id").references(() => households.id, {
      onDelete: "set null",
    }),
    payload: jsonb("payload").notNull(),
    status: text("status", {
      enum: ["received", "applied", "ignored", "error"],
    })
      .default("received")
      .notNull(),
    error: text("error"),
    receivedAt: timestamp("received_at").defaultNow().notNull(),
    appliedAt: timestamp("applied_at"),
  },
  (t) => [
    uniqueIndex("billing_events_uq").on(t.provider, t.eventId),
    index("billing_events_received_idx").on(t.receivedAt),
  ],
);

/* ============ Administração da plataforma (app separado: apps/admin) ============ */

/** Quem pode entrar no painel. Ninguém vira admin por engano: só por esta tabela. */
export const platformStaff = pgTable("platform_staff", {
  id: uuid("id").defaultRandom().primaryKey(),
  /** Id do usuário no Neon Auth. */
  userId: text("user_id").unique().notNull(),
  email: text("email").notNull(),
  role: text("role", {
    enum: ["owner", "admin", "support", "finance", "viewer"],
  }).notNull(),
  /** Segredo TOTP cifrado (AES-256-GCM) — o segundo fator do painel. */
  totpSecret: text("totp_secret").notNull(),
  totpEnabledAt: timestamp("totp_enabled_at"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
  /** Último intervalo TOTP aceito: o mesmo código não vale duas vezes (anti-replay). */
  lastTotpStep: bigint("last_totp_step", { mode: "number" }),
});

/** Registro IMUTÁVEL de toda ação administrativa (triggers impedem UPDATE/DELETE/TRUNCATE). */
export const adminAuditLog = pgTable(
  "admin_audit_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    actorUserId: text("actor_user_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id"),
    householdId: text("household_id"),
    /** Justificativa obrigatória escrita por quem agiu. */
    reason: text("reason").notNull(),
    before: jsonb("before"),
    after: jsonb("after"),
    ip: text("ip"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("admin_audit_created_idx").on(t.createdAt),
    index("admin_audit_household_idx").on(t.householdId),
  ],
);

/** Pedidos de titulares (LGPD): exportar ou excluir os dados. Prazo de 15 dias. */
export const dataRequests = pgTable(
  "data_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    householdId: uuid("household_id").references(() => households.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["export", "delete"] }).notNull(),
    status: text("status", {
      enum: ["open", "in_progress", "done", "rejected"],
    })
      .default("open")
      .notNull(),
    note: text("note"),
    requestedAt: timestamp("requested_at").defaultNow().notNull(),
    dueAt: timestamp("due_at").notNull(),
    handledBy: text("handled_by"),
    completedAt: timestamp("completed_at"),
    /** O que foi feito (evidência para o titular e para auditoria). */
    evidence: text("evidence"),
  },
  (t) => [
    index("data_requests_status_idx").on(t.status, t.dueAt),
    index("data_requests_user_idx").on(t.userId),
  ],
);

/** Chaves liberar/bloquear recursos globais sem novo deploy (ex.: manutenção). */
export const featureFlags = pgTable("feature_flags", {
  key: text("key").primaryKey(),
  enabled: boolean("enabled").notNull(),
  description: text("description"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  updatedBy: text("updated_by"),
});

/** Anotações internas de suporte sobre uma casa. */
export const supportNotes = pgTable(
  "support_notes",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    author: text("author").notNull(),
    note: text("note").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [index("support_notes_household_idx").on(t.householdId)],
);

/**
 * Prova do aceite dos documentos legais (LGPD, art. 8º, § 2º: o ônus da prova é do controlador).
 * Guarda QUEM aceitou, QUAL documento, qual VERSÃO e o hash do texto exato, e QUANDO.
 * `guardian` = declaração do responsável ao criar perfil de criança (art. 14, § 1º); `subject` é o
 * id do perfil. Registros não são apagados ao trocar de versão: o histórico é a evidência.
 */
export const legalAcceptances = pgTable(
  "legal_acceptances",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    document: text("document", {
      enum: ["terms", "privacy", "guardian"],
    }).notNull(),
    version: text("version").notNull(),
    /** SHA-256 do texto do documento naquela versão. */
    contentHash: text("content_hash").notNull(),
    context: text("context", {
      enum: ["onboarding", "join", "update", "guardian"],
    }).notNull(),
    subject: text("subject"),
    acceptedAt: timestamp("accepted_at").defaultNow().notNull(),
  },
  (t) => [
    index("legal_acceptances_user_idx").on(t.userId, t.document, t.version),
  ],
);

/**
 * Marketing interno: avisos e promoções que a equipe programa pelo painel admin (sem deploy).
 * `banner` aparece como um cartão dispensável no topo de Hoje; `modal` interrompe com um popup
 * central. Uma casa nunca vê mais de uma por vez: a de maior prioridade entre as elegíveis.
 */
export const marketingCampaigns = pgTable(
  "marketing_campaigns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: text("title").notNull(),
    body: text("body").notNull(),
    ctaLabel: text("cta_label"),
    /** Caminho interno (ex.: "/plano") ou URL externa (https://…). */
    ctaUrl: text("cta_url"),
    kind: text("kind", { enum: ["modal", "banner"] })
      .default("banner")
      .notNull(),
    audience: text("audience", { enum: ["all", "free", "plus"] })
      .default("all")
      .notNull(),
    active: boolean("active").default(false).notNull(),
    /** Maior número vence quando mais de uma campanha é elegível ao mesmo tempo. */
    priority: integer("priority").default(0).notNull(),
    startsAt: timestamp("starts_at").defaultNow().notNull(),
    /** Nulo = sem data de fim. */
    endsAt: timestamp("ends_at"),
    dismissible: boolean("dismissible").default(true).notNull(),
    createdBy: text("created_by").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => [index("marketing_campaigns_active_idx").on(t.active, t.priority)],
);

/** Um evento por pessoa e campanha (exibido/clicado/dispensado): decide se mostra de novo. */
export const marketingCampaignEvents = pgTable(
  "marketing_campaign_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    campaignId: uuid("campaign_id")
      .references(() => marketingCampaigns.id, { onDelete: "cascade" })
      .notNull(),
    householdId: uuid("household_id").references(() => households.id, {
      onDelete: "cascade",
    }),
    memberId: uuid("member_id")
      .references(() => householdMembers.id, { onDelete: "cascade" })
      .notNull(),
    kind: text("kind", { enum: ["shown", "clicked", "dismissed"] }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => [
    index("marketing_events_campaign_idx").on(t.campaignId, t.kind),
    /** Uma pessoa só conta uma vez por tipo de evento (exibido/clicado/dispensado) — repetir não duplica. */
    uniqueIndex("marketing_events_unique").on(t.campaignId, t.memberId, t.kind),
  ],
);
