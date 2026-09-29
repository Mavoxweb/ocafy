import { admin } from "@ocafy/api";
import { type NextRequest, NextResponse } from "next/server";
import { ADMIN_BASE } from "./lib/base";

const LOGIN = `${ADMIN_BASE}/login`;

/**
 * Porteiro do painel: tudo sob `ADMIN_BASE`, exceto o login, exige o cookie assinado (emitido
 * depois do segundo fator) — o resto do site (qualquer outro caminho) nem passa por aqui, pra não
 * denunciar que o painel existe. Cada página e ação confere de novo no servidor.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (
    !pathname.startsWith(ADMIN_BASE) ||
    pathname.startsWith(LOGIN) ||
    pathname.startsWith("/api/auth")
  ) {
    return NextResponse.next();
  }
  const session = admin.verifySession(req.cookies.get("ocafy_admin")?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = LOGIN;
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
