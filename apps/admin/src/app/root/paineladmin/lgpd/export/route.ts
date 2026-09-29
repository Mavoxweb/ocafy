import { ADMIN_BASE } from "@/lib/base";
import { currentStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";
import { NextResponse } from "next/server";

/**
 * Gera a cópia dos dados de um pedido de exportação e devolve o JSON para download.
 * Passa pelo mesmo `guarded` das demais ações (permissão + justificativa + auditoria).
 */
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const me = await currentStaff();
  if (!me)
    return NextResponse.redirect(new URL(`${ADMIN_BASE}/login`, req.url), 303);
  const form = await req.formData();
  try {
    const data = await admin.completeExportRequest(me, {
      requestId: String(form.get("requestId") ?? ""),
      reason: String(form.get("reason") ?? ""),
    });
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="ocafy-exportacao-${String(form.get("requestId")).slice(0, 8)}.json"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    const msg =
      e instanceof admin.AdminError
        ? e.message
        : "Não foi possível gerar a cópia.";
    return NextResponse.redirect(
      new URL(`${ADMIN_BASE}/lgpd?err=${encodeURIComponent(msg)}`, req.url),
      303,
    );
  }
}
