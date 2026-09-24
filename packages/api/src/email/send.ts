/**
 * Envio de e-mails transacionais pelo Resend (HTTP, sem SDK).
 *
 * Variáveis de ambiente (todas opcionais até você criar a conta no Resend):
 *   RESEND_API_KEY  chave da API (re_…)
 *   EMAIL_FROM      remetente, ex.: "Ocafy <ola@ocafy.com.br>" (domínio verificado no Resend)
 *   EMAIL_REPLY_TO  opcional
 *
 * Sem RESEND_API_KEY nada é enviado e o retorno é `{ sent: false, reason: "not_configured" }`
 * — o app segue funcionando (útil em dev, preview e antes de configurar o Resend).
 */

export interface EmailMessage {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  /** Marca o e-mail no painel do Resend (ex.: "invite", "welcome"). */
  tag?: string;
}

export type EmailResult =
  | { sent: true; id: string }
  | {
      sent: false;
      reason: "not_configured" | "provider_error";
      detail?: string;
    };

const ENDPOINT = "https://api.resend.com/emails";

export function emailConfigured(): boolean {
  return !!process.env.RESEND_API_KEY;
}

export async function sendEmail(msg: EmailMessage): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { sent: false, reason: "not_configured" };

  const from = process.env.EMAIL_FROM ?? "Ocafy <onboarding@resend.dev>";
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: Array.isArray(msg.to) ? msg.to : [msg.to],
        subject: msg.subject,
        html: msg.html,
        ...(msg.text ? { text: msg.text } : {}),
        ...(process.env.EMAIL_REPLY_TO
          ? { reply_to: process.env.EMAIL_REPLY_TO }
          : {}),
        ...(msg.tag ? { tags: [{ name: "type", value: msg.tag }] } : {}),
      }),
    });
    if (!res.ok) {
      return {
        sent: false,
        reason: "provider_error",
        detail: `${res.status} ${(await res.text()).slice(0, 200)}`,
      };
    }
    const data = (await res.json()) as { id?: string };
    return { sent: true, id: data.id ?? "" };
  } catch (e) {
    return {
      sent: false,
      reason: "provider_error",
      detail: e instanceof Error ? e.message : "erro de rede",
    };
  }
}
