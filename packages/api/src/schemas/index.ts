import {
  PET_SPECIES,
  PROTEINS,
  type PetSpecies,
  REACTIONS,
  ROOM_KINDS,
  type RoomKind,
} from "@ocafy/core";
import { z } from "zod";

export const dateKey = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Data em formato YYYY-MM-DD");
export const uuid = z.string().uuid();

export const litterInput = z.object({
  cats: z.number().int().min(1).max(10),
  boxes: z.number().int().min(1).max(10),
  kgPerBox: z.number().min(0.5).max(20),
  bagKg: z.number().min(0.5).max(30),
  minDays: z.number().int().min(1).max(60),
  maxDays: z.number().int().min(1).max(60),
});

const kinds = Object.keys(ROOM_KINDS) as [RoomKind, ...RoomKind[]];
const species = Object.keys(PET_SPECIES) as [PetSpecies, ...PetSpecies[]];

/** Perfil da casa. Família fica para a próxima versão (só solo/casal por enquanto). */
export const profileInput = z.object({
  mode: z.enum(["solo", "couple", "family"]),
  dwelling: z.enum(["apartment", "house", "townhouse", "studio"]),
  size: z.enum(["s", "m", "l"]),
  intensity: z.enum(["light", "standard", "full"]),
  cooksAtHome: z.boolean(),
  usesFrozen: z.boolean(),
  hasWasher: z.boolean(),
  hasPlants: z.boolean(),
  hasCar: z.boolean(),
  officeProject: z.boolean(),
});

/** Cômodos em ordem; o slug é decidido pelo servidor (o 1º de cada tipo mantém o slug antigo). */
export const roomsInput = z
  .array(
    z.object({
      kind: z.enum(kinds),
      label: z.string().trim().max(30).nullish(),
    }),
  )
  .max(40)
  .superRefine((list, ctx) => {
    const n: Partial<Record<RoomKind, number>> = {};
    for (const r of list) {
      n[r.kind] = (n[r.kind] ?? 0) + 1;
      if ((n[r.kind] ?? 0) > ROOM_KINDS[r.kind].max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `No máximo ${ROOM_KINDS[r.kind].max} × ${ROOM_KINDS[r.kind].label.toLowerCase()}.`,
        });
        return;
      }
    }
  });

export const petInput = z.object({
  /** Existente (mantém o histórico) ou ausente (novo). */
  id: uuid.optional(),
  name: z.string().trim().min(1, "Dê um nome").max(20),
  species: z.enum(species),
  size: z.enum(["mini", "small", "medium", "large", "giant"]).nullish(),
  coat: z.enum(["short", "long"]).nullish(),
  outdoorAccess: z.boolean().nullish(),
  litter: z.enum(["litter", "pad", "none"]).nullish(),
});
export const petsInput = z.array(petInput).max(12);

export const createHouseholdSchema = z.object({
  houseName: z.string().trim().min(2, "Nome da casa muito curto").max(40),
  memberName: z.string().trim().min(2, "Seu nome é obrigatório").max(24),
  /** Versão dos Termos/Política que a pessoa aceitou na tela (o servidor confere). */
  acceptedLegalVersion: z.string().min(1),
  profile: profileInput,
  rooms: roomsInput,
  pets: petsInput,
});

export const updateProfileSchema = z.object({
  profile: profileInput,
  rooms: roomsInput,
  pets: petsInput,
});

export const onboardingStepSchema = z.object({
  step: z
    .string()
    .trim()
    .regex(/^[a-z0-9_:-]{1,40}$/),
});

export const memberProfileSchema = z.object({
  name: z.string().trim().min(1, "Dê um nome").max(20),
  ageBand: z.enum(["child_4_6", "child_7_9", "child_10_12", "teen_13_17"]),
});

/** Criar perfil de criança exige a declaração do responsável (LGPD, art. 14, § 1º). */
export const addProfileSchema = memberProfileSchema.extend({
  guardianDeclaration: z.literal(true, {
    errorMap: () => ({
      message: "Confirme que você é o responsável legal pela criança.",
    }),
  }),
});

export const shoppingItemSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(1, "Digite o item").max(60),
  quantity: z.string().trim().max(24).optional(),
  category: z
    .enum([
      "Hortifruti",
      "Açougue e peixaria",
      "Padaria",
      "Laticínios e frios",
      "Mercearia",
      "Bebidas",
      "Limpeza",
      "Higiene",
      "Pets",
      "Outros",
    ])
    .optional(),
  urgency: z.enum(["now", "soon", "later"]).optional(),
});

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Horário HH:MM");

export const notifPrefsPatch = z.object({
  enabled: z.boolean().optional(),
  morning: z.boolean().optional(),
  night: z.boolean().optional(),
  due: z.boolean().optional(),
  defrost: z.boolean().optional(),
  partner: z.boolean().optional(),
  shopping: z.boolean().optional(),
  quietStart: hhmm.optional(),
  quietEnd: hhmm.optional(),
  remindBeforeMin: z.number().int().min(0).max(180).optional(),
});

/**
 * Só aceitamos endpoints dos serviços de push dos navegadores: o servidor faz uma chamada
 * HTTP para esse endereço, então um endpoint arbitrário seria uma porta para SSRF.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^[a-z0-9-]+\.push\.services\.mozilla\.com$/,
  /^[a-z0-9.-]+\.notify\.windows\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9.-]+\.push\.apple\.com$/,
];

export const isAllowedPushEndpoint = (raw: string): boolean => {
  try {
    const u = new URL(raw);
    return (
      u.protocol === "https:" && PUSH_HOSTS.some((r) => r.test(u.hostname))
    );
  } catch {
    return false;
  }
};

export const pushSubscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(600)
    .refine(isAllowedPushEndpoint, "Serviço de push não suportado."),
  p256dh: z.string().min(20).max(200),
  auth: z.string().min(8).max(100),
  userAgent: z.string().max(200).optional(),
});

export const dayScheduleSchema = z.object({
  weekday: z.number().int().min(0).max(6),
  mode: z.enum(["home", "away", "partial"]),
  leave: hhmm.nullish(),
  back: hhmm.nullish(),
});

export const absenceSchema = z.object({
  from: dateKey,
  until: dateKey,
  note: z.string().trim().max(60).optional(),
});

export const joinSchema = z.object({
  code: z.string().trim().min(4).max(16),
  acceptedLegalVersion: z.string().min(1),
  memberName: z.string().trim().min(2, "Seu nome é obrigatório").max(24),
});

export const completionInput = z.object({
  id: uuid.optional(),
  at: z.string().datetime(),
  dateKey,
  pts: z.number().int().min(1).max(500),
});

export const completeTaskSchema = completionInput.extend({
  /** Perfil de criança da casa que fez a tarefa (o responsável registra por ela). */
  forMemberId: uuid.optional(),
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
