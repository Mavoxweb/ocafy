import {
  addNote,
  ban,
  expire,
  grant,
  manualSubscription,
  revoke,
  suspend,
  unsuspend,
} from "@/app/actions";
import {
  Flash,
  Reason,
  type SearchParams,
  Shell,
  fmtDate,
} from "@/components/shell";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function CasaDetalhe({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const me = await requireStaff("read");
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const d = await admin.householdDetail(id);
  if (!d) notFound();
  const can = (p: admin.Permission) => admin.can(me.role, p);
  const suspended = !!d.house.suspendedAt;

  return (
    <Shell me={me}>
      <h1>
        {d.house.name} {suspended && <span className="pill bad">suspensa</span>}
      </h1>
      <p className="muted">
        {d.house.id} · criada em {fmtDate(d.house.createdAt)} · modo{" "}
        {d.house.mode} · {d.usage.completions} registros · última atividade{" "}
        {fmtDate(d.usage.lastActivity)}
      </p>
      <Flash ok={sp.ok} err={sp.err} />

      <h2>Pessoas</h2>
      <table>
        <thead>
          <tr>
            <th>Nome</th>
            <th>Tipo</th>
            <th>E-mail</th>
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {d.members.map((m) => (
            <tr key={m.id}>
              <td>
                {m.display_name} <span className="muted">({m.slot})</span>
              </td>
              <td>
                {m.kind === "profile"
                  ? "perfil de criança"
                  : m.role === "owner"
                    ? "dono"
                    : "adulto"}
              </td>
              <td>{m.email ?? "—"}</td>
              <td>
                {m.banned ? <span className="pill bad">banido</span> : "ok"}
              </td>
              <td>
                {m.user_id && can("user.ban") && (
                  <form action={ban} className="inline">
                    <input type="hidden" name="householdId" value={id} />
                    <input type="hidden" name="userId" value={m.user_id} />
                    <input
                      type="hidden"
                      name="unban"
                      value={m.banned ? "1" : "0"}
                    />
                    <Reason />
                    <button type="submit" className={m.banned ? "" : "danger"}>
                      {m.banned ? "Reativar conta" : "Banir conta"}
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="grid2">
        <div className="box">
          <h2 style={{ marginTop: 0 }}>Plano</h2>
          <p>
            <span className={`pill ${d.plan.plan === "plus" ? "ok" : ""}`}>
              {d.plan.plan === "plus" ? "Plus" : "Grátis"}
            </span>{" "}
            {d.plan.source && (
              <span className="muted">origem: {d.plan.source}</span>
            )}
            {d.plan.pastDue && (
              <span className="pill warn"> pagamento em atraso</span>
            )}
          </p>
          <p className="muted">
            Limites: família {d.plan.entitlements.family ? "sim" : "não"} · pets
            até {d.plan.entitlements.maxPets} · projetos até{" "}
            {d.plan.entitlements.maxProjects}
          </p>
          <table>
            <thead>
              <tr>
                <th>Liberação</th>
                <th>Validade</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.grants.map((g) => (
                <tr key={g.id}>
                  <td>
                    {g.plan}/{g.source}
                    {g.overrides ? ` ${JSON.stringify(g.overrides)}` : ""}
                    <div className="muted">{g.reason}</div>
                  </td>
                  <td>
                    {g.revokedAt ? (
                      <span className="pill bad">revogada</span>
                    ) : g.expiresAt ? (
                      `até ${fmtDate(g.expiresAt)}`
                    ) : (
                      "sem prazo"
                    )}
                  </td>
                  <td>
                    {!g.revokedAt && can("plan.write") && (
                      <form action={revoke} className="inline">
                        <input type="hidden" name="householdId" value={id} />
                        <input type="hidden" name="grantId" value={g.id} />
                        <Reason />
                        <button type="submit" className="danger">
                          Revogar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {can("plan.write") && (
            <form action={grant} className="inline" style={{ marginTop: 12 }}>
              <input type="hidden" name="householdId" value={id} />
              <label>
                Plano
                <select name="plan" defaultValue="plus">
                  <option value="plus">Plus</option>
                  <option value="free">Grátis + ajustes</option>
                </select>
              </label>
              <label>
                Dias (vazio = sem prazo)
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={3650}
                  style={{ width: 110 }}
                />
              </label>
              <label>
                Pets (ajuste)
                <input
                  name="maxPets"
                  type="number"
                  min={1}
                  max={99}
                  style={{ width: 80 }}
                />
              </label>
              <label>
                <span>
                  <input type="checkbox" name="family" /> Família
                </span>
              </label>
              <Reason />
              <button type="submit" className="primary">
                Liberar
              </button>
            </form>
          )}
        </div>

        <div className="box">
          <h2 style={{ marginTop: 0 }}>Assinaturas</h2>
          <table>
            <thead>
              <tr>
                <th>Provedor</th>
                <th>Situação</th>
                <th>Período até</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {d.subscriptions.map((s) => (
                <tr key={s.id}>
                  <td>
                    {s.provider} · {s.interval}
                    <div className="muted">{s.payerEmail ?? ""}</div>
                  </td>
                  <td>
                    <span
                      className={`pill ${s.status === "active" ? "ok" : s.status === "past_due" ? "warn" : "bad"}`}
                    >
                      {s.status}
                    </span>
                  </td>
                  <td>{fmtDate(s.currentPeriodEnd)}</td>
                  <td>
                    {can("subscription.write") && s.status !== "expired" && (
                      <form action={expire} className="inline">
                        <input type="hidden" name="householdId" value={id} />
                        <input
                          type="hidden"
                          name="subscriptionId"
                          value={s.id}
                        />
                        <Reason />
                        <button type="submit" className="danger">
                          Encerrar
                        </button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
              {!d.subscriptions.length && (
                <tr>
                  <td colSpan={4} className="muted">
                    Sem assinatura.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          {can("subscription.write") && (
            <form
              action={manualSubscription}
              className="inline"
              style={{ marginTop: 12 }}
            >
              <input type="hidden" name="householdId" value={id} />
              <label>
                Ciclo
                <select name="interval" defaultValue="quarterly">
                  <option value="monthly">Mensal</option>
                  <option value="quarterly">Trimestral</option>
                  <option value="yearly">Anual</option>
                </select>
              </label>
              <label>
                Dias
                <input
                  name="days"
                  type="number"
                  min={1}
                  max={3650}
                  defaultValue={92}
                  style={{ width: 90 }}
                  required
                />
              </label>
              <Reason />
              <button type="submit" className="primary">
                Registrar assinatura manual
              </button>
            </form>
          )}
        </div>
      </div>

      {can("household.suspend") && (
        <div className="box">
          <h2 style={{ marginTop: 0 }}>Suspensão</h2>
          {suspended ? (
            <p className="muted">Suspensa: {d.house.suspendedReason}</p>
          ) : (
            <p className="muted">
              Bloqueia toda escrita da casa; os dados continuam guardados e
              visíveis para as pessoas.
            </p>
          )}
          <form action={suspended ? unsuspend : suspend} className="inline">
            <input type="hidden" name="householdId" value={id} />
            <Reason />
            <button type="submit" className={suspended ? "primary" : "danger"}>
              {suspended ? "Reativar casa" : "Suspender casa"}
            </button>
          </form>
        </div>
      )}

      <h2>Notas internas</h2>
      {can("notes") && (
        <form action={addNote} className="inline" style={{ marginBottom: 10 }}>
          <input type="hidden" name="householdId" value={id} />
          <label style={{ flex: "1 1 320px" }}>
            Nova nota
            <input name="note" required maxLength={1000} />
          </label>
          <button type="submit">Salvar nota</button>
        </form>
      )}
      <table>
        <tbody>
          {d.notes.map((n) => (
            <tr key={n.id}>
              <td style={{ width: 150 }}>{fmtDate(n.createdAt)}</td>
              <td>{n.author}</td>
              <td>{n.note}</td>
            </tr>
          ))}
          {!d.notes.length && (
            <tr>
              <td className="muted">Sem notas.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Eventos de cobrança</h2>
      <table>
        <tbody>
          {d.billingEvents.map((e) => (
            <tr key={e.id}>
              <td style={{ width: 150 }}>{fmtDate(e.receivedAt)}</td>
              <td>{e.provider}</td>
              <td>{e.type}</td>
              <td>
                <span
                  className={`pill ${e.status === "applied" ? "ok" : e.status === "error" ? "bad" : ""}`}
                >
                  {e.status}
                </span>
              </td>
            </tr>
          ))}
          {!d.billingEvents.length && (
            <tr>
              <td className="muted">Sem eventos.</td>
            </tr>
          )}
        </tbody>
      </table>

      <h2>Auditoria desta casa</h2>
      <table>
        <tbody>
          {d.audit.map((a) => (
            <tr key={a.id}>
              <td style={{ width: 150 }}>{fmtDate(a.createdAt)}</td>
              <td>{a.actorEmail}</td>
              <td>{a.action}</td>
              <td>{a.reason}</td>
            </tr>
          ))}
          {!d.audit.length && (
            <tr>
              <td className="muted">Nenhuma ação registrada.</td>
            </tr>
          )}
        </tbody>
      </table>
    </Shell>
  );
}
