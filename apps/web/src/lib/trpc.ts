"use client";

import type { AppRouter } from "@ocafy/api";
import { parsePlanLimit } from "@ocafy/core";
import { TRPCClientError, createTRPCClient, httpBatchLink } from "@trpc/client";

export const trpc = createTRPCClient<AppRouter>({
  links: [httpBatchLink({ url: "/api/trpc" })],
});

export type TRPCCode = "UNAUTHORIZED" | "PRECONDITION_FAILED" | string;

export function errorCode(e: unknown): TRPCCode | null {
  return e instanceof TRPCClientError ? (e.data?.code ?? null) : null;
}

/** O erro é de limite do plano (o app oferece o Plus)? */
export function isPlanLimit(e: unknown): boolean {
  return e instanceof TRPCClientError && !!parsePlanLimit(e.message);
}

export function errorMessage(e: unknown, fallback: string): string {
  if (e instanceof TRPCClientError) {
    const zod = e.data?.zodError as
      | { fieldErrors?: Record<string, string[]> }
      | undefined;
    const first = zod?.fieldErrors
      ? Object.values(zod.fieldErrors).flat()[0]
      : undefined;
    if (first) return first;
    if (e.message === "LEGAL_VERSION_MISMATCH")
      return "Os Termos foram atualizados. Recarregue a página e aceite a nova versão.";
    if (e.message === "MAINTENANCE")
      return "O Ocafy está em manutenção. Tente de novo em alguns minutos.";
    if (e.message === "HOUSEHOLD_SUSPENDED")
      return "Esta casa está suspensa. Fale com o suporte.";
    const limit = parsePlanLimit(e.message);
    if (limit) return limit.text;
    if (
      e.data?.code &&
      e.data.code !== "INTERNAL_SERVER_ERROR" &&
      e.message &&
      e.message !== "NO_HOUSEHOLD"
    ) {
      return e.message;
    }
  }
  return fallback;
}
