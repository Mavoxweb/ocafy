"use client";

import {
  type AgeBand,
  type CompletionEntry,
  DEFAULT_PROFILE,
  type HouseProfile,
  type LitterSettings,
  type MemberSlot,
  type Pet,
  type RoomInstance,
  defaultRoomCounts,
  roomsFromCounts,
} from "@ocafy/core";
import { useSyncExternalStore } from "react";
import type { InventoryDest, ReactionKey } from "./catalog";

/**
 * Cache local do estado da casa. A fonte da verdade é o servidor (tRPC/Neon):
 * `sync.ts` baixa o snapshot, aplica aqui, e as ações mudam este cache de forma
 * otimista antes de confirmar no servidor.
 */

export type Slot = MemberSlot;

export interface Member {
  id: string;
  name: string;
  slot: Slot;
  /** account = adulto com login; profile = perfil de criança. */
  kind: "account" | "profile";
  ageBand: AgeBand | null;
  /** URL da foto (/api/avatar/…) ou data URL enquanto o envio está em andamento. */
  avatar: string | null;
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

export type LoadStatus = "loading" | "anon" | "nohousehold" | "ready" | "error";

export interface AppState {
  status: LoadStatus;
  household: { id: string; name: string; createdAt: string } | null;
  members: Member[];
  meId: string | null;
  isOwner: boolean;
  invite: { code: string; expiresAt: string } | null;
  /** Perfil da casa + cômodos + pets = entrada do motor de rotinas (ver selectors → planOf). */
  profile: HouseProfile;
  rooms: RoomInstance[];
  pets: Pet[];
  litter: Omit<LitterSettings, "currentStock">;
  litterStock: number | null;
  overrides: Record<string, TaskOverride>;
  /** Quem cuida de cada tarefa (chave da tarefa → id da pessoa). */
  assignments: Record<string, string>;
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

export const EMPTY_STATE: AppState = {
  status: "loading",
  household: null,
  members: [],
  meId: null,
  isOwner: false,
  invite: null,
  profile: DEFAULT_PROFILE,
  rooms: roomsFromCounts(defaultRoomCounts("apartment", "m")),
  pets: [],
  litter: DEFAULT_LITTER,
  litterStock: null,
  overrides: {},
  assignments: {},
  completions: [],
  meals: [],
  office: { start: null, done: {}, steps: {}, inventory: [] },
  rewards: [],
  purchases: [],
  reactions: [],
  trades: [],
};

const listeners = new Set<() => void>();
let state: AppState = EMPTY_STATE;

export const store = {
  getState: () => state,

  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  set(updater: (s: AppState) => AppState) {
    state = updater(state);
    for (const l of listeners) l();
  },
};

export function useAppState(): AppState {
  return useSyncExternalStore(
    store.subscribe,
    store.getState,
    () => EMPTY_STATE,
  );
}
