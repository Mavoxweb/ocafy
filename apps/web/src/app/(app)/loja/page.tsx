"use client";

import { Coin } from "@/components/ui/icons";
import { Group, Panel } from "@/components/ui/primitives";
import { addReward, buyReward, resolvePurchase } from "@/lib/actions";
import { XP_PER_COIN } from "@/lib/catalog";
import { fmtShort } from "@/lib/dates";
import { useNow } from "@/lib/hooks";
import {
  coinsOf,
  currentMember,
  memberById,
  partnerOf,
  weeklyGoal,
} from "@/lib/selectors";
import { useAppState } from "@/lib/store";
import { useState } from "react";

const EMOJIS = [
  "🎁",
  "🎬",
  "☕",
  "🍽️",
  "💆",
  "🍝",
  "😴",
  "🍫",
  "🎮",
  "🌳",
  "🛁",
  "🎵",
];

const STATUS_TEXT = {
  pending: "Aguardando aprovação",
  approved: "Aprovado",
  rejected: "Recusado",
} as const;

export default function ShopPage() {
  const s = useAppState();
  const now = useNow();
  const me = currentMember(s);
  const partner = partnerOf(s, me?.id);
  const goal = weeklyGoal(s, now);
  const [form, setForm] = useState({ title: "", cost: "50", icon: "🎁" });
  const [open, setOpen] = useState(false);
  if (!me) return null;

  const coins = coinsOf(s, me.id);
  const toApprove = s.purchases.filter(
    (p) => p.status === "pending" && p.memberId !== me.id,
  );
  const history = [...s.purchases]
    .filter((p) => p.memberId === me.id || p.status !== "pending")
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .slice(0, 12);

  return (
    <>
      <div className="hero mint">
        <span className="hico" style={{ fontSize: "1.7rem" }}>
          <Coin />
        </span>
        <div className="htx">
          <b>{coins}</b>
          <span>moedas de {me.name}</span>
        </div>
        {partner && (
          <span className="hpill" style={{ color: "#1f4d2b" }}>
            {partner.name}: {coinsOf(s, partner.id)}
          </span>
        )}
        <div className="hbar">
          <i style={{ width: `${goal.progressPercent}%` }} />
        </div>
      </div>
      <p className="meta">
        A cada {XP_PER_COIN} XP você ganha 1 moeda. Meta da semana:{" "}
        {goal.currentXp} de {goal.targetXp} XP da dupla — bater rende +
        {goal.coinsReward} moedas para cada um.
      </p>

      {toApprove.length > 0 && (
        <section>
          <h2>
            Para você aprovar<small>{toApprove.length}</small>
          </h2>
          {toApprove.map((p) => {
            const r = s.rewards.find((x) => x.id === p.rewardId);
            return (
              <div key={p.id} className="alert due">
                <div>
                  <div className="tt">
                    {r?.icon} {r?.title ?? "Recompensa"}
                  </div>
                  <div className="meta">
                    {memberById(s, p.memberId)?.name} pagou {p.costCoins} moedas
                  </div>
                </div>
                <div className="mbtns">
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => resolvePurchase(p.id, true)}
                  >
                    Aprovar
                  </button>
                  <button
                    type="button"
                    className="btn btn-small"
                    onClick={() => resolvePurchase(p.id, false)}
                  >
                    Recusar
                  </button>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <h2>
        Lojinha da casa<small>{s.rewards.length} prêmios</small>
      </h2>
      <div className="shop-grid">
        {s.rewards.map((r) => {
          const can = coins >= r.costCoins;
          return (
            <div key={r.id} className="reward">
              <span className="em" aria-hidden="true">
                {r.icon}
              </span>
              <b>{r.title}</b>
              <div className="rfoot">
                <span className="coins">
                  <Coin /> {r.costCoins}
                </span>
                <button
                  type="button"
                  className="btn btn-small"
                  disabled={!can}
                  onClick={() => buyReward(r.id)}
                  aria-label={`Resgatar ${r.title} por ${r.costCoins} moedas`}
                >
                  {can ? "Resgatar" : `Faltam ${r.costCoins - coins}`}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <h2>Novo prêmio</h2>
      {open ? (
        <Panel>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (addReward(form.title, Number(form.cost), form.icon)) {
                setForm({ title: "", cost: "50", icon: "🎁" });
                setOpen(false);
              }
            }}
          >
            <label className="f">
              Nome do prêmio
              <input
                type="text"
                maxLength={60}
                placeholder="Ex.: Escolher a playlist da semana"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
            <div className="mt-2.5">
              <label className="f">
                Custo em moedas
                <input
                  type="number"
                  min={1}
                  value={form.cost}
                  onChange={(e) => setForm({ ...form, cost: e.target.value })}
                />
              </label>
            </div>
            <div
              className="mt-3 flex flex-wrap gap-1.5"
              // biome-ignore lint/a11y/useSemanticElements: contêiner flex; <fieldset> traz estilos próprios
              role="group"
              aria-label="Ícone"
            >
              {EMOJIS.map((em) => (
                <button
                  type="button"
                  key={em}
                  className="react"
                  aria-pressed={form.icon === em}
                  onClick={() => setForm({ ...form, icon: em })}
                >
                  {em}
                </button>
              ))}
            </div>
            <div className="frow mt-3">
              <button type="submit" className="btn btn-primary">
                Adicionar à lojinha
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>
            </div>
          </form>
        </Panel>
      ) : (
        <button type="button" className="btn" onClick={() => setOpen(true)}>
          + Criar um prêmio da casa
        </button>
      )}

      <h2>Pedidos recentes</h2>
      {history.length ? (
        <Group>
          {history.map((p) => {
            const r = s.rewards.find((x) => x.id === p.rewardId);
            return (
              <div key={p.id} className="logrow">
                <div>
                  <div>
                    {r?.icon} {r?.title ?? "Recompensa"}
                  </div>
                  <div className="meta">
                    {memberById(s, p.memberId)?.name} · {p.costCoins} moedas ·{" "}
                    {fmtShort(new Date(p.createdAt))}
                  </div>
                </div>
                <span
                  className={`lbl lbl-${p.status === "approved" ? "ok" : p.status === "pending" ? "due" : "late"}`}
                >
                  {STATUS_TEXT[p.status]}
                </span>
              </div>
            );
          })}
        </Group>
      ) : (
        <p className="empty">
          Nenhum pedido ainda. Junte moedas fazendo as tarefas da casa.
        </p>
      )}
    </>
  );
}
