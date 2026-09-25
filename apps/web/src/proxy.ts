import { auth } from "@/lib/auth/server";

// Next 16: `proxy.ts` (antigo middleware). Só páginas do app; login, cadastro,
// /api e estáticos ficam de fora para carregarem sem sessão.
export default auth.middleware({ loginUrl: "/entrar" });

export const config = {
  matcher: [
    "/",
    "/onboarding",
    "/rotinas/:path*",
    "/cozinha/:path*",
    "/gatos/:path*",
    "/loja/:path*",
    "/placar/:path*",
    "/escritorio/:path*",
    "/casa/:path*",
    "/compras/:path*",
    "/lembretes/:path*",
    "/plano/:path*",
  ],
};
