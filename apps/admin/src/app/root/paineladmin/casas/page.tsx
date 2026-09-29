import { type SearchParams, Shell, fmtDate } from "@/components/shell";
import { ADMIN_BASE } from "@/lib/base";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Casas({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await requireStaff("read");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const rows = await admin.searchHouseholds(q);

  return (
    <Shell me={me}>
      <h1>Casas</h1>
      <form className="inline" style={{ margin: "12px 0 16px" }}>
        <label style={{ flex: "1 1 320px" }}>
          Nome da casa, id ou e-mail
          <input
            name="q"
            defaultValue={q}
            placeholder="Ex.: Nosso cantinho, ana@email.com"
          />
        </label>
        <button type="submit" className="primary">
          Buscar
        </button>
      </form>
      <table>
        <thead>
          <tr>
            <th>Casa</th>
            <th>Responsável</th>
            <th>Modo</th>
            <th>Pessoas</th>
            <th>Plano</th>
            <th>Criada</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((h) => (
            <tr key={h.id}>
              <td>
                <Link href={`${ADMIN_BASE}/casas/${h.id}`}>{h.name}</Link>{" "}
                {h.suspended && <span className="pill bad">suspensa</span>}
              </td>
              <td>{h.owner ?? "—"}</td>
              <td>{h.mode}</td>
              <td>{h.members}</td>
              <td>
                <span
                  className={`pill ${h.plan.startsWith("Plus") ? "ok" : ""}`}
                >
                  {h.plan}
                </span>
              </td>
              <td>{fmtDate(h.createdAt)}</td>
            </tr>
          ))}
          {!rows.length && (
            <tr>
              <td colSpan={6} className="muted">
                Nenhuma casa encontrada.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Shell>
  );
}
