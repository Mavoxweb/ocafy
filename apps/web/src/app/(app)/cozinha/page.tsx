"use client";

import { Field, Group, Panel } from "@/components/ui/primitives";
import { addMeal, cookMeal, deleteMeal, pullMeal } from "@/lib/actions";
import { SLOT_INFO } from "@/lib/catalog";
import { addDays, capitalize, dayKey, fromKey, relDay } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import { mealAlert, mealTime, memberName, proteinName } from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { PROTEINS, PROTEIN_MAP } from "@ocafy/core";
import { useState } from "react";

export default function KitchenPage() {
  const s = useAppState();
  const now = useNow();
  const today = dayKey(now);
  const [draft, setDraft] = useState({
    date: dayKey(addDays(now, 1)),
    slot: "jantar" as "almoco" | "jantar",
    dish: "",
    protein: "frango_file",
  });
  const set = <K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const meals = s.meals
    .filter(
      (m) =>
        m.date >= dayKey(addDays(now, -1)) && !(m.cookedBy && m.date < today),
    )
    .sort((a, b) => mealTime(a).getTime() - mealTime(b).getTime());

  const hours = PROTEIN_MAP[draft.protein]?.hours ?? 0;
  let lastDay = "";

  return (
    <>
      <h2>Planejar refeição</h2>
      <Panel>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!draft.date) return;
            addMeal(draft);
            set("dish", "");
          }}
        >
          <div className="grid2">
            <Field label="Dia">
              <input
                type="date"
                value={draft.date}
                min={today}
                onChange={(e) => set("date", e.target.value)}
              />
            </Field>
            <Field label="Refeição">
              <select
                value={draft.slot}
                onChange={(e) =>
                  set("slot", e.target.value as "almoco" | "jantar")
                }
              >
                <option value="almoco">{SLOT_INFO.almoco.label}</option>
                <option value="jantar">{SLOT_INFO.jantar.label}</option>
              </select>
            </Field>
          </div>
          <div className="mt-2.5">
            <Field label="Prato">
              <input
                type="text"
                value={draft.dish}
                maxLength={80}
                placeholder="Ex.: frango grelhado com legumes"
                onChange={(e) => set("dish", e.target.value)}
              />
            </Field>
          </div>
          <div className="mt-2.5">
            <Field label="Proteína congelada">
              <select
                value={draft.protein}
                onChange={(e) => set("protein", e.target.value)}
              >
                {PROTEINS.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.name}
                    {p.hours ? ` — ${p.hours} h na geladeira` : ""}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <div className="frow mt-3 justify-between">
            <span className="meta">
              {hours
                ? `Alerta para retirar ${hours} h antes`
                : "Sem alerta de descongelamento"}
            </span>
            <button type="submit" className="btn btn-primary">
              Adicionar ao plano
            </button>
          </div>
        </form>
      </Panel>

      <h2>
        Próximas refeições<small>{meals.length}</small>
      </h2>
      {meals.length ? (
        <Group>
          {meals.map((m) => {
            const a = mealAlert(m, now);
            const header =
              m.date !== lastDay
                ? capitalize(relDay(fromKey(m.date), now))
                : null;
            lastDay = m.date;
            const p = PROTEIN_MAP[m.protein];
            const info = m.cookedBy ? (
              `Preparado por ${memberName(s, m.cookedBy)}`
            ) : m.pulledBy ? (
              `Retirado por ${memberName(s, m.pulledBy)}`
            ) : a ? (
              <span className={`lbl lbl-${a.level}`}>{a.text}</span>
            ) : null;
            return (
              <div key={m.id}>
                {header && <div className="dayh">{header}</div>}
                <div className="meal">
                  <div>
                    <div className="tt">{m.dish || "Sem nome"}</div>
                    <div className="meta">
                      {SLOT_INFO[m.slot].name} · {proteinName(m.protein)}
                      {info ? <> · {info}</> : null}
                    </div>
                  </div>
                  <div className="mbtns">
                    {!!p?.hours && !m.pulledBy && !m.cookedBy && (
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={(e) =>
                          pullMeal(
                            m.id,
                            e.currentTarget.getBoundingClientRect(),
                          )
                        }
                      >
                        Retirei
                      </button>
                    )}
                    {!m.cookedBy && (
                      <button
                        type="button"
                        className="btn btn-small"
                        onClick={(e) =>
                          cookMeal(
                            m.id,
                            e.currentTarget.getBoundingClientRect(),
                          )
                        }
                      >
                        Preparei
                      </button>
                    )}
                    <button
                      type="button"
                      className="x-btn"
                      aria-label="Remover refeição"
                      onClick={() => {
                        if (confirm("Remover esta refeição do plano?"))
                          deleteMeal(m.id);
                      }}
                    >
                      ×
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </Group>
      ) : (
        <p className="empty">
          Nenhuma refeição planejada. Planeje a semana no sábado junto com a
          lista de compras.
        </p>
      )}

      <h2>Descongelar com segurança</h2>
      <Panel>
        <p>
          <b>Sempre na geladeira</b>, na prateleira de baixo, dentro de um
          recipiente para não pingar. Cerca de 24 h para porções de até 1 kg;
          peças grandes, 48 h.
        </p>
        <p>
          <b>Com pressa:</b> saco bem fechado mergulhado em água fria, trocando
          a água a cada 30 min. Ou micro-ondas no modo descongelar — e cozinhe
          logo em seguida.
        </p>
        <p>
          <b>Nunca</b> na pia em temperatura ambiente: a parte de fora esquenta
          e as bactérias se multiplicam antes do centro descongelar.
        </p>
        <p className="meta">
          Depois de descongelado na geladeira: frango, carne moída e peixe em
          1–2 dias; bifes e peças em 3–5 dias.
        </p>
      </Panel>
    </>
  );
}
