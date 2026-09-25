import { describe, expect, it } from "vitest";
import {
  ACCEPT_LABEL,
  CONTROLLER_ENV,
  GUARDIAN_DECLARATION,
  LEGAL_DOCS,
  LEGAL_VERSION,
  MISSING,
  controllerFromEnv,
  fillLegal,
  legalToMarkdown,
  missingControllerFields,
} from "../src/index";

const allText = (id: "terms" | "privacy") => {
  const d = LEGAL_DOCS[id];
  return [
    d.intro,
    ...d.sections.flatMap((s) => [
      s.title,
      ...(s.paragraphs ?? []),
      ...(s.items ?? []),
    ]),
  ].join("\n");
};

describe("documentos legais", () => {
  it("versão no formato AAAA-MM-DD e ids de seção únicos", () => {
    expect(LEGAL_VERSION).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    for (const d of Object.values(LEGAL_DOCS)) {
      const ids = d.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(d.sections.length).toBeGreaterThan(5);
    }
  });

  it("dados da empresa não são inventados: sem variáveis, aparecem como [a preencher]", () => {
    const c = controllerFromEnv({});
    expect(Object.values(c).every((v) => v === MISSING)).toBe(true);
    expect(missingControllerFields(c).sort()).toEqual(
      Object.values(CONTROLLER_ENV).sort(),
    );
    const filled = controllerFromEnv({
      LEGAL_CONTROLLER_NAME: " Empresa Teste Ltda ",
      LEGAL_CNPJ: "00.000.000/0000-00",
    });
    expect(filled.name).toBe("Empresa Teste Ltda");
    expect(missingControllerFields(filled)).not.toContain("LEGAL_CNPJ");
  });

  it("todos os marcadores {{...}} são resolvidos por fillLegal", () => {
    const c = controllerFromEnv({});
    for (const id of ["terms", "privacy"] as const) {
      expect(fillLegal(allText(id), c)).not.toMatch(/\{\{/);
    }
  });

  it("a política cobre o conteúdo mínimo do art. 9º e os direitos do art. 18 da LGPD", () => {
    const p = allText("privacy");
    expect(p).toMatch(/controlador/i); // III
    expect(p).toMatch(/Encarregado/); // IV / art. 41
    expect(p).toMatch(/finalidade|Para que usamos/i); // I
    expect(p).toMatch(/Por quanto tempo/i); // II
    expect(p).toMatch(/compartilhamos/i); // V
    expect(p).toMatch(/art\. 18/); // VII
    expect(p).toMatch(/art\. 14/); // crianças
    expect(p).toMatch(/art\. 33/); // transferência internacional
    expect(p).toMatch(/ANPD/);
    expect(p).toMatch(/Lei nº 13\.709\/2018/);
  });

  it("os termos tratam de planos, crianças, arrependimento e foro do consumidor", () => {
    const t = allText("terms");
    expect(t).toMatch(/art\. 49 do Código de Defesa do Consumidor/);
    expect(t).toMatch(/art\. 14, § 1º/);
    expect(t).toMatch(/foro do domicílio do consumidor/);
    expect(t).toMatch(/Política de Privacidade/);
  });

  it("a declaração do responsável cita o art. 14 e a revogação", () => {
    expect(GUARDIAN_DECLARATION).toMatch(/art\. 14, § 1º/);
    expect(GUARDIAN_DECLARATION).toMatch(/revogar/);
    expect(ACCEPT_LABEL).toMatch(/Termos de Uso/);
  });

  it("gera Markdown com título e seções", () => {
    const md = legalToMarkdown(LEGAL_DOCS.terms);
    expect(md.startsWith("# Termos de Uso do Ocafy")).toBe(true);
    expect(md).toContain("## 1. Quem oferece o Ocafy");
    expect(md).toContain("{{controller}}");
    expect(
      legalToMarkdown(LEGAL_DOCS.terms, controllerFromEnv({})).includes("{{"),
    ).toBe(false);
  });
});
