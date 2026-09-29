import { type SearchParams, Shell, fmtDate } from "@/components/shell";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";

export const dynamic = "force-dynamic";

/** Registro imutável de tudo o que a equipe fez (e das tentativas negadas). */
export default async function Auditoria({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await requireStaff("read");
  const sp = await searchParams;
  const actor = typeof sp.ator === "string" && sp.ator ? sp.ator : undefined;
  const rows = await admin.listAudit(300, actor);

  return (
    <Shell me={me}>
      <h1>Auditoria</h1>
      <p className="muted">
        Somente leitura: o banco impede alterar ou apagar estes registros.
      </p>
      <form className="inline" style={{ margin: "12px 0" }}>
        <label>
          Filtrar por e-mail de quem agiu
          <input name="ator" defaultValue={actor ?? ""} />
        </label>
        <button type="submit">Filtrar</button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Quando</th>
            <th>Quem</th>
            <th>Ação</th>
            <th>Alvo</th>
            <th>Justificativa</th>
            <th>Antes → depois</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <tr key={a.id}>
              <td>{fmtDate(a.createdAt)}</td>
              <td>
                {a.actorEmail}
                <div className="muted">
                  {a.actorRole} {a.ip ? `· ${a.ip}` : ""}
                </div>
              </td>
              <td>
                <span
                  className={`pill ${a.action.endsWith(".denied") || a.action.endsWith(".failed") ? "bad" : ""}`}
                >
                  {a.action}
                </span>
              </td>
              <td>
                {a.targetType}
                <div className="muted">{a.targetId}</div>
              </td>
              <td>{a.reason}</td>
              <td>
                <code style={{ fontSize: "0.72rem" }}>
                  {a.before ? JSON.stringify(a.before) : ""} →{" "}
                  {a.after ? JSON.stringify(a.after) : ""}
                </code>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Shell>
  );
}
