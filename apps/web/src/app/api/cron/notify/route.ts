import { timingSafeEqual } from "node:crypto";
import { runBillingTick, runNotificationTick } from "@ocafy/api";
import { NextResponse } from "next/server";

// Roda a cada poucos minutos (GitHub Actions → esta rota). Sem cache; pode levar alguns segundos.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = (req.headers.get("authorization") ?? "").replace(
    /^Bearer /i,
    "",
  );
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const summary = await runNotificationTick();
  // A mesma rotina de 5 em 5 minutos encerra carências vencidas e envia avisos de cobrança.
  const billing = await runBillingTick().catch(() => null);
  return NextResponse.json({ ok: true, ...summary, billing });
}

export const GET = handle;
export const POST = handle;
