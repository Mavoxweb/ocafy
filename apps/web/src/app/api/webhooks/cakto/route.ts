import { timingSafeEqual } from "node:crypto";
import { processBillingEvent } from "@ocafy/api";
import { parseCaktoEvent } from "@ocafy/core";
import { NextResponse } from "next/server";

/**
 * Webhook da Cakto. Configure na Cakto: URL https://SEU-APP/api/webhooks/cakto e o segredo
 * (variável CAKTO_WEBHOOK_SECRET). O segredo pode vir no cabeçalho `x-cakto-secret`, em
 * `Authorization: Bearer …` ou no campo `secret` do corpo — o que a Cakto enviar.
 *
 * Resposta: 200 quando processado/repetido/ignorado (a Cakto para de reenviar); 401 segredo
 * inválido; 400 corpo ilegível; 500 se falhou aqui (a Cakto tenta de novo — é idempotente).
 */
export const dynamic = "force-dynamic";

function same(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export async function POST(req: Request) {
  const secret = process.env.CAKTO_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const given =
    req.headers.get("x-cakto-secret") ??
    (req.headers.get("authorization") ?? "").replace(/^Bearer /i, "") ??
    "";
  const inBody =
    body &&
    typeof body === "object" &&
    typeof (body as { secret?: unknown }).secret === "string"
      ? (body as { secret: string }).secret
      : "";
  if (!same(given, secret) && !same(inBody, secret)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ev = parseCaktoEvent(body);
  if (!ev)
    return NextResponse.json({ error: "unrecognized_event" }, { status: 400 });
  try {
    const result = await processBillingEvent(ev, body);
    return NextResponse.json({ ok: true, result });
  } catch {
    return NextResponse.json({ error: "processing_failed" }, { status: 500 });
  }
}
