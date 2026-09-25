"use client";

import { Chip, Panel, Segmented } from "@/components/ui/primitives";
import {
  addShopItem,
  finishShopping,
  removeShopItem,
  setShopHabit,
  setShopUrgency,
  toggleBought,
} from "@/lib/actions";
import { WEEKDAYS, capitalize, fmtShort } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import { memberName } from "@/lib/selectors";
import { type ShoppingItem, useAppState } from "@/lib/store";
import {
  CADENCE_DAYS,
  CADENCE_LABELS,
  type ShopCadence,
  type ShopUrgency,
  URGENCY_LABELS,
  URGENCY_ORDER,
  inferCadence,
  nextShopDate,
  sortShopping,
} from "@ocafy/core";
import { useState } from "react";

const NEXT_URGENCY: Record<ShopUrgency, ShopUrgency> = {
  now: "soon",
  soon: "later",
  later: "now",
};

export default function ShoppingPage() {
  const s = useAppState();
  const now = useNow();
  const [market, setMarket] = useState(false);
  const [name, setName] = useState("");
  const [qty, setQty] = useState("");
  const [urgency, setUrgency] = useState<ShopUrgency>("soon");
  const [habitOpen, setHabitOpen] = useState(false);

  const { items, cadence, day, trips } = s.shopping;
  const open = sortShopping(items.filter((i) => i.status === "open"));
  const bought = items.filter((i) => i.status === "bought");
  const next = nextShopDate(trips[0] ?? null, cadence, day, now);
  const inferred = inferCadence(trips);
  const urgent = open.filter((i) => i.urgency === "now").length;
  const daysToNext = next
    ? Math.ceil((next.getTime() - now.getTime()) / 86_400_000)
    : null;

  function submit() {
    if (addShopItem(name, urgency, qty)) {
      setName("");
      setQty("");
    }
  }

  return (
    <>
      <div className="mt-4 flex items-center justify-between gap-3">
        <h2 className="m-0">Lista de compras</h2>
        <Segmented
          label="Modo"
          value={market ? "mercado" : "lista"}
          onChange={(v) => setMarket(v === "mercado")}
          options={[
            { value: "lista", label: "Lista" },
            { value: "mercado", label: "No mercado" },
          ]}
        />
      </div>

      {!market && (
        <>
          <Panel className="mt-3">
            <div className="text-[0.82rem] font-bold text-muted">
              Próxima ida ao mercado
            </div>
            {next ? (
              <>
                <div className="big">
                  {daysToNext != null && daysToNext <= 0
                    ? "Hoje"
                    : daysToNext === 1
                      ? "Amanhã"
                      : fmtShort(next)}
                </div>
                <div className="meta">
                  {CADENCE_LABELS[cadence as ShopCadence]}
                  {day != null ? ` · ${capitalize(WEEKDAYS[day])}` : ""}
                  {urgent > 0
                    ? ` · ${urgent} ${urgent === 1 ? "item urgente" : "itens urgentes"}`
                    : ""}
                </div>
              </>
            ) : (
              <p className="meta m-0">
                Diga com que frequência vocês vão ao mercado e o Ocafy lembra a
                hora de reunir a lista.
              </p>
            )}
            {inferred.cadence && inferred.cadence !== cadence && (
              <p className="meta mt-2">
                Vocês têm ido a cada ~{Math.round(inferred.avgDays ?? 0)} dias.{" "}
                <button
                  type="button"
                  className="link"
                  onClick={() => setShopHabit(inferred.cadence, day)}
                >
                  Usar “{CADENCE_LABELS[inferred.cadence]}”
                </button>
              </p>
            )}
            <button
              type="button"
              className="link mt-1"
              onClick={() => setHabitOpen((v) => !v)}
            >
              {habitOpen ? "Fechar" : "Ajustar hábito de compra"}
            </button>
            {habitOpen && (
              <div className="mt-2 grid gap-3">
                <div className="chips wrap">
                  {(Object.keys(CADENCE_DAYS) as ShopCadence[]).map((c) => (
                    <Chip
                      key={c}
                      pressed={cadence === c}
                      onClick={() => setShopHabit(c, day)}
                    >
                      {CADENCE_LABELS[c]}
                    </Chip>
                  ))}
                  <Chip
                    pressed={!cadence}
                    onClick={() => setShopHabit(null, null)}
                  >
                    Sem rotina fixa
                  </Chip>
                </div>
                {cadence && (
                  <div>
                    <div className="qlabel">Dia preferido</div>
                    <div className="chips wrap">
                      <Chip
                        pressed={day == null}
                        onClick={() => setShopHabit(cadence, null)}
                      >
                        Qualquer
                      </Chip>
                      {WEEKDAYS.map((w, i) => (
                        <Chip
                          key={w}
                          pressed={day === i}
                          onClick={() => setShopHabit(cadence, i)}
                        >
                          {capitalize(w).slice(0, 3)}
                        </Chip>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </Panel>

          <form
            className="panel mt-3 grid gap-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            <div className="flex gap-2">
              <input
                type="text"
                className="flex-1"
                maxLength={60}
                placeholder="Adicionar item (ex.: leite)"
                aria-label="Novo item"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <input
                type="text"
                style={{ width: 96 }}
                maxLength={24}
                placeholder="Qtd."
                aria-label="Quantidade"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
              />
            </div>
            <div className="chips wrap">
              {URGENCY_ORDER.map((u) => (
                <Chip
                  key={u}
                  pressed={urgency === u}
                  onClick={() => setUrgency(u)}
                >
                  {URGENCY_LABELS[u].name}
                </Chip>
              ))}
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!name.trim()}
            >
              Adicionar
            </button>
          </form>
        </>
      )}

      {market ? (
        <MarketMode open={open} bought={bought} />
      ) : (
        <>
          {URGENCY_ORDER.map((u) => {
            const list = open.filter((i) => i.urgency === u);
            return list.length ? (
              <section key={u}>
                <h2>
                  {URGENCY_LABELS[u].name}
                  <small>{list.length}</small>
                </h2>
                <div className="group">
                  {list.map((i) => (
                    <ItemRow key={i.id} item={i} />
                  ))}
                </div>
              </section>
            ) : null;
          })}
          {!open.length && (
            <p className="empty">
              Lista vazia. Adicione o que está acabando — a outra pessoa vê na
              hora.
            </p>
          )}
          {bought.length > 0 && (
            <section>
              <h2>
                No carrinho<small>{bought.length}</small>
              </h2>
              <div className="group">
                {bought.map((i) => (
                  <ItemRow key={i.id} item={i} />
                ))}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-block mt-2"
                onClick={finishShopping}
              >
                Terminei as compras
              </button>
            </section>
          )}
        </>
      )}
    </>
  );
}

function ItemRow({ item }: { item: ShoppingItem }) {
  const s = useAppState();
  const done = item.status === "bought";
  return (
    <div className={`chk ${done ? "done" : ""}`}>
      <button
        type="button"
        className="box"
        aria-pressed={done}
        aria-label={`${done ? "Desmarcar" : "Comprei"}: ${item.name}`}
        onClick={() => toggleBought(item.id)}
      >
        {done && "✓"}
      </button>
      <div className="min-w-0">
        <div className="tt">
          {item.name}
          {item.quantity ? (
            <span className="text-muted"> · {item.quantity}</span>
          ) : null}
        </div>
        <div className="meta">
          {item.category}
          {item.addedBy ? ` · ${memberName(s, item.addedBy)}` : ""}
        </div>
      </div>
      {!done && (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className={`urg urg-${item.urgency}`}
            aria-label={`Urgência: ${URGENCY_LABELS[item.urgency].name}. Toque para mudar`}
            onClick={() => setShopUrgency(item.id, NEXT_URGENCY[item.urgency])}
          >
            {item.urgency === "now" ? "!" : item.urgency === "soon" ? "•" : "…"}
          </button>
          <button
            type="button"
            className="x-btn"
            aria-label={`Remover ${item.name}`}
            onClick={() => removeShopItem(item.id)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}

/** No mercado: itens agrupados por corredor (categoria), fáceis de tocar com o carrinho na mão. */
function MarketMode({
  open,
  bought,
}: { open: ShoppingItem[]; bought: ShoppingItem[] }) {
  const byCat = new Map<string, ShoppingItem[]>();
  for (const i of open) {
    const l = byCat.get(i.category) ?? [];
    l.push(i);
    byCat.set(i.category, l);
  }
  return (
    <>
      <p className="meta mt-3">
        Toque em cada item ao colocá-lo no carrinho. Quando terminar, feche as
        compras — o Ocafy aprende o ritmo de vocês.
      </p>
      {[...byCat.entries()].map(([cat, list]) => (
        <section key={cat}>
          <h2>
            {cat}
            <small>{list.length}</small>
          </h2>
          <div className="group">
            {list.map((i) => (
              <button
                key={i.id}
                type="button"
                className="market-row"
                onClick={() => toggleBought(i.id)}
              >
                <span className="box" aria-hidden="true" />
                <span className="tt">
                  {i.name}
                  {i.quantity ? (
                    <span className="text-muted"> · {i.quantity}</span>
                  ) : null}
                </span>
                {i.urgency === "now" && <span className="urg urg-now">!</span>}
              </button>
            ))}
          </div>
        </section>
      ))}
      {bought.length > 0 && (
        <section>
          <h2>
            No carrinho<small>{bought.length}</small>
          </h2>
          <div className="group">
            {bought.map((i) => (
              <button
                key={i.id}
                type="button"
                className="market-row done"
                onClick={() => toggleBought(i.id)}
              >
                <span className="box" aria-hidden="true">
                  ✓
                </span>
                <span className="tt">{i.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
      <button
        type="button"
        className="btn btn-primary btn-block mt-3"
        disabled={!bought.length}
        onClick={finishShopping}
      >
        Terminei as compras
      </button>
      {!open.length && !bought.length && (
        <p className="empty">Nada na lista.</p>
      )}
    </>
  );
}
