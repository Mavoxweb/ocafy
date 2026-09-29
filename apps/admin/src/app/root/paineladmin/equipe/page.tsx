import { staffActive, staffRole } from "@/app/actions";
import {
  Flash,
  Reason,
  type SearchParams,
  Shell,
  fmtDate,
} from "@/components/shell";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";
import { AddStaff } from "./add-staff";

export const dynamic = "force-dynamic";

export default async function Equipe({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await requireStaff("staff.manage");
  const sp = await searchParams;
  const team = await admin.listStaff();
  const roles = Object.keys(admin.ROLE_LABELS) as admin.StaffRole[];

  return (
    <Shell me={me}>
      <h1>Equipe</h1>
      <p className="muted">
        Só o proprietário gerencia a equipe. Todo acesso exige o segundo fator
        (TOTP).
      </p>
      <Flash ok={sp.ok} err={sp.err} />
      <table style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Pessoa</th>
            <th>Papel</th>
            <th>Último login</th>
            <th>Situação</th>
            <th>Ações</th>
          </tr>
        </thead>
        <tbody>
          {team.map((s) => (
            <tr key={s.id}>
              <td>{s.email}</td>
              <td>{admin.ROLE_LABELS[s.role]}</td>
              <td>{fmtDate(s.lastLoginAt)}</td>
              <td>
                <span className={`pill ${s.active ? "ok" : "bad"}`}>
                  {s.active ? "ativo" : "inativo"}
                </span>
              </td>
              <td>
                {s.userId !== me.userId && (
                  <div style={{ display: "grid", gap: 8 }}>
                    <form action={staffRole} className="inline">
                      <input type="hidden" name="staffId" value={s.id} />
                      <select name="role" defaultValue={s.role}>
                        {roles.map((r) => (
                          <option key={r} value={r}>
                            {admin.ROLE_LABELS[r]}
                          </option>
                        ))}
                      </select>
                      <Reason />
                      <button type="submit">Mudar papel</button>
                    </form>
                    <form action={staffActive} className="inline">
                      <input type="hidden" name="staffId" value={s.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={s.active ? "0" : "1"}
                      />
                      <Reason />
                      <button
                        type="submit"
                        className={s.active ? "danger" : ""}
                      >
                        {s.active ? "Desativar" : "Reativar"}
                      </button>
                    </form>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>Adicionar pessoa</h2>
      <AddStaff
        roles={roles.map((r) => ({ value: r, label: admin.ROLE_LABELS[r] }))}
      />
    </Shell>
  );
}
