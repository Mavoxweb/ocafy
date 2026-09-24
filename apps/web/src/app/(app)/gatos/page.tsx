"use client";

import { NumberInput, Panel } from "@/components/ui/primitives";
import { adjustStock, completeTask, setLitter } from "@/lib/actions";
import { addDays, fmtShort } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  derive,
  doneToday,
  litterBagsPerChange,
  memberName,
  taskOf,
  taskStatus,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { daysBetween } from "@ocafy/core";
import Link from "next/link";

function NoCats() {
  return (
    <Panel className="mt-4">
      <b>Nenhum gato na casa</b>
      <p className="meta">
        Adicione gatos em “Minha casa” para acompanhar a caixa de areia e o
        estoque.
      </p>
      <Link href="/casa" className="btn">
        Abrir Minha casa
      </Link>
    </Panel>
  );
}

export default function CatsPage() {
  const s = useAppState();
  const now = useNow();
  const L = s.litter;
  const task = taskOf(s, "area_troca");
  if (!task) return <NoCats />;
  const st = taskStatus(s, task, now);
  const bpc = litterBagsPerChange(s);

  // Intervalo médio real entre as trocas já registradas.
  const changes = derive(s)
    .entries.filter((e) => e.taskId === "area_troca")
    .map((e) => new Date(e.at))
    .sort((a, b) => a.getTime() - b.getTime());
  let avg: number | null = null;
  if (changes.length >= 2) {
    let sum = 0;
    for (let i = 1; i < changes.length; i++)
      sum += daysBetween(changes[i - 1], changes[i]);
    avg = sum / (changes.length - 1);
  }
  const interval = avg ?? (L.minDays + L.maxDays) / 2;
  const kgMonth = (L.boxes * L.kgPerBox * 30) / interval;
  const bagsMonth = kgMonth / (L.bagKg || 4);
  const stock = s.litterStock;

  let buy = "";
  if (stock != null) {
    const n = Math.floor(stock / bpc);
    const base = st.last ? new Date(st.last.at) : now;
    const d = addDays(base, (n + 1) * interval);
    buy = `Dá para ${n} troca${n === 1 ? "" : "s"}. Compre até ${n === 0 ? "a próxima troca" : fmtShort(d)}.`;
  }

  const span = L.maxDays + 4;
  const pos = (v: number) => Math.min(100, (v / span) * 100);
  const scoopsToday = ["m_areia", "n_areia"].filter((id) =>
    doneToday(s, id, now),
  ).length;

  return (
    <>
      <Panel className="mt-4">
        <div className="meta">Última troca completa</div>
        <div className="big">
          {st.state === "nunca" || st.d == null
            ? "—"
            : st.d === 0
              ? "Hoje"
              : `${st.d} ${st.d === 1 ? "dia" : "dias"}`}
        </div>
        <div className="meta">
          {st.state === "nunca" || !st.last ? (
            "Registre a última troca para começar a contar."
          ) : (
            <>
              por {memberName(s, st.last.who)} ·{" "}
              <span className={`lbl lbl-${st.state}`}>
                {st.state === "ok"
                  ? "Em dia"
                  : st.state === "due"
                    ? "Na janela de troca"
                    : "Passou da hora"}
              </span>
            </>
          )}
        </div>
        <div className="track" aria-hidden="true">
          <div
            className="win"
            style={{
              left: `${pos(L.minDays)}%`,
              width: `${pos(L.maxDays) - pos(L.minDays)}%`,
            }}
          />
          <div className="late-zone" style={{ left: `${pos(L.maxDays)}%` }} />
          {st.d != null && (
            <div className="now" style={{ left: `${pos(st.d)}%` }} />
          )}
          <span className="tk" style={{ left: `${pos(L.minDays)}%` }}>
            {L.minDays}d
          </span>
          <span className="tk" style={{ left: `${pos(L.maxDays)}%` }}>
            {L.maxDays}d
          </span>
        </div>
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={(e) =>
            completeTask("area_troca", {
              rect: e.currentTarget.getBoundingClientRect(),
            })
          }
        >
          Registrar troca completa (usa {bpc} saco{bpc > 1 ? "s" : ""})
        </button>
      </Panel>

      <div className="stats">
        <div className="stat">
          <div className="v">{scoopsToday} de 2</div>
          <div className="k">Limpezas das caixas hoje</div>
        </div>
        <div className="stat">
          <div className="v">{kgMonth.toFixed(0)} kg</div>
          <div className="k">Areia por mês · {bagsMonth.toFixed(1)} sacos</div>
        </div>
        <div className="stat">
          <div className="v">{interval.toFixed(1)} dias</div>
          <div className="k">
            {avg ? "Intervalo médio real" : "Intervalo planejado"}
          </div>
        </div>
        <div className="stat">
          <div className="v">{L.boxes * L.kgPerBox} kg</div>
          <div className="k">
            Por troca ({L.boxes} caixas × {L.kgPerBox} kg)
          </div>
        </div>
      </div>

      <h2>Estoque de areia</h2>
      <Panel>
        <div className="stepper">
          <button
            type="button"
            onClick={() => adjustStock(-1)}
            aria-label="Menos um saco"
          >
            −
          </button>
          <span className="v">{stock ?? "?"}</span>
          <button
            type="button"
            onClick={() => adjustStock(1)}
            aria-label="Mais um saco"
          >
            +
          </button>
          <span className="meta">sacos de {L.bagKg} kg em casa</span>
        </div>
        <p className="meta mt-2">
          {stock == null
            ? "Toque em + para informar quantos sacos você tem. A troca completa desconta automaticamente."
            : buy}
        </p>
      </Panel>

      <h2>Configuração</h2>
      <Panel>
        <div className="grid2">
          <ConfigField
            label="Gatos"
            value={L.cats}
            min={1}
            max={10}
            onCommit={(v) => setLitter({ cats: v })}
          />
          <ConfigField
            label="Caixas de areia"
            value={L.boxes}
            min={1}
            max={10}
            onCommit={(v) => setLitter({ boxes: v })}
          />
          <ConfigField
            label="Kg por caixa"
            value={L.kgPerBox}
            min={1}
            max={20}
            step={0.5}
            onCommit={(v) => setLitter({ kgPerBox: v })}
          />
          <ConfigField
            label="Kg por saco"
            value={L.bagKg}
            min={1}
            max={30}
            step={0.5}
            onCommit={(v) => setLitter({ bagKg: v })}
          />
          <ConfigField
            label="Troca: mínimo de dias"
            value={L.minDays}
            min={1}
            max={60}
            onCommit={(v) => setLitter({ minDays: v })}
          />
          <ConfigField
            label="Troca: máximo de dias"
            value={L.maxDays}
            min={1}
            max={60}
            onCommit={(v) => setLitter({ maxDays: v })}
          />
        </div>
      </Panel>

      <h2>Como definir a janela</h2>
      <Panel>
        <p>
          <b>Areia de argila que não empedra:</b> com {L.cats} gatos em{" "}
          {L.boxes} caixas, troca completa a cada 5 a 7 dias. É o padrão do app.
        </p>
        <p>
          <b>Areia que forma torrões (aglomerante):</b> retire os torrões todo
          dia e complete com areia nova; troca completa a cada 2 a 3 semanas. Se
          a sua for desse tipo, ajuste para 14–21 dias acima.
        </p>
        <p>
          <b>Sinal de que passou da hora:</b> cheiro de amônia ao se aproximar,
          areia úmida no fundo ou gato fazendo fora da caixa.
        </p>
        <p className="meta">
          Veterinários costumam recomendar uma caixa por gato mais uma (
          {L.cats + 1} caixas para {L.cats} gatos). Com {L.boxes}, as duas
          limpezas diárias compensam em parte.
        </p>
      </Panel>
    </>
  );
}

function ConfigField(props: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onCommit: (v: number) => void;
}) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: o <input> está dentro de NumberInput
    <label className="f">
      {props.label}
      <NumberInput {...props} />
    </label>
  );
}
