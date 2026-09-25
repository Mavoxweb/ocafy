import { sendNotification, setVapidDetails } from "web-push";

/**
 * Web Push (VAPID). Variáveis de ambiente — opcionais até você gerar as chaves
 * (`npx web-push generate-vapid-keys`):
 *   VAPID_PUBLIC_KEY   chave pública (também vai para o navegador)
 *   VAPID_PRIVATE_KEY  chave privada (só no servidor)
 *   VAPID_SUBJECT      "mailto:contato@seudominio.com.br"
 *
 * Sem chaves, nada é enviado e o app segue funcionando (mostra que os avisos ainda não estão ligados).
 */

export function vapidPublicKey(): string | null {
  return process.env.VAPID_PUBLIC_KEY || null;
}

export function pushConfigured(): boolean {
  return !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;
}

let ready = false;
function init() {
  if (ready) return;
  setVapidDetails(
    process.env.VAPID_SUBJECT ?? "mailto:contato@ocafy.app",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );
  ready = true;
}

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  /** Agrupa/substitui avisos do mesmo tipo no aparelho. */
  tag?: string;
}

export type PushResult =
  | { ok: true }
  | { ok: false; gone: boolean; detail: string };

/** Envia um push. `gone` = a assinatura não existe mais (apagar do banco). */
export async function sendPush(
  target: PushTarget,
  payload: PushPayload,
): Promise<PushResult> {
  if (!pushConfigured()) {
    return { ok: false, gone: false, detail: "not_configured" };
  }
  try {
    init();
    await sendNotification(
      {
        endpoint: target.endpoint,
        keys: { p256dh: target.p256dh, auth: target.auth },
      },
      JSON.stringify(payload),
      { TTL: 60 * 60 },
    );
    return { ok: true };
  } catch (e) {
    const status = (e as { statusCode?: number }).statusCode;
    return {
      ok: false,
      gone: status === 404 || status === 410,
      detail: `${status ?? ""} ${(e as Error).message}`.trim().slice(0, 200),
    };
  }
}
