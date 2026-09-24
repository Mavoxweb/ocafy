"use client";

import { StepRows } from "@/components/office/step-rows";
import { IconCheck, IconStar, RoomIcon } from "@/components/ui/icons";
import { Chip, Chips, Group, Panel } from "@/components/ui/primitives";
import {
  addInventoryItem,
  finishOfficeGoal,
  removeInventoryItem,
  setInventoryDest,
  startOffice,
} from "@/lib/actions";
import {
  INVENTORY_CATEGORIES,
  INVENTORY_DEST,
  type InventoryDest,
  OFFICE_GOALS,
  OFFICE_GOAL_XP,
} from "@/lib/catalog";
import { useNow } from "@/lib/hooks";
import {
  memberName,
  officeCurrent,
  officeDoneCount,
  officeStatus,
  officeStepsPct,
  officeWeek,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { openSheet } from "@/lib/ui";
import Link from "next/link";
import { useState } from "react";

const ZIGZAG = [0, 52, 78, 52, 0, -52, -78, -52];

export default function OfficePage() {
  const s = useAppState();
  const now = useNow();
  const o = s.office;
  const n = officeDoneCount(s);
  const cur = officeCurrent(s);
  const st = officeStatus(s, now);
  const week = officeWeek(s, now);
  const [draft, setDraft] = useState<{
    name: string;
    category: string;
    dest: InventoryDest;
  }>({
    name: "",
    category: "Diversos",
    dest: "fica",
  });
  const [filter, setFilter] = useState<InventoryDest | "">("");

  const inv = [...o.inventory].sort((a, b) => (a.at < b.at ? 1 : -1));
  const counts = inv.reduce<Record<string, number>>((acc, i) => {
    acc[i.dest] = (acc[i.dest] ?? 0) + 1;
    return acc;
  }, {});
  const shown = filter ? inv.filter((i) => i.dest === filter) : inv;

  return (
    <>
      <Link href="/" className="link mt-2.5 text-[0.9rem]">
        ‹ Voltar para Hoje
      </Link>
      <div className="hero mint">
        <span className="hico">
          <RoomIcon room="escritorio" size={26} />
        </span>
        <div className="htx">
          <b>
            {n}/{OFFICE_GOALS.length}
          </b>
          <span>
            objetivos ·{" "}
            {o.start
              ? `semana ${week} de ${OFFICE_GOALS.length}`
              : "projeto de 9 semanas"}
          </span>
        </div>
        <span className="hpill">{st.text}</span>
        <div className="hbar">
          <i
            style={{ width: `${Math.round((n / OFFICE_GOALS.length) * 100)}%` }}
          />
        </div>
      </div>

      {cur ? (
        <>
          <h2>
            {o.start ? "Objetivo da semana" : "Primeiro objetivo"}
            <small>semana {OFFICE_GOALS.indexOf(cur) + 1}</small>
          </h2>
          <Panel>
            <b className="block text-[1.15rem] font-extrabold leading-tight tracking-tight">
              {cur.t}
            </b>
            <p className="meta">{cur.why}</p>
            <div className="mt-3">
              <div className="bar" style={{ margin: "12px 0 4px" }}>
                <i style={{ width: `${officeStepsPct(s, cur.id)}%` }} />
              </div>
            </div>
            <div className="group mt-2.5">
              <StepRows goal={cur} />
            </div>
            {o.start ? (
              <button
                type="button"
                className="btn btn-primary btn-block"
                disabled={officeStepsPct(s, cur.id) < 100}
                onClick={(e) =>
                  finishOfficeGoal(
                    cur.id,
                    e.currentTarget.getBoundingClientRect(),
                  )
                }
              >
                Concluir objetivo · +{OFFICE_GOAL_XP} XP
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-block"
                onClick={startOffice}
              >
                Começar o projeto esta semana
              </button>
            )}
          </Panel>
        </>
      ) : (
        <Panel>
          <b className="block text-[1.15rem] font-extrabold">
            Escritório pronto 🎉
          </b>
          <p className="meta">
            Os 9 objetivos foram concluídos. Mantenham a regra: nada entra sem
            lugar.
          </p>
        </Panel>
      )}

      <h2>
        Trilha do escritório<small>toque para ver</small>
      </h2>
      <div className="path">
        {OFFICE_GOALS.map((g, i) => {
          const d = o.done[g.id];
          const isCur = g.id === cur?.id;
          const cls = d ? "done" : isCur ? "cur" : "lock";
          return (
            <div
              key={g.id}
              className="pnode-wrap"
              style={
                {
                  "--x": `${ZIGZAG[i % ZIGZAG.length]}px`,
                } as React.CSSProperties
              }
            >
              <button
                type="button"
                className={`pnode ${cls}`}
                aria-label={`Semana ${i + 1}: ${g.t}`}
                onClick={() => openSheet({ kind: "goal", id: g.id })}
              >
                {d ? <IconCheck size={28} /> : isCur ? <IconStar /> : i + 1}
              </button>
              <span className="plabel">
                Semana {i + 1}
                <br />
                <b>{g.short}</b>
              </span>
            </div>
          );
        })}
      </div>

      <h2>
        Inventário
        <small>
          {inv.length} {inv.length === 1 ? "item" : "itens"}
        </small>
      </h2>
      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (addInventoryItem(draft.name, draft.category, draft.dest))
              setDraft({ ...draft, name: "" });
          }}
        >
          <label className="f">
            Item
            <input
              type="text"
              maxLength={60}
              placeholder="Ex.: HD externo, pasta de documentos"
              enterKeyHint="done"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            />
          </label>
          <div className="grid2 mt-2.5">
            <label className="f">
              Categoria
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value })
                }
              >
                {INVENTORY_CATEGORIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </label>
            <label className="f">
              Destino
              <select
                value={draft.dest}
                onChange={(e) =>
                  setDraft({ ...draft, dest: e.target.value as InventoryDest })
                }
              >
                {Object.entries(INVENTORY_DEST).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button type="submit" className="btn btn-primary btn-block">
            Adicionar ao inventário
          </button>
        </form>
      </Panel>
      <div className="my-2.5">
        <Chips>
          <Chip pressed={!filter} onClick={() => setFilter("")}>
            Todos · {inv.length}
          </Chip>
          {(Object.entries(INVENTORY_DEST) as [InventoryDest, string][]).map(
            ([k, l]) => (
              <Chip key={k} pressed={filter === k} onClick={() => setFilter(k)}>
                {l} · {counts[k] ?? 0}
              </Chip>
            ),
          )}
        </Chips>
      </div>
      {shown.length ? (
        <Group>
          {shown.map((i) => (
            <div key={i.id} className="inv-item">
              <div className="min-w-0 flex-1">
                <div className="tt truncate">{i.name}</div>
                <div className="meta">
                  {i.category} · {memberName(s, i.who)}
                </div>
              </div>
              <select
                value={i.dest}
                aria-label="Destino"
                onChange={(e) =>
                  setInventoryDest(i.id, e.target.value as InventoryDest)
                }
              >
                {Object.entries(INVENTORY_DEST).map(([k, l]) => (
                  <option key={k} value={k}>
                    {l}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="x-btn"
                aria-label="Remover item"
                onClick={() => {
                  if (confirm("Remover este item do inventário?"))
                    removeInventoryItem(i.id);
                }}
              >
                ×
              </button>
            </div>
          ))}
        </Group>
      ) : (
        <p className="empty">
          Nada catalogado ainda. Cadastre os itens conforme abre as caixas.
        </p>
      )}
    </>
  );
}
