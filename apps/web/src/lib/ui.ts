"use client";

import { useSyncExternalStore } from "react";

/* ---------- toast com "Desfazer" ---------- */
interface ToastState {
  id: number;
  msg: string;
  undo: (() => void) | null;
  on: boolean;
}

let toastState: ToastState = { id: 0, msg: "", undo: null, on: false };
const toastListeners = new Set<() => void>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function setToast(next: ToastState) {
  toastState = next;
  for (const l of toastListeners) l();
}

export function toast(msg: string, undo?: () => void) {
  setToast({ id: toastState.id + 1, msg, undo: undo ?? null, on: true });
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => setToast({ ...toastState, on: false }), 5000);
}

export function dismissToast() {
  clearTimeout(toastTimer);
  setToast({ ...toastState, on: false });
}

const SERVER_TOAST: ToastState = { id: 0, msg: "", undo: null, on: false };

export function useToast(): ToastState {
  return useSyncExternalStore(
    (l) => {
      toastListeners.add(l);
      return () => {
        toastListeners.delete(l);
      };
    },
    () => toastState,
    () => SERVER_TOAST,
  );
}

/* ---------- sheet global (modal em folha) ---------- */
export type SheetKind =
  | { kind: "task"; id: string }
  | { kind: "goal"; id: string }
  | { kind: "settings" }
  | { kind: "method" };

let sheetState: SheetKind | null = null;
const sheetListeners = new Set<() => void>();

export function openSheet(s: SheetKind) {
  sheetState = s;
  for (const l of sheetListeners) l();
}

export function closeSheet() {
  sheetState = null;
  for (const l of sheetListeners) l();
}

export function useSheet(): SheetKind | null {
  return useSyncExternalStore(
    (l) => {
      sheetListeners.add(l);
      return () => {
        sheetListeners.delete(l);
      };
    },
    () => sheetState,
    () => null,
  );
}

/* ---------- tema ---------- */
export type Theme = "light" | "dark" | "auto";
const THEME_KEY = "ocafy-theme";
const themeListeners = new Set<() => void>();

export function readTheme(): Theme {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function applyTheme(t: Theme) {
  const root = document.documentElement;
  if (t === "auto") root.removeAttribute("data-theme");
  else root.dataset.theme = t;
  const dark =
    t === "dark" ||
    (t === "auto" && matchMedia("(prefers-color-scheme: dark)").matches);
  let meta = document.querySelector<HTMLMetaElement>("meta[name=theme-color]");
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = dark ? "#111113" : "#FFFFFF";
}

export function setTheme(t: Theme) {
  try {
    localStorage.setItem(THEME_KEY, t);
  } catch {
    /* ignora */
  }
  applyTheme(t);
  for (const l of themeListeners) l();
}

export function isDark(t: Theme): boolean {
  return (
    t === "dark" ||
    (t === "auto" &&
      typeof matchMedia !== "undefined" &&
      matchMedia("(prefers-color-scheme: dark)").matches)
  );
}

export function useTheme(): Theme {
  return useSyncExternalStore(
    (l) => {
      themeListeners.add(l);
      return () => {
        themeListeners.delete(l);
      };
    },
    readTheme,
    () => "auto" as Theme,
  );
}
