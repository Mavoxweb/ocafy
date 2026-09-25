import { admin } from "@ocafy/api";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Porteiro do painel: tudo, exceto o login e a rota de autenticação, exige o cookie assinado
 * (emitido depois do segundo fator). Cada página e ação confere de novo no servidor.
 */
export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (pathname.startsWith("/login") || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }
  const session = admin.verifySession(req.cookies.get("ocafy_admin")?.value);
  if (!session) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
