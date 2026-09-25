import { db, featureFlags } from "@ocafy/db";

/**
 * Chaves globais (liga/desliga sem novo deploy), editadas no painel admin.
 * Ficam em cache por poucos segundos: barato para checar em toda chamada.
 *   maintenance   → o app só permite leitura
 *   signups_open  → novas casas podem ser criadas
 *   push_enabled  → envio de avisos push
 */

const CACHE_MS = 15_000;
let cache: { at: number; map: Map<string, boolean> } | null = null;

async function load(): Promise<Map<string, boolean>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.map;
  try {
    const rows = await db.select().from(featureFlags);
    cache = {
      at: Date.now(),
      map: new Map(rows.map((r) => [r.key, r.enabled])),
    };
  } catch {
    // sem banco para ler as chaves: usa o último valor conhecido (ou o padrão de cada uso)
    cache ??= { at: Date.now(), map: new Map() };
  }
  return cache.map;
}

export async function flag(key: string, fallback: boolean): Promise<boolean> {
  return (await load()).get(key) ?? fallback;
}

/** Depois de alterar uma chave (painel) ou em testes. */
export function invalidateFlags(): void {
  cache = null;
}
