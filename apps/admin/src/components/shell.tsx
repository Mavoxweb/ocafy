import { logout } from "@/app/actions";
import type { CurrentStaff } from "@/lib/staff";
import { admin } from "@ocafy/api";
import Link from "next/link";
import type { ReactNode } from "react";

const NAV: { href: string; label: string; perm?: admin.Permission }[] = [
  { href: "/", label: "Visão geral" },
  { href: "/casas", label: "Casas" },
  { href: "/assinaturas", label: "Assinaturas" },
  { href: "/lgpd", label: "LGPD" },
  { href: "/flags", label: "Chaves" },
  { href: "/saude", label: "Saúde" },
  { href: "/auditoria", label: "Auditoria" },
  { href: "/equipe", label: "Equipe", perm: "staff.manage" },
];

export function Shell({
  me,
  children,
}: { me: CurrentStaff; children: ReactNode }) {
  return (
    <div className="shell">
      <nav className="side">
        <div className="brand">
          ocafy <small>Painel administrativo</small>
        </div>
        {NAV.filter((n) => !n.perm || admin.can(me.role, n.perm)).map((n) => (
          <Link key={n.href} href={n.href}>
            {n.label}
          </Link>
        ))}
        <div className="me">
          {me.email}
          <br />
          {admin.ROLE_LABELS[me.role]}
          <form action={logout}>
            <button type="submit" style={{ marginTop: 8 }}>
              Sair
            </button>
          </form>
        </div>
      </nav>
      <main>{children}</main>
    </div>
  );
}

export function Flash({
  ok,
  err,
}: { ok?: string | string[]; err?: string | string[] }) {
  const one = (v?: string | string[]) => (Array.isArray(v) ? v[0] : v);
  return (
    <>
      {one(ok) && <div className="flash">{one(ok)}</div>}
      {one(err) && <div className="flash err">{one(err)}</div>}
    </>
  );
}

export const fmtDate = (d: Date | string | null | undefined) =>
  d
    ? new Date(d).toLocaleString("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: "America/Sao_Paulo",
      })
    : "—";

export const brl = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

/** Campo de justificativa obrigatório usado em todo formulário de ação. */
export function Reason({
  placeholder = "Justificativa (fica no registro de auditoria)",
}: { placeholder?: string }) {
  return (
    <label style={{ flex: "1 1 240px" }}>
      Justificativa
      <input name="reason" required minLength={5} placeholder={placeholder} />
    </label>
  );
}
