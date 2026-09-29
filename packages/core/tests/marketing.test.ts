import { describe, expect, it } from "vitest";
import {
  type Campaign,
  campaignMatchesAudience,
  isCampaignLive,
  isExternalUrl,
  pickCampaign,
} from "../src/index";

const now = new Date("2026-09-28T12:00:00Z");
const day = (n: number) =>
  new Date(now.getTime() + n * 86_400_000).toISOString();

const camp = (over: Partial<Campaign> = {}): Campaign => ({
  id: "c1",
  title: "Promoção",
  body: "Assine o Plus",
  ctaLabel: "Ver planos",
  ctaUrl: "/plano",
  kind: "banner",
  audience: "all",
  active: true,
  priority: 0,
  startsAt: day(-1),
  endsAt: null,
  dismissible: true,
  ...over,
});

describe("isCampaignLive", () => {
  it("inativa nunca está viva", () => {
    expect(isCampaignLive(camp({ active: false }), now)).toBe(false);
  });
  it("respeita início e fim", () => {
    expect(isCampaignLive(camp({ startsAt: day(1) }), now)).toBe(false);
    expect(isCampaignLive(camp({ endsAt: day(-1) }), now)).toBe(false);
    expect(isCampaignLive(camp({ endsAt: day(1) }), now)).toBe(true);
    expect(isCampaignLive(camp({ startsAt: day(-1), endsAt: null }), now)).toBe(
      true,
    );
  });
});

describe("campaignMatchesAudience", () => {
  it("all vale para qualquer plano; free/plus só para o próprio", () => {
    expect(campaignMatchesAudience(camp({ audience: "all" }), "free")).toBe(
      true,
    );
    expect(campaignMatchesAudience(camp({ audience: "all" }), "plus")).toBe(
      true,
    );
    expect(campaignMatchesAudience(camp({ audience: "free" }), "plus")).toBe(
      false,
    );
    expect(campaignMatchesAudience(camp({ audience: "plus" }), "free")).toBe(
      false,
    );
    expect(campaignMatchesAudience(camp({ audience: "plus" }), "plus")).toBe(
      true,
    );
  });
});

describe("pickCampaign", () => {
  it("sem campanhas elegíveis, não mostra nada", () => {
    expect(
      pickCampaign([], { now, plan: "free", seenIds: new Set() }),
    ).toBeNull();
    expect(
      pickCampaign([camp({ active: false })], {
        now,
        plan: "free",
        seenIds: new Set(),
      }),
    ).toBeNull();
  });

  it("escolhe a de maior prioridade entre as elegíveis", () => {
    const low = camp({ id: "low", priority: 1 });
    const high = camp({ id: "high", priority: 5 });
    expect(
      pickCampaign([low, high], { now, plan: "free", seenIds: new Set() })?.id,
    ).toBe("high");
  });

  it("empate de prioridade é resolvido de forma estável (por id)", () => {
    const a = camp({ id: "a", priority: 3 });
    const b = camp({ id: "b", priority: 3 });
    expect(
      pickCampaign([b, a], { now, plan: "free", seenIds: new Set() })?.id,
    ).toBe("a");
  });

  it("ignora campanhas já vistas e passa para a próxima elegível", () => {
    const a = camp({ id: "a", priority: 5 });
    const b = camp({ id: "b", priority: 1 });
    expect(
      pickCampaign([a, b], { now, plan: "free", seenIds: new Set(["a"]) })?.id,
    ).toBe("b");
    expect(
      pickCampaign([a, b], { now, plan: "free", seenIds: new Set(["a", "b"]) }),
    ).toBeNull();
  });

  it("filtra por audiência e por janela de datas antes de escolher", () => {
    const plusOnly = camp({ id: "plus", audience: "plus", priority: 9 });
    const forAll = camp({ id: "all", audience: "all", priority: 1 });
    expect(
      pickCampaign([plusOnly, forAll], {
        now,
        plan: "free",
        seenIds: new Set(),
      })?.id,
    ).toBe("all");
    const future = camp({ id: "future", startsAt: day(5), priority: 9 });
    expect(
      pickCampaign([future, forAll], { now, plan: "free", seenIds: new Set() })
        ?.id,
    ).toBe("all");
  });
});

describe("isExternalUrl", () => {
  it("distingue link interno de externo", () => {
    expect(isExternalUrl("/plano")).toBe(false);
    expect(isExternalUrl("https://exemplo.com")).toBe(true);
    expect(isExternalUrl("http://exemplo.com")).toBe(true);
  });
});
