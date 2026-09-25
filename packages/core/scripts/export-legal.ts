import { mkdirSync, writeFileSync } from "node:fs";
import {
  LEGAL_VERSION,
  PRIVACY,
  TERMS,
  legalToMarkdown,
} from "../src/legal.ts";

/** Gera docs/legal/*.md a partir da fonte única (src/legal.ts). Marcadores ficam visíveis para revisão. */
const out = new URL("../../../docs/legal/", import.meta.url);
mkdirSync(out, { recursive: true });

const header = (name: string) =>
  `> **MINUTA PARA REVISÃO JURÍDICA — versão ${LEGAL_VERSION}.** Arquivo gerado de \`packages/core/src/legal.ts\` (não edite aqui).\n> Os marcadores \`{{...}}\` são preenchidos no aplicativo com os dados da empresa. Veja \`REVISAO-JURIDICA.md\`.\n\n`;

writeFileSync(
  new URL("TERMOS-DE-USO.md", out),
  header("terms") + legalToMarkdown(TERMS),
);
writeFileSync(
  new URL("POLITICA-DE-PRIVACIDADE.md", out),
  header("privacy") + legalToMarkdown(PRIVACY),
);
console.log(`docs/legal atualizado (versão ${LEGAL_VERSION})`);
