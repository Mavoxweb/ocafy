import { toggleFlag } from "@/app/actions";
import {
  Flash,
  Reason,
  type SearchParams,
  Shell,
  fmtDate,
} from "@/components/shell";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";

export const dynamic = "force-dynamic";

export default async function Flags({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await requireStaff("read");
  const sp = await searchParams;
  const flags = await admin.listFlags();
  const canWrite = admin.can(me.role, "flags.write");

  return (
    <Shell me={me}>
      <h1>Chaves globais</h1>
      <p className="muted">
        Liga e desliga recursos de toda a plataforma sem novo deploy (vale em
        até 15 segundos).
      </p>
      <Flash ok={sp.ok} err={sp.err} />
      {flags.map((f) => (
        <div className="box" key={f.key}>
          <b>{f.key}</b>{" "}
          <span className={`pill ${f.enabled ? "ok" : "warn"}`}>
            {f.enabled ? "ligada" : "desligada"}
          </span>
          <div className="muted">
            {f.description} · alterada em {fmtDate(f.updatedAt)}{" "}
            {f.updatedBy ? `por ${f.updatedBy}` : ""}
          </div>
          {canWrite && (
            <form
              action={toggleFlag}
              className="inline"
              style={{ marginTop: 10 }}
            >
              <input type="hidden" name="key" value={f.key} />
              <input
                type="hidden"
                name="enabled"
                value={f.enabled ? "0" : "1"}
              />
              <Reason />
              <button
                type="submit"
                className={
                  f.enabled && f.key === "signups_open" ? "danger" : ""
                }
              >
                {f.enabled ? "Desligar" : "Ligar"}
              </button>
            </form>
          )}
        </div>
      ))}
    </Shell>
  );
}
