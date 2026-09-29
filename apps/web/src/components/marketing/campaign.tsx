"use client";

import {
  clickCampaign,
  dismissCampaign,
  markCampaignShown,
} from "@/lib/actions";
import { useAppState } from "@/lib/store";
import { isExternalUrl } from "@ocafy/core";
import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Aviso ou promoção do time (painel admin → Marketing). A `snapshot` já manda no máximo um, do
 * jeito certo para esta casa; aqui só decidimos como desenhar (cartão ou popup) e registramos o
 * que a pessoa faz com ele.
 */
/** Cartão dispensável — só faz sentido na tela Hoje, junto dos demais avisos da casa. */
export function CampaignBannerSlot() {
  const s = useAppState();
  const c = s.campaign;
  return c && c.kind === "banner" ? (
    <CampaignBanner key={c.id} campaign={c} />
  ) : null;
}

/** Popup central — fica no shell do app para interromper em qualquer tela. */
export function CampaignModalSlot() {
  const s = useAppState();
  const c = s.campaign;
  return c && c.kind === "modal" ? (
    <CampaignModal key={c.id} campaign={c} />
  ) : null;
}

type Campaign = NonNullable<ReturnType<typeof useAppState>["campaign"]>;

function Cta({
  campaign,
  className,
  onNavigate,
}: { campaign: Campaign; className: string; onNavigate?: () => void }) {
  if (!campaign.ctaLabel || !campaign.ctaUrl) return null;
  const external = isExternalUrl(campaign.ctaUrl);
  const click = () => {
    clickCampaign(campaign.id);
    onNavigate?.();
  };
  if (external) {
    return (
      <a
        href={campaign.ctaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        onClick={click}
      >
        {campaign.ctaLabel}
      </a>
    );
  }
  return (
    <Link href={campaign.ctaUrl} className={className} onClick={click}>
      {campaign.ctaLabel}
    </Link>
  );
}

function CampaignBanner({ campaign: c }: { campaign: Campaign }) {
  useEffect(() => markCampaignShown(c.id), [c.id]);
  return (
    <div className="panel promo-banner">
      <div className="min-w-0 flex-1">
        <b>{c.title}</b>
        <p className="meta mb-0">{c.body}</p>
      </div>
      <div className="flex items-center gap-2">
        <Cta campaign={c} className="btn btn-small btn-primary" />
        {c.dismissible && (
          <button
            type="button"
            className="x-btn"
            aria-label="Dispensar aviso"
            onClick={() => dismissCampaign(c.id)}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function CampaignModal({ campaign: c }: { campaign: Campaign }) {
  const [open, setOpen] = useState(true);
  useEffect(() => markCampaignShown(c.id), [c.id]);
  useEffect(() => {
    if (!c.dismissible) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [c.dismissible]);
  if (!open) return null;
  return (
    // biome-ignore lint/a11y/useKeyWithClickEvents: fechar com Esc já é tratado no listener acima
    <div
      className="promo-backdrop"
      role="presentation"
      onClick={(e) => {
        if (c.dismissible && e.target === e.currentTarget) setOpen(false);
      }}
    >
      <ModalCard campaign={c} onClose={() => setOpen(false)} />
    </div>
  );
}

/** Extraído à parte: o comentário de supressão abaixo só é respeitado na raiz de um `return`. */
function ModalCard({
  campaign: c,
  onClose,
}: { campaign: Campaign; onClose: () => void }) {
  return (
    <div
      className="promo-modal"
      // biome-ignore lint/a11y/useSemanticElements: <dialog> exigiria showModal()/foco próprios; mantém o overlay já usado no app
      role="dialog"
      aria-modal="true"
      aria-label={c.title}
    >
      {c.dismissible && (
        <button
          type="button"
          className="x-btn promo-close"
          aria-label="Fechar"
          onClick={onClose}
        >
          ×
        </button>
      )}
      <h3>{c.title}</h3>
      <p>{c.body}</p>
      <div className="flex flex-wrap items-center gap-3">
        <Cta campaign={c} className="btn btn-primary" onNavigate={onClose} />
        <button type="button" className="link" onClick={onClose}>
          {c.ctaLabel ? "Agora não" : "Fechar"}
        </button>
      </div>
    </div>
  );
}
