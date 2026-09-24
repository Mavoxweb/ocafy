import { z } from "zod";

export const createHouseholdSchema = z.object({
  name: z.string().min(2, "Nome da casa muito curto"),
  memberName: z.string().min(2, "Seu nome é obrigatório"),
});

export const completeTaskSchema = z.object({
  taskId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data em formato YYYY-MM-DD"),
  note: z.string().optional(),
});

export const mealSchema = z.object({
  dateKey: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  slot: z.enum(["almoco", "jantar"]),
  dishName: z.string().min(1),
  proteinKey: z.string().min(1),
  defrostHours: z.number().min(0).default(24),
});

export const reactionSchema = z.object({
  completionId: z.string().uuid(),
  emoji: z.enum(["celebrar", "fogo", "coracao", "palmas"]),
});

export const tradeSchema = z.object({
  taskId: z.string().uuid(),
  assigneeId: z.string().uuid(),
});

export const rewardSchema = z.object({
  title: z.string().min(2),
  costCoins: z.number().min(1),
  icon: z.string().default("🎁"),
});

export const buyRewardSchema = z.object({
  rewardId: z.string().uuid(),
});

export const resolvePurchaseSchema = z.object({
  purchaseId: z.string().uuid(),
  approved: z.boolean(),
});
