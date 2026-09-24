import { PROTEINS, REACTIONS } from "@ocafy/core";
import { z } from "zod";

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data em formato YYYY-MM-DD");
export const uuid = z.string().uuid();

export const roomId = z.enum([
  "quarto1",
  "quarto2",
  "sala",
  "cozinha",
  "banheiro",
  "servico",
  "gatos",
  "casa",
]);

export const litterInput = z.object({
  cats: z.number().int().min(1).max(10),
  boxes: z.number().int().min(1).max(10),
  kgPerBox: z.number().min(0.5).max(20),
  bagKg: z.number().min(0.5).max(30),
  minDays: z.number().int().min(1).max(60),
  maxDays: z.number().int().min(1).max(60),
});

export const createHouseholdSchema = z.object({
  houseName: z.string().trim().min(2, "Nome da casa muito curto").max(40),
  memberName: z.string().trim().min(2, "Seu nome é obrigatório").max(24),
  rooms: z.array(roomId).max(8),
  litter: litterInput,
  litterStock: z.number().int().min(0).max(999).nullable(),
});

export const joinSchema = z.object({
  code: z.string().trim().min(4).max(16),
  memberName: z.string().trim().min(2, "Seu nome é obrigatório").max(24),
});

export const completionInput = z.object({
  id: uuid.optional(),
  at: z.string().datetime(),
  dateKey,
  pts: z.number().int().min(1).max(500),
});

export const completeTaskSchema = completionInput.extend({
  taskKey: z.string().min(1).max(60),
  note: z.string().trim().max(120).optional(),
});

export const mealSchema = z.object({
  id: uuid.optional(),
  dateKey,
  slot: z.enum(["almoco", "jantar"]),
  dish: z.string().trim().max(80),
  protein: z.enum(PROTEINS.map((p) => p.key) as [string, ...string[]]),
});

const reactionKeys = Object.keys(REACTIONS) as [
  keyof typeof REACTIONS,
  ...(keyof typeof REACTIONS)[],
];

export const reactionSchema = z.object({
  completionId: uuid,
  emoji: z.enum(reactionKeys),
});

export const rewardSchema = z.object({
  id: uuid.optional(),
  title: z.string().trim().min(2).max(60),
  costCoins: z.number().int().min(1).max(100000),
  icon: z.string().max(16).default("🎁"),
});

export const inventorySchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1).max(60),
  category: z.string().trim().min(1).max(40),
  dest: z.enum(["fica", "outro", "doar", "vender", "lixo"]),
});
