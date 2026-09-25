import { timingSafeEqual } from "node:crypto";
import { processBillingEvent } from "@ocafy/api";
import { parseRevenueCatEvent } from "@ocafy/core";
import { NextResponse } from "next/server";

/**
 * Webhook do RevenueCat (assinaturas do Google Play). No painel do RevenueCat, aponte para
 * https://SEU-APP/api/webhooks/revenuecat e defina o valor do cabeçalho Authorization igual a
 * REVENUECAT_WEBHOOK_AUTH. O `app_user_id` dos compradores deve ser o id da casa.
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const expected = process.env.REVENUECAT_WEBHOOK_AUTH;
  if (!expected) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  const given = req.headers.get("authorization") ?? "";
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const ev = parseRevenueCatEvent(body);
  if (!ev)
    return NextResponse.json({ error: "unrecognized_event" }, { status: 400 });
  try {
    const result = await processBillingEvent(ev, body);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
