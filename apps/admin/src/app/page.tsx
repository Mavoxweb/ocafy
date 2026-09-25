import { Flash, type SearchParams, Shell, brl } from "@/components/shell";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";

export const dynamic = "force-dynamic";

export default async function Dashboard({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await requireStaff("read");
  const sp = await searchParams;
  const d = await admin.dashboard();
  const card = (k: string, v: string | number, hint?: string) => (
    <div className="card" key={k}>
      <div className="v">{v}</div>
      <div className="k">{k}</div>
      {hint && <div className="k">{hint}</div>}
    </div>
  );

  return (
    <Shell me={me}>
      <h1>Visão geral</h1>
      <p className="muted">Números ao vivo do banco de produção.</p>
      <Flash
        ok={sp.ok}
        err={sp.negado ? "Seu papel não permite esta área." : sp.err}
      />

      <h2>Crescimento</h2>
      <div className="cards">
        {card("Contas", d.users)}
        {card(
          "Casas",
          d.households,
          `+${d.householdsNew7d} em 7 dias · +${d.householdsNew30d} em 30`,
        )}
        {card("Casas ativas (7 dias)", d.householdsActive7d)}
        {card("Adultos ativos (7 dias)", d.adultsActive7d)}
      </div>

      <h2>Lembretes</h2>
      <div className="cards">
        {card(
          "Opt-in dos ativos",
          d.notifOptInPct == null ? "—" : `${d.notifOptInPct}%`,
          `${d.notifOptIn} de ${d.adultsActive7d} · meta: acima de 50%`,
        )}
        {card(
          "Avisos enviados (7 dias)",
          d.notifications7d.sent,
          `${d.notifications7d.failed} com falha`,
        )}
      </div>

      <h2>Receita e planos</h2>
      <div className="cards">
        {card(
          "Receita mensal estimada",
          brl(d.mrrCents),
          `${d.activeSubscriptions} assinaturas pagando`,
        )}
        {card(
          "Casas no Plus",
          d.plans.plus,
          Object.entries(d.plans.bySource)
            .map(([k, v]) => `${k}: ${v}`)
            .join(" · "),
        )}
        {card("Casas no Grátis", d.plans.free)}
        {card("Pagamentos em atraso", d.pastDue)}
      </div>

      <h2>Pendências</h2>
      <div className="cards">
        {card(
          "Pedidos LGPD abertos",
          d.requests.open,
          `${d.requests.overdue} fora do prazo`,
        )}
        {card(
          "Erros de cobrança (7 dias)",
          d.billing.errors7d,
          `${d.billing.unmatched7d} sem casa reconhecida`,
        )}
      </div>

      <h2>Funil do onboarding (pessoas por passo)</h2>
      <table>
        <thead>
          <tr>
            <th>Passo</th>
            <th>Pessoas</th>
          </tr>
        </thead>
        <tbody>
          {d.funnel.map((f) => (
            <tr key={f.step}>
              <td>{f.step}</td>
              <td>{f.users}</td>
            </tr>
          ))}
          {!d.funnel.length && (
            <tr>
              <td colSpan={2} className="muted">
                Sem dados ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </Shell>
  );
}
