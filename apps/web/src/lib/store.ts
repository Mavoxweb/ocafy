"use client";

import type { CompletionEntry, LitterSettings, RoomId } from "@ocafy/core";
import { useSyncExternalStore } from "react";
import type { InventoryDest, ReactionKey } from "./catalog";

/**
 * Estado do app. Hoje persiste no localStorage (modo local, como o protótipo);
 * a forma dos dados espelha o schema do @ocafy/db para a troca por tRPC.
 */

export type Slot = "a" | "b";

export interface Member {
  id: string;
  name: string;
  slot: Slot;
}

export interface MealRecord {
  id: string;
  date: string; // YYYY-MM-DD
  slot: "almoco" | "jantar";
  dish: string;
  protein: string;
  by: string;
  pulledBy?: string;
  cookedBy?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  dest: InventoryDest;
  who: string;
  at: string;
}

export interface OfficeState {
  start: string | null; // segunda-feira em que o projeto começou
  done: Record<string, { at: string; who: string }>;
  steps: Record<string, Record<number, boolean>>;
  inventory: InventoryItem[];
}

export interface Reward {
  id: string;
  title: string;
  costCoins: number;
  icon: string;
}

export interface Purchase {
  id: string;
  rewardId: string;
  memberId: string;
  costCoins: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
  resolvedAt?: string;
}

export interface Reaction {
  id: string;
  completionId: string;
  memberId: string;
  emoji: ReactionKey;
}

export interface Trade {
  id: string;
  taskId: string;
  requesterId: string;
  assigneeId: string;
  status: "pending" | "accepted" | "rejected";
  createdAt: string;
  resolvedAt?: string;
}

export interface TaskOverride {
  min?: number;
  max?: number;
  off?: boolean;
}

export interface AppState {
  hydrated: boolean;
  household: { id: string; name: string; createdAt: string } | null;
  members: Member[];
  meId: string | null;
  rooms: RoomId[];
  litter: Omit<LitterSettings, "currentStock">;
  litterStock: number | null;
  overrides: Record<string, TaskOverride>;
  completions: CompletionEntry[];
  meals: MealRecord[];
  office: OfficeState;
  rewards: Reward[];
  purchases: Purchase[];
  reactions: Reaction[];
  trades: Trade[];
}

export const DEFAULT_LITTER: AppState["litter"] = {
  cats: 3,
  boxes: 2,
  kgPerBox: 4,
  bagKg: 4,
  minDays: 5,
  maxDays: 7,
};

export const ALL_ROOMS: RoomId[] = [
  "quarto1",
  "quarto2",
  "sala",
  "cozinha",
  "banheiro",
  "servico",
  "gatos",
  "casa",
];

export const EMPTY_STATE: AppState = {
  hydrated: false,
  household: null,
  members: [],
  meId: null,
  rooms: ALL_ROOMS,
  litter: DEFAULT_LITTER,
  litterStock: null,
  overrides: {},
  completions: [],
  meals: [],
  office: { start: null, done: {}, steps: {}, inventory: [] },
  rewards: [],
  purchases: [],
  reactions: [],
  trades: [],
};

const KEY = "ocafy-web-v1";
const listeners = new Set<() => void>();
let state: AppState = EMPTY_STATE;

function persist() {
  try {
    const { hydrated: _h, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* armazenamento indisponível: o app segue funcionando em memória */
  }
}

function emit() {
  for (const l of listeners) l();
}

function readStored(): Partial<AppState> {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Partial<AppState>) : {};
  } catch {
    return {};
  }
}

export const store = {
  getState: () => state,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Carrega o localStorage (client-side). Chamar uma vez ao montar o app. */
  hydrate() {
    state = { ...EMPTY_STATE, ...readStored(), hydrated: true };
    emit();
  },

  set(updater: (s: AppState) => AppState) {
    state = updater(state);
    persist();
    emit();
  },

  reset() {
    state = { ...EMPTY_STATE, hydrated: true };
    persist();
    emit();
  },
};

export function useAppState(): AppState {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    () => EMPTY_STATE,
  );
}
