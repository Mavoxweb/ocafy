import { createHash } from "node:crypto";
import {
  type ConsentContext,
  GUARDIAN_DECLARATION,
  LEGAL_DOCS,
  LEGAL_VERSION,
} from "@ocafy/core";
import { db, legalAcceptances } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";

/**
 * Aceite dos documentos legais. O servidor é quem decide: só vale o aceite da versão VIGENTE,
 * e cada aceite guarda o hash do texto exato que a pessoa viu (prova, LGPD art. 8º, § 2º).
 */

const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export const documentHash = (doc: "terms" | "privacy" | "guardian"): string =>
  doc === "guardian"
    ? sha(GUARDIAN_DECLARATION)
    : sha(JSON.stringify(LEGAL_DOCS[doc]));

/** Recusa aceite de uma versão que não é a vigente (o app estava desatualizado). */
export function assertCurrentVersion(version: string): void {
  if (version !== LEGAL_VERSION) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "LEGAL_VERSION_MISMATCH",
    });
  }
}

/** Registra o aceite dos Termos de Uso e da Política de Privacidade da versão vigente. */
export async function recordAcceptance(
  userId: string,
  context: Exclude<ConsentContext, "guardian">,
): Promise<void> {
  await db.insert(legalAcceptances).values(
    (["terms", "privacy"] as const).map((document) => ({
      userId,
      document,
      version: LEGAL_VERSION,
      contentHash: documentHash(document),
      context,
    })),
  );
}

/** Declaração do responsável ao criar um perfil de criança (art. 14, § 1º). */
export async function recordGuardian(
  userId: string,
  profileId: string,
): Promise<void> {
  await db.insert(legalAcceptances).values({
    userId,
    document: "guardian",
    version: LEGAL_VERSION,
    contentHash: documentHash("guardian"),
    context: "guardian",
    subject: profileId,
  });
}

/** A pessoa já aceitou Termos e Política na versão vigente? */
export async function hasAcceptedCurrent(userId: string): Promise<boolean> {
  const rows = await db
    .select({ document: legalAcceptances.document })
    .from(legalAcceptances)
    .where(
      and(
        eq(legalAcceptances.userId, userId),
        eq(legalAcceptances.version, LEGAL_VERSION),
      ),
    );
  const docs = new Set(rows.map((r) => r.document));
  return docs.has("terms") && docs.has("privacy");
}

/** Histórico de aceites da pessoa (para a exportação LGPD). */
export const acceptancesOf = (userId: string) =>
  db
    .select({
      document: legalAcceptances.document,
      version: legalAcceptances.version,
      contentHash: legalAcceptances.contentHash,
      context: legalAcceptances.context,
      subject: legalAcceptances.subject,
      acceptedAt: legalAcceptances.acceptedAt,
    })
    .from(legalAcceptances)
    .where(eq(legalAcceptances.userId, userId))
    .orderBy(desc(legalAcceptances.acceptedAt));
