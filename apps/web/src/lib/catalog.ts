import type { RoomId, TaskCategory } from "@ocafy/core";

// Catálogo compartilhado (web, mobile e API) vive no @ocafy/core.
export {
  DEFAULT_REWARDS,
  OFFICE_GOALS,
  OFFICE_GOAL_XP,
  PSEUDO_TASKS,
  REACTIONS,
  TASK_MAP,
  XP_PER_COIN,
} from "@ocafy/core";
export type { AnyTask, OfficeGoal, PseudoTask, ReactionKey } from "@ocafy/core";

export const CATEGORY_NAMES: Record<TaskCategory, string> = {
  limpeza: "Limpeza",
  roupa: "Roupas",
  gatos: "Gatos",
  cozinha: "Cozinha",
  organizacao: "Organização",
  manutencao: "Manutenção",
};

export const ROOM_ORDER: RoomId[] = [
  "quarto1",
  "quarto2",
  "sala",
  "cozinha",
  "banheiro",
  "servico",
  "gatos",
  "casa",
];

export const SLOT_INFO = {
  almoco: { name: "Almoço", label: "Almoço (12h)" },
  jantar: { name: "Jantar", label: "Jantar (19h30)" },
} as const;

export const INVENTORY_DEST = {
  fica: "Fica no escritório",
  outro: "Outro cômodo",
  doar: "Doar",
  vender: "Vender",
  lixo: "Descartar",
} as const;
export type InventoryDest = keyof typeof INVENTORY_DEST;

export const INVENTORY_CATEGORIES = [
  "Documentos",
  "Eletrônicos",
  "Cabos e acessórios",
  "Livros e papelaria",
  "Ferramentas",
  "Decoração",
  "Roupas e tecidos",
  "Cozinha",
  "Diversos",
];
