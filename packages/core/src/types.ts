export type TaskCategory =
  | "limpeza"
  | "roupa"
  | "gatos"
  | "cozinha"
  | "organizacao"
  | "manutencao"
  | "pets";

export type RoomId =
  | "quarto1"
  | "quarto2"
  | "sala"
  | "cozinha"
  | "banheiro"
  | "servico"
  | "gatos"
  | "casa";

export interface RoutineTask {
  id: string;
  r: "manha" | "noite";
  t: string;
  room: RoomId;
  cat: TaskCategory;
  mins: number;
  how: string;
}

export interface RecurringTask {
  id: string;
  t: string;
  room: RoomId;
  cat: TaskCategory;
  min: number;
  max: number;
  mins: number;
  day?: number;
  how: string;
}

export type TaskStatusState = "ok" | "due" | "late" | "nunca";

export interface TaskStatus {
  state: TaskStatusState;
  daysSinceLast: number | null;
  minDays: number;
  maxDays: number;
  lastCompletion?: {
    at: string;
    who: string;
  } | null;
}

export interface CompletionEntry {
  id: string;
  taskId: string;
  who: string;
  at: string; // ISO date string
  pts: number;
  note?: string;
  dateKey: string; // YYYY-MM-DD
}

export interface Meal {
  id: string;
  date: string; // YYYY-MM-DD
  slot: "almoco" | "jantar";
  dish: string;
  protein: string; // e.g. 'frango_file'
  cooked?: boolean;
  pulled?: boolean;
}

export interface ProteinInfo {
  key: string;
  name: string;
  hours: number;
}

export interface LitterSettings {
  cats: number;
  boxes: number;
  kgPerBox: number;
  bagKg: number;
  minDays: number;
  maxDays: number;
  currentStock: number; // in bags
}

export interface Achievement {
  id: string;
  icon: string;
  name: string;
  description: string;
  unlocked: boolean;
  progress: string;
}
