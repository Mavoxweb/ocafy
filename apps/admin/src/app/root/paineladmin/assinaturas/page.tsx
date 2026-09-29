import { Shell, fmtDate } from "@/components/shell";
import { ADMIN_BASE } from "@/lib/base";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Assinaturas() {
  const me = await requireStaff("read");
  const rows = await admin.listSubscriptions();
  const events = await admin.listBillingEvents(50);
  const tone = (s: string) =>
    s === "active" || s === "trialing"
      ? "ok"
      : s === "past_due"
        ? "warn"
        : "bad";

  return (
    <Shell me={me}>
      <h1>Assinaturas</h1>
      <table style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Casa</th>
            <th>Provedor</th>
            <th>Situação</th>
            <th>Período até</th>
            <th>Carência até</th>
            <th>Pagador</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ sub, house }) => (
            <tr key={sub.id}>
              <td>
                <Link href={`${ADMIN_BASE}/casas/${sub.householdId}`}>
                  {house ?? sub.householdId}
                </Link>
              </td>
              <td>
                {sub.provider} · {sub.interval}
              </td>
              <td>
                <span className={`pill ${tone(sub.status)}`}>{sub.status}</span>
                {sub.cancelAtPeriodEnd && (
                  <span className="muted"> cancelará</span>
                )}
              </td>
              <td>{fmtDate(sub.currentPeriodEnd)}</td>
              <td>{fmtDate(sub.graceUntil)}</td>
              <td>{sub.payerEmail ?? "—"}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="muted">
                Nenhuma assinatura ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Últimos eventos dos provedores</h2>
      <table>
        <thead>
          <tr>
            <th>Recebido</th>
            <th>Provedor</th>
            <th>Evento</th>
            <th>Resultado</th>
            <th>Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id}>
              <td>{fmtDate(e.receivedAt)}</td>
              <td>{e.provider}</td>
              <td>{e.type}</td>
              <td>
                <span
                  className={`pill ${e.status === "applied" ? "ok" : e.status === "error" ? "bad" : ""}`}
                >
                  {e.status}
                </span>
              </td>
              <td>{e.error ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
