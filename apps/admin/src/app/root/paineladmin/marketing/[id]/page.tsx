import { campaignActive, deleteCampaign, updateCampaign } from "@/app/actions";
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

const toLocalInput = (d: Date): string =>
  new Date(d.getTime() - 3 * 3_600_000).toISOString().slice(0, 16);

export default async function EditCampaign({
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
  const c = await admin.getCampaign(id);
  if (!c) notFound();
  const canWrite = admin.can(me.role, "marketing.write");
  const list = await admin.listCampaignsWithStats();
  const stats = list.find((x) => x.campaign.id === id)?.stats ?? {
    shown: 0,
    clicked: 0,
    dismissed: 0,
  };
  const used = stats.shown + stats.clicked + stats.dismissed > 0;

  return (
    <Shell me={me}>
      <h1>{c.title}</h1>
      <p className="muted">
        Criada em {fmtDate(c.createdAt)} por {c.createdBy} · atualizada em{" "}
        {fmtDate(c.updatedAt)}
      </p>
      <Flash ok={sp.ok} err={sp.err} />

      <div className="cards" style={{ margin: "14px 0" }}>
        <div className="card">
          <div className="v">{stats.shown}</div>
          <div className="k">pessoas viram</div>
        </div>
        <div className="card">
          <div className="v">{stats.clicked}</div>
          <div className="k">clicaram no botão</div>
        </div>
        <div className="card">
          <div className="v">{stats.dismissed}</div>
          <div className="k">dispensaram</div>
        </div>
      </div>

      {canWrite && (
        <div className="box">
          <form action={campaignActive} className="inline">
            <input type="hidden" name="id" value={c.id} />
            <input type="hidden" name="active" value={c.active ? "0" : "1"} />
            <Reason />
            <button type="submit" className={c.active ? "danger" : "primary"}>
              {c.active ? "Desligar campanha" : "Ligar campanha"}
            </button>
          </form>
        </div>
      )}

      {canWrite ? (
        <div className="box">
          <form action={updateCampaign} className="grid2">
            <input type="hidden" name="id" value={c.id} />
            <label>
              Título
              <input
                name="title"
                required
                maxLength={60}
                defaultValue={c.title}
              />
            </label>
            <label>
              Tipo
              <select name="kind" defaultValue={c.kind}>
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
                defaultValue={c.body}
              />
            </label>
            <label>
              Texto do botão (opcional)
              <input
                name="ctaLabel"
                maxLength={30}
                defaultValue={c.ctaLabel ?? ""}
              />
            </label>
            <label>
              Link do botão (opcional)
              <input name="ctaUrl" defaultValue={c.ctaUrl ?? ""} />
            </label>
            <label>
              Público
              <select name="audience" defaultValue={c.audience}>
                <option value="all">Todo mundo</option>
                <option value="free">Só plano Grátis</option>
                <option value="plus">Só plano Plus</option>
              </select>
            </label>
            <label>
              Prioridade
              <input
                name="priority"
                type="number"
                defaultValue={c.priority}
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
                defaultValue={toLocalInput(c.startsAt)}
              />
            </label>
            <label>
              Termina em (opcional)
              <input
                name="endsAt"
                type="datetime-local"
                defaultValue={c.endsAt ? toLocalInput(c.endsAt) : ""}
              />
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
                defaultChecked={c.dismissible}
              />
              A pessoa pode dispensar
            </label>
            <div style={{ gridColumn: "1 / -1" }}>
              <Reason placeholder="O que mudou e por quê" />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <button type="submit" className="primary">
                Salvar alterações
              </button>
            </div>
          </form>
        </div>
      ) : (
        <div className="box">
          <p>
            <b>Texto:</b> {c.body}
          </p>
          {c.ctaLabel && (
            <p className="muted">
              Botão: {c.ctaLabel} → {c.ctaUrl}
            </p>
          )}
        </div>
      )}

      {canWrite && (
        <div className="box">
          <h2 style={{ marginTop: 0 }}>Excluir</h2>
          {used ? (
            <p className="muted">
              Esta campanha já foi mostrada a alguém — mantenha desativada em
              vez de excluir, para preservar as estatísticas.
            </p>
          ) : (
            <form action={deleteCampaign} className="inline">
              <input type="hidden" name="id" value={c.id} />
              <Reason placeholder="Por que excluir" />
              <button type="submit" className="danger">
                Excluir campanha
              </button>
            </form>
          )}
        </div>
      )}
    </Shell>
  );
}
