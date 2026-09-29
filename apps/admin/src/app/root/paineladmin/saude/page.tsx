import { Shell, fmtDate } from "@/components/shell";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";

export const dynamic = "force-dynamic";

/** Saúde: o que precisa de atenção (cobrança e avisos). */
export default async function Saude() {
  const me = await requireStaff("read");
  const [billing, fails] = await Promise.all([
    admin.listBillingEvents(50, true),
    admin.recentNotificationFailures(),
  ]);
  const pushOk =
    !!process.env.VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY;

  return (
    <Shell me={me}>
      <h1>Saúde</h1>
      <div className="cards" style={{ margin: "14px 0" }}>
        <div className="card">
          <div className="v">{pushOk ? "ok" : "off"}</div>
          <div className="k">Chaves de push neste painel</div>
        </div>
        <div className="card">
          <div className="v">
            {process.env.CAKTO_WEBHOOK_SECRET ? "ok" : "off"}
          </div>
          <div className="k">Webhook Cakto configurado</div>
        </div>
        <div className="card">
          <div className="v">
            {process.env.REVENUECAT_WEBHOOK_AUTH ? "ok" : "off"}
          </div>
          <div className="k">Webhook Play (RevenueCat)</div>
        </div>
      </div>

      <h2>Eventos de cobrança com problema</h2>
      <table>
        <thead>
          <tr>
            <th>Recebido</th>
            <th>Provedor</th>
            <th>Evento</th>
            <th>Erro</th>
          </tr>
        </thead>
        <tbody>
          {billing.map((e) => (
            <tr key={e.id}>
              <td>{fmtDate(e.receivedAt)}</td>
              <td>{e.provider}</td>
              <td>{e.type}</td>
              <td>{e.error}</td>
            </tr>
          ))}
          {!billing.length && (
            <tr>
              <td colSpan={4} className="muted">
                Nenhum problema.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Avisos push com falha (7 dias)</h2>
      <table>
        <thead>
          <tr>
            <th>Quando</th>
            <th>Tipo</th>
            <th>Detalhe</th>
          </tr>
        </thead>
        <tbody>
          {fails.map((f) => (
            <tr key={f.id}>
              <td>{fmtDate(f.createdAt)}</td>
              <td>{f.kind}</td>
              <td>{f.detail}</td>
            </tr>
          ))}
          {!fails.length && (
            <tr>
              <td colSpan={3} className="muted">
                Nenhuma falha.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Shell>
  );
}
