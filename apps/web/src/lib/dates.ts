import { daysBetween } from "@ocafy/core";

export const WEEKDAYS = [
  "domingo",
  "segunda",
  "terça",
  "quarta",
  "quinta",
  "sexta",
  "sábado",
];

const pad = (n: number) => String(n).padStart(2, "0");

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromKey = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (d: Date, n: number) =>
  new Date(d.getTime() + n * 864e5);

export const fmtTime = (d: Date) =>
  `${pad(d.getHours())}h${pad(d.getMinutes())}`;

export const fmtShort = (d: Date) =>
  `${WEEKDAYS[d.getDay()].slice(0, 3)} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;

export const capitalize = (s: string) =>
  s ? s[0].toUpperCase() + s.slice(1) : s;

export function relDay(d: Date, now: Date): string {
  const n = daysBetween(now, d);
  if (n === 0) return "hoje";
  if (n === 1) return "amanhã";
  if (n === -1) return "ontem";
  return fmtShort(d);
}

/** Chave (YYYY-MM-DD) da segunda-feira da semana de `now`. */
export function mondayKey(now: Date): string {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

export function daysAgoPhrase(d: number): string {
  if (d === 0) return "hoje";
  if (d === 1) return "ontem";
  return `há ${d} dias`;
}

export const uid = () =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
