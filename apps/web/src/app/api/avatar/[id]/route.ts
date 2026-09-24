import { auth } from "@/lib/auth/server";
import { getAvatar } from "@ocafy/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Foto de perfil de um membro da MESMA casa de quem pede (sessão obrigatória). */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  if (!UUID.test(id)) return new Response(null, { status: 404 });

  const { data } = await auth.getSession();
  if (!data?.user) return new Response(null, { status: 401 });

  const avatar = await getAvatar(data.user.id, id);
  if (!avatar) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(avatar.bytes), {
    headers: {
      "content-type": avatar.type,
      // A URL leva ?v=<versão>: trocar a foto muda a URL, então o cache pode ser longo.
      "cache-control": "private, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; sandbox",
      "x-content-type-options": "nosniff",
    },
  });
}
