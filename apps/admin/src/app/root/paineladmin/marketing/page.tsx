import { campaignActive, createCampaign, deleteCampaign } from "@/app/actions";
import {
  Flash,
  Reason,
  type SearchParams,
  Shell,
  fmtDate,
} from "@/components/shell";
import { ADMIN_BASE } from "@/lib/base";
import { requireStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";
import Link from "next/link";

export const dynamic = "force-dynamic";

const KIND_LABEL = {
  banner: "Cartão no topo",
  modal: "Popup central",
} as const;
const AUDIENCE_LABEL = {
  all: "Todo mundo",
  free: "Só Grátis",
  plus: "Só Plus",
} as const;

/** Horário de Brasília (UTC-3) formatado para um <input type="datetime-local">. */
const toLocalInput = (d: Date): string =>
  new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);

export default async function Marketing({
  searchParams,
}: { searchParams: SearchParams }) {
  const me = await requireStaff("read");
  const sp = await searchParams;
  const rows = await admin.listCampaignsWithStats();
  const canWrite = admin.can(me.role, "marketing.write");
  const now = new Date();

  return (
    <Shell me={me}>
      <h1>Marketing interno</h1>
      <p className="muted">
        Avisos e promoções mostrados dentro do app — um cartão dispensável no
        topo de Hoje ou um popup central. Uma casa nunca vê mais de uma por vez:
        a de maior prioridade entre as elegíveis para o plano dela.
      </p>
      <Flash ok={sp.ok} err={sp.err} />

      <table style={{ marginTop: 14 }}>
        <thead>
          <tr>
            <th>Campanha</th>
            <th>Tipo</th>
            <th>Público</th>
            <th>Janela</th>
            <th>Estatísticas</th>
            <th>Situação</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map(({ campaign: c, stats }) => {
            const live =
              c.active && c.startsAt <= now && (!c.endsAt || c.endsAt > now);
            return (
              <tr key={c.id}>
                <td>
                  <Link href={`${ADMIN_BASE}/marketing/${c.id}`}>
                    {c.title}
                  </Link>
                  <div className="muted">prioridade {c.priority}</div>
                </td>
                <td>{KIND_LABEL[c.kind]}</td>
                <td>{AUDIENCE_LABEL[c.audience]}</td>
                <td>
                  {fmtDate(c.startsAt)}
                  <div className="muted">
                    até {c.endsAt ? fmtDate(c.endsAt) : "sem prazo"}
                  </div>
                </td>
                <td>
                  {stats.shown} vistas · {stats.clicked} cliques ·{" "}
                  {stats.dismissed} dispensas
                </td>
                <td>
                  <span
                    className={`pill ${live ? "ok" : c.active ? "warn" : ""}`}
                  >
                    {c.active
                      ? live
                        ? "no ar"
                        : "fora da janela"
                      : "desligada"}
                  </span>
                </td>
                <td>
                  {canWrite && (
                    <form action={campaignActive} className="inline">
                      <input type="hidden" name="id" value={c.id} />
                      <input
                        type="hidden"
                        name="active"
                        value={c.active ? "0" : "1"}
                      />
                      <Reason />
                      <button
                        type="submit"
                        className={c.active ? "danger" : "primary"}
                      >
                        {c.active ? "Desligar" : "Ligar"}
                      </button>
                    </form>
                  )}
                  {canWrite &&
                    stats.shown + stats.clicked + stats.dismissed === 0 && (
                      <form
                        action={deleteCampaign}
                        className="inline"
                        style={{ marginTop: 8 }}
                      >
                        <input type="hidden" name="id" value={c.id} />
                        <Reason placeholder="Por que excluir" />
                        <button type="submit" className="danger">
                          Excluir
                        </button>
                      </form>
                    )}
                </td>
              </tr>
            );
          })}
          {!rows.length && (
            <tr>
              <td colSpan={7} className="muted">
                Nenhuma campanha ainda.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {canWrite && (
        <>
          <h2>Nova campanha</h2>
          <div className="box">
            <form action={createCampaign} className="grid2">
              <label>
                Título
                <input
                  name="title"
                  required
                  maxLength={60}
                  placeholder="Ex.: Assine o Plus"
                />
              </label>
              <label>
                Tipo
                <select name="kind" defaultValue="banner">
                  <option value="banner">Cartão no topo (dispensável)</option>
                  <option value="modal">Popup central</option>
                </select>
              </label>
              <label style={{ gridColumn: "1 / -1" }}>
                Texto
                <textarea
                  name="body"
                  required
                  maxLength={280}
                  placeholder="Até 280 caracteres"
                />
              </label>
              <label>
                Texto do botão (opcional)
                <input
                  name="ctaLabel"
                  maxLength={30}
                  placeholder="Ex.: Ver planos"
                />
              </label>
              <label>
                Link do botão (opcional)
                <input name="ctaUrl" placeholder="/plano ou https://…" />
              </label>
              <label>
                Público
                <select name="audience" defaultValue="all">
                  <option value="all">Todo mundo</option>
                  <option value="free">Só plano Grátis</option>
                  <option value="plus">Só plano Plus</option>
                </select>
              </label>
              <label>
                Prioridade (maior vence empate)
                <input
                  name="priority"
                  type="number"
                  defaultValue={0}
                  min={-100}
                  max={100}
                />
              </label>
              <label>
                Começa em
                <input
                  name="startsAt"
                  type="datetime-local"
                  required
                  defaultValue={toLocalInput(now)}
                />
              </label>
              <label>
                Termina em (opcional)
                <input name="endsAt" type="datetime-local" />
              </label>
              <label
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  name="dismissible"
                  value="1"
                  defaultChecked
                />
                A pessoa pode dispensar (recomendado)
              </label>
              <div style={{ gridColumn: "1 / -1" }}>
                <Reason placeholder="Por que esta campanha" />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <button type="submit" className="primary">
                  Criar (nasce desligada)
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </Shell>
  );
}
