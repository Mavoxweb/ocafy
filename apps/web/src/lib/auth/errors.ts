/**
 * O cliente do Neon Auth pode LANÇAR exceção em respostas HTTP 4xx (em vez de devolver
 * `{ error }`). Só falha de rede de verdade deve virar "sem conexão".
 */
export function isNetworkError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return (
    (e instanceof TypeError && !/status|invalid|token/i.test(msg)) ||
    /failed to fetch|networkerror|network request failed|load failed/i.test(msg)
  );
}
