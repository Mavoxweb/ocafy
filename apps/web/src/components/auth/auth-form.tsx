"use client";

import { OcafySymbol } from "@/components/ui/logo";
import { Field } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth/client";
import { refresh, resetSync } from "@/lib/sync";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { type FormEvent, useState } from "react";

function friendly(message: string | undefined, mode: "in" | "up"): string {
  const m = (message ?? "").toLowerCase();
  if (/invalid (email|password)|credentials/.test(m))
    return "E-mail ou senha incorretos.";
  if (/exist|already/.test(m))
    return "Já existe uma conta com este e-mail. Tente entrar.";
  if (/too short|at least|minimum|length/.test(m))
    return "A senha precisa de pelo menos 8 caracteres.";
  if (/too many|rate/.test(m))
    return "Muitas tentativas. Aguarde um instante e tente de novo.";
  if (/network|fetch|failed to/.test(m))
    return "Sem conexão. Confira a internet e tente de novo.";
  return mode === "in"
    ? "Não foi possível entrar. Tente de novo."
    : "Não foi possível criar a conta. Tente de novo.";
}

export function AuthForm({ mode }: { mode: "in" | "up" }) {
  const router = useRouter();
  const params = useSearchParams();
  const convite =
    params
      .get("convite")
      ?.toUpperCase()
      .replace(/[^A-Z0-9]/g, "") ?? "";
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const other = mode === "in" ? "/cadastro" : "/entrar";
  const otherHref = convite ? `${other}?convite=${convite}` : other;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email") ?? "").trim();
    const password = String(f.get("password") ?? "");
    try {
      const { error: err } =
        mode === "in"
          ? await authClient.signIn.email({ email, password })
          : await authClient.signUp.email({
              email,
              password,
              name: String(f.get("name") ?? "").trim(),
            });
      if (err) {
        setError(friendly(err.message, mode));
        return;
      }
      resetSync();
      await refresh({ force: true });
      router.replace(convite ? `/onboarding?convite=${convite}` : "/");
    } catch (ex) {
      setError(friendly(ex instanceof Error ? ex.message : undefined, mode));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-[440px] flex-col justify-center px-4 py-8">
      <div className="mb-6 flex flex-col items-center text-center">
        <OcafySymbol size={72} />
        <div className="owm mt-2.5" style={{ fontSize: 38 }}>
          ocafy
        </div>
        <p className="meta mb-0 mt-2">Deixa a casa ok.</p>
      </div>

      <form
        className="panel glass"
        style={{ padding: 20, borderRadius: 28 }}
        onSubmit={onSubmit}
      >
        <h1 className="text-[1.5rem]">
          {mode === "in" ? "Entrar" : "Criar conta"}
        </h1>
        {convite && (
          <p className="meta">
            Você foi convidado(a) para uma casa.{" "}
            {mode === "in" ? "Entre" : "Crie a conta"} e o código{" "}
            <b>{convite}</b> será usado.
          </p>
        )}
        <div className="mt-3 grid gap-3">
          {mode === "up" && (
            <Field label="Seu nome">
              <input
                name="name"
                type="text"
                required
                minLength={2}
                maxLength={24}
                autoComplete="given-name"
              />
            </Field>
          )}
          <Field label="E-mail">
            <input name="email" type="email" required autoComplete="email" />
          </Field>
          <Field label="Senha">
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete={mode === "in" ? "current-password" : "new-password"}
              className="pw"
            />
          </Field>
          {mode === "in" && (
            <div className="-mt-1 text-right">
              <Link
                href="/esqueci-senha"
                className="link"
                style={{ padding: 0, fontSize: "0.85rem" }}
              >
                Esqueci minha senha
              </Link>
            </div>
          )}
        </div>
        {error && (
          <p role="alert" className="mt-3 text-[0.9rem] font-bold text-late-t">
            {error}
          </p>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={loading}
        >
          {loading ? "Aguarde…" : mode === "in" ? "Entrar" : "Criar conta"}
        </button>
        <p className="meta text-center">
          {mode === "in" ? "Ainda não tem conta? " : "Já tem conta? "}
          <Link href={otherHref} className="link" style={{ padding: 0 }}>
            {mode === "in" ? "Criar conta" : "Entrar"}
          </Link>
        </p>
        <p className="meta text-center" style={{ fontSize: "0.78rem" }}>
          <Link href="/termos" className="link" style={{ padding: 0 }}>
            Termos de Uso
          </Link>{" "}
          ·{" "}
          <Link href="/privacidade" className="link" style={{ padding: 0 }}>
            Política de Privacidade
          </Link>
        </p>
      </form>
    </main>
  );
}
