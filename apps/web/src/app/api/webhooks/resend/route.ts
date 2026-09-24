import { createHmac, timingSafeEqual } from "node:crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Webhook do Resend (entregas, devoluções, reclamações de spam). Assinado com Svix:
 * configure em Resend → Webhooks apontando para /api/webhooks/resend e copie o
 * "Signing secret" (whsec_…) para RESEND_WEBHOOK_SECRET.
 *
 * Hoje só valida e registra o evento. Próximo passo: gravar e-mails devolvidos/marcados
 * como spam numa lista de supressão para nunca mais enviar para eles.
 */
export async function POST(req: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return new Response("webhook não configurado", { status: 501 });

  const id = req.headers.get("svix-id");
  const timestamp = req.headers.get("svix-timestamp");
  const signature = req.headers.get("svix-signature");
  if (!id || !timestamp || !signature)
    return new Response("cabeçalhos ausentes", { status: 400 });

  // Rejeita eventos muito antigos (5 min) contra reenvio de mensagens capturadas.
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) {
    return new Response("timestamp fora da janela", { status: 400 });
  }

  const body = await req.text();
  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${body}`)
    .digest("base64");
  const ok = signature.split(" ").some((part) => {
    const [, sig] = part.split(",");
    if (!sig) return false;
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    return a.length === b.length && timingSafeEqual(a, b);
  });
  if (!ok) return new Response("assinatura inválida", { status: 401 });

  const event = JSON.parse(body) as {
    type?: string;
    data?: { to?: string[]; email_id?: string };
  };
  console.info("[resend]", event.type, event.data?.email_id);
  return new Response(null, { status: 204 });
}
