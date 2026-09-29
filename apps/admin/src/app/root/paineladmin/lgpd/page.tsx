import { executeDeletion, requestStatus } from "@/app/actions";
import {
  Flash,
  Reason,
  type SearchParams,
  Shell,
  fmtDate,
} from "@/components/shell";
import { ADMIN_BASE } from "@/lib/base";
import { requireStaff } from "@/lib/staff";
import { REQUEST_SLA_DAYS, admin } from "@ocafy/api";

export const dynamic = "force-dynamic";

const KIND = {
  export: "Exportar dados",
  delete: "Excluir conta e dados",
} as const;

export default async function Lgpd({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await requireStaff("read");
  const sp = await searchParams;
  const rows = await admin.listDataRequests();
  const now = Date.now();
  const can = (p: admin.Permission) => admin.can(me.role, p);

  return (
    <Shell me={me}>
      <h1>Pedidos LGPD</h1>
      <p className="muted">
        Prazo de resposta: {REQUEST_SLA_DAYS} dias corridos. Exportações também
        podem ser feitas pela própria pessoa no app (aparecem aqui como
        concluídas).
      </p>
      <Flash ok={sp.ok} err={sp.err} />
      <table style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Pedido</th>
            <th>Casa</th>
            <th>Situação</th>
            <th>Prazo</th>
            <th>Ação</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ req, house }) => {
            const openReq =
              req.status === "open" || req.status === "in_progress";
            const late = openReq && req.dueAt.getTime() < now;
            return (
              <tr key={req.id}>
                <td>
                  {KIND[req.kind]}
                  <div className="muted">
                    {req.userId} · {fmtDate(req.requestedAt)}
                  </div>
                  {req.note && <div className="muted">“{req.note}”</div>}
                </td>
                <td>{house ?? "—"}</td>
                <td>
                  <span
                    className={`pill ${req.status === "done" ? "ok" : late ? "bad" : "warn"}`}
                  >
                    {req.status}
                  </span>
                  {req.evidence && (
                    <div className="muted">{req.evidence.slice(0, 120)}</div>
                  )}
                </td>
                <td>
                  {late ? <span className="pill bad">vencido</span> : null}{" "}
                  {fmtDate(req.dueAt)}
                </td>
                <td>
                  {openReq && (
                    <div style={{ display: "grid", gap: 8 }}>
                      {req.kind === "export" && can("lgpd.handle") && (
                        <form
                          action={`${ADMIN_BASE}/lgpd/export`}
                          method="post"
                          className="inline"
                        >
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <Reason />
                          <button type="submit" className="primary">
                            Gerar e baixar cópia
                          </button>
                        </form>
                      )}
                      {req.kind === "delete" && can("lgpd.delete") && (
                        <form action={executeDeletion} className="inline">
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <Reason placeholder="Como o titular foi confirmado" />
                          <button type="submit" className="danger">
                            Executar exclusão
                          </button>
                        </form>
                      )}
                      {can("lgpd.handle") && (
                        <form action={requestStatus} className="inline">
                          <input
                            type="hidden"
                            name="requestId"
                            value={req.id}
                          />
                          <Reason />
                          <select name="status" defaultValue="in_progress">
                            <option value="in_progress">Em andamento</option>
                            <option value="rejected">Rejeitar</option>
                          </select>
                          <button type="submit">Atualizar</button>
                        </form>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={5} className="muted">
                Nenhum pedido.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Shell>
  );
}
