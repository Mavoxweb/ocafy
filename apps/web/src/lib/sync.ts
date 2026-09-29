"use client";

import type { Snapshot } from "@ocafy/api";
import { type AppState, EMPTY_STATE, store } from "./store";
import { errorCode, errorMessage, trpc } from "./trpc";
import { toast } from "./ui";

/**
 * Sincronização com o servidor:
 *  - baixa o snapshot da casa (na abertura, ao voltar para a aba e a cada 15 s);
 *  - as ações atualizam o cache na hora (otimista) e chamam `mutate`;
 *  - depois da última mutação pendente, o snapshot é rebaixado para reconciliar
 *    (se o servidor recusou ou ajustou algo, a tela volta ao que é verdade).
 */

const POLL_MS = 15_000;
const SETTLE_MS = 350;

let pending = 0;
/** Mutações saem em fila: a ordem dos cliques é a ordem no servidor (ex.: feito → desfazer). */
let chain: Promise<unknown> = Promise.resolve();
let inflight: Promise<void> | null = null;
let lastApplied = "";
/** Revisão do último snapshot aplicado: o polling só baixa tudo se ela mudou. */
let lastRev: number | null = null;
let settleTimer: ReturnType<typeof setTimeout> | undefined;
let started = false;

function fromSnapshot(d: Snapshot): AppState {
  return {
    ...EMPTY_STATE,
    status: "ready",
    household: d.household,
    members: d.members.map((m) => ({
      id: m.id,
      name: m.name,
      slot: m.slot,
      kind: m.kind,
      ageBand: m.ageBand,
      avatar: m.avatarVersion
        ? `/api/avatar/${m.id}?v=${m.avatarVersion}`
        : null,
    })),
    meId: d.meId,
    isOwner: d.isOwner,
    invite: d.invite,
    profile: d.profile,
    rooms: d.rooms,
    pets: d.pets,
    litter: d.litter,
    litterStock: d.litterStock,
    overrides: d.overrides,
    assignments: d.assignments,
    completions: d.completions,
    meals: d.meals,
    office: d.office,
    shopping: d.shopping,
    notifications: d.notifications,
    suspended: d.suspended,
    campaign: d.campaign,
    legal: d.legal,
    plan: d.plan,
    rewards: d.rewards,
    purchases: d.purchases,
    reactions: d.reactions,
    trades: d.trades,
  };
}

/** Baixa e aplica o snapshot (ignorado enquanto há mutações em andamento). */
export function refresh(opts: { force?: boolean } = {}): Promise<void> {
  // Um refresh forçado nunca é engolido por outro em andamento (que pode ser só um pulse).
  if (inflight)
    return opts.force ? inflight.then(() => refresh(opts)) : inflight;
  inflight = (async () => {
    try {
      // Polling barato: só a revisão da casa (bytes). Snapshot completo apenas se mudou.
      if (
        !opts.force &&
        lastRev != null &&
        store.getState().status === "ready"
      ) {
        const { rev } = await trpc.household.pulse.query();
        if (rev === lastRev) return;
      }
      const res = await trpc.household.snapshot.query();
      if (pending > 0) return; // uma mutação está a caminho: reconcilia depois
      if (res.status === "none") {
        lastApplied = "";
        lastRev = null;
        store.set(() => ({ ...EMPTY_STATE, status: "nohousehold" }));
        return;
      }
      lastRev = res.data.rev;
      const json = JSON.stringify(res.data);
      if (json === lastApplied && store.getState().status === "ready") return;
      lastApplied = json;
      store.set(() => fromSnapshot(res.data));
    } catch (e) {
      if (errorCode(e) === "UNAUTHORIZED") {
        lastApplied = "";
        lastRev = null;
        store.set(() => ({ ...EMPTY_STATE, status: "anon" }));
      } else if (store.getState().status === "loading") {
        store.set((s) => ({ ...s, status: "error" }));
      }
      // com dados já carregados, falhas de rede passam em silêncio: tenta no próximo ciclo
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

/** Executa uma mutação no servidor e reconcilia depois. Nunca lança. */
export async function mutate<T>(run: () => Promise<T>): Promise<T | undefined> {
  pending++;
  const result = chain.then(run);
  chain = result.then(
    () => undefined,
    () => undefined,
  );
  try {
    return await result;
  } catch (e) {
    if (errorCode(e) === "UNAUTHORIZED") {
      store.set(() => ({ ...EMPTY_STATE, status: "anon" }));
    } else {
      toast(
        errorMessage(e, "Não foi possível salvar agora. Confira a conexão."),
      );
    }
    return undefined;
  } finally {
    pending--;
    clearTimeout(settleTimer);
    settleTimer = setTimeout(() => {
      if (pending === 0) {
        lastApplied = ""; // força reaplicar (desfaz o que o servidor recusou)
        void refresh({ force: true });
      }
    }, SETTLE_MS);
  }
}

/** Mutação cujo resultado importa para o chamador (onboarding, convite). */
export async function mutateStrict<T>(run: () => Promise<T>): Promise<T> {
  pending++;
  try {
    return await run();
  } finally {
    pending--;
  }
}

/** Liga polling + refresh ao voltar para a aba. Retorna a função de limpeza. */
export function startSync(opts: { initial?: boolean } = {}): () => void {
  if (started) return () => {};
  started = true;
  if (opts.initial !== false) void refresh();
  const tick = () => {
    // Sem sessão não há o que sincronizar (o login chama `refresh` ao concluir).
    if (document.hidden || store.getState().status === "anon") return;
    void refresh();
  };
  const id = setInterval(tick, POLL_MS);
  document.addEventListener("visibilitychange", tick);
  window.addEventListener("focus", tick);
  window.addEventListener("online", tick);
  return () => {
    started = false;
    clearInterval(id);
    document.removeEventListener("visibilitychange", tick);
    window.removeEventListener("focus", tick);
    window.removeEventListener("online", tick);
  };
}

/** Limpa o cache (logout). */
export function resetSync() {
  lastApplied = "";
  lastRev = null;
  store.set(() => ({ ...EMPTY_STATE, status: "loading" }));
}
