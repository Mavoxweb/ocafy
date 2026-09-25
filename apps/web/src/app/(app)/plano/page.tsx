"use client";

import { Panel } from "@/components/ui/primitives";
import { useNow } from "@/lib/hooks";
import { useAppState } from "@/lib/store";
import {
  type BillingInterval,
  PLANS,
  PLUS_PRICES,
  TRIAL_DAYS,
  formatBRL,
} from "@ocafy/core";

const INTERVALS: { key: BillingInterval; label: string; note: string }[] = [
  { key: "quarterly", label: "Trimestral", note: "cobrado a cada 3 meses" },
  { key: "yearly", label: "Anual", note: "o melhor preço por mês" },
];

const fmtDate = (iso: string) =>
  new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });

export default function PlanPage() {
  const s = useAppState();
  const now = useNow();
  const p = s.plan;
  const configured = !!(p.checkout.quarterly || p.checkout.yearly);
  const daysLeft = p.expiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(p.expiresAt).getTime() - now.getTime()) / 86_400_000,
        ),
      )
    : null;

  const status =
    p.pastDue && p.expiresAt
      ? `Pagamento pendente — o Plus continua até ${fmtDate(p.expiresAt)}.`
      : p.source === "trial" && p.trialEndsAt
        ? `Teste gratuito até ${fmtDate(p.trialEndsAt)}${daysLeft != null ? ` (${daysLeft} ${daysLeft === 1 ? "dia" : "dias"})` : ""}.`
        : p.source === "founder"
          ? "Cortesia de casa fundadora: o Plus é seu, sem custo."
          : p.source === "manual" || p.source === "promo"
            ? p.expiresAt
              ? `Plus liberado até ${fmtDate(p.expiresAt)}.`
              : "Plus liberado pela equipe."
            : p.source === "subscription"
              ? p.expiresAt
                ? `Assinatura ativa até ${fmtDate(p.expiresAt)}.`
                : "Assinatura ativa."
              : "Você está no plano Grátis.";

  return (
    <>
      <h2 className="mt-4">Meu plano</h2>
      <Panel>
        <div className="flex items-center justify-between gap-3">
          <b className="text-[1.15rem]">
            {p.id === "plus" ? PLANS.plus.name : PLANS.free.name}
          </b>
          <span className={`tpill st-${p.pastDue ? "late" : "ok"}`}>
            {p.pastDue ? "Atenção" : "Ativo"}
          </span>
        </div>
        <p className="meta mb-0">{status}</p>
        <p className="meta mt-2 mb-0">
          Em uso: {p.usage.pets} {p.usage.pets === 1 ? "pet" : "pets"} · limite{" "}
          {p.entitlements.maxPets >= 99 ? "ilimitado" : p.entitlements.maxPets}
          {p.entitlements.family ? " · modo Família liberado" : ""}
        </p>
      </Panel>

      <h2>Comparar planos</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {(["free", "plus"] as const).map((id) => (
          <Panel key={id} className={p.id === id ? "plan-current" : undefined}>
            <b className="text-[1.05rem]">{PLANS[id].name}</b>
            <p className="meta mt-1">{PLANS[id].tagline}</p>
            <ul className="plan-list">
              {PLANS[id].features.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </Panel>
        ))}
      </div>

      <h2>Assinar o Plus</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {INTERVALS.map((i) => {
          const url = p.checkout[i.key];
          return (
            <Panel key={i.key}>
              <b>{i.label}</b>
              <div className="big">{formatBRL(PLUS_PRICES[i.key])}</div>
              <p className="meta mt-0">{i.note}</p>
              {url ? (
                <a href={url} className="btn btn-primary btn-block">
                  Assinar {i.label.toLowerCase()}
                </a>
              ) : (
                <button type="button" className="btn btn-block" disabled>
                  Em breve
                </button>
              )}
            </Panel>
          );
        })}
      </div>
      <p className="meta mt-3">
        {configured
          ? "O pagamento é feito em uma página segura. Depois de pagar, o Plus é liberado para a casa toda em poucos minutos."
          : `Novas casas ganham ${TRIAL_DAYS} dias de Plus grátis. A assinatura estará disponível em breve.`}{" "}
        Nada do que você já registrou é apagado se o plano mudar: só deixa de
        ser possível adicionar mais além do limite.
      </p>
    </>
  );
}
