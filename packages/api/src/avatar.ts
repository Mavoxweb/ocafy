import { db, householdMembers } from "@ocafy/db";
import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";

/** Foto já reduzida no cliente (~256 px); este teto barra qualquer coisa fora do esperado. */
export const AVATAR_MAX_BYTES = 120 * 1024;

const DATA_URL =
  /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

export interface ParsedAvatar {
  type: "image/jpeg" | "image/png" | "image/webp";
  base64: string;
  bytes: number;
}

/** Confere o tipo declarado contra os primeiros bytes (não confiar só no mime do cliente). */
function magicMatches(type: ParsedAvatar["type"], b: Buffer): boolean {
  if (type === "image/jpeg")
    return b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff;
  if (type === "image/png")
    return b.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  return (
    b.subarray(0, 4).toString("ascii") === "RIFF" &&
    b.subarray(8, 12).toString("ascii") === "WEBP"
  );
}

export function parseAvatarDataUrl(dataUrl: string): ParsedAvatar {
  const m = DATA_URL.exec(dataUrl);
  if (!m) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Use uma imagem JPEG, PNG ou WebP.",
    });
  }
  const type = m[1] as ParsedAvatar["type"];
  const buf = Buffer.from(m[2], "base64");
  if (buf.length < 100 || !magicMatches(type, buf)) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Arquivo de imagem inválido.",
    });
  }
  if (buf.length > AVATAR_MAX_BYTES) {
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: "Foto muito pesada. Tente uma imagem menor.",
    });
  }
  return { type, base64: m[2], bytes: buf.length };
}

/**
 * Foto de um membro, só se ele for da mesma casa de quem pede (resolvida pelo
 * userId da sessão). `null` = sem foto ou sem permissão — o chamador responde 404 em ambos.
 */
export async function getAvatar(
  userId: string,
  memberId: string,
): Promise<{ type: string; bytes: Buffer } | null> {
  const [row] = await db
    .select({
      data: householdMembers.avatarData,
      type: householdMembers.avatarType,
    })
    .from(householdMembers)
    .where(
      and(
        eq(householdMembers.id, memberId),
        eq(
          householdMembers.householdId,
          sql`(select h.household_id from household_members h where h.user_id = ${userId})`,
        ),
      ),
    );
  if (!row?.data || !row.type) return null;
  return { type: row.type, bytes: Buffer.from(row.data, "base64") };
}
