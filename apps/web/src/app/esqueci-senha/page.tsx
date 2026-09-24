"use client";

import { OcafySymbol } from "@/components/ui/logo";
import { Field } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth/client";
import { isNetworkError } from "@/lib/auth/errors";
import Link from "next/link";
import { type FormEvent, useState } from "react";

/**
 * Pede o e-mail de redefinição. Quem envia é o Neon Auth (SMTP configurado com o
 * Resend — ver README). A resposta é sempre neutra: não revelamos se o e-mail existe.
 */
export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const email = String(
      new FormData(e.currentTarget).get("email") ?? "",
    ).trim();
    try {
      const { error: err } = await authClient.requestPasswordReset({
        email,
        redirectTo: `${window.location.origin}/redefinir-senha`,
      });
      // Falha de servidor/SMTP aparece como erro; "e-mail não encontrado" continua neutro.
      if (err && (err.status ?? 500) >= 500) {
        setError(
          "Não foi possível enviar o e-mail agora. Tente de novo em instantes.",
        );
        return;
      }
      setSent(true);
    } catch (e) {
      setError(
        isNetworkError(e)
          ? "Sem conexão. Confira a internet e tente de novo."
          : "Não foi possível enviar o e-mail agora. Confira o endereço e tente de novo.",
      );
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
      </div>
      <div className="panel glass" style={{ padding: 20, borderRadius: 28 }}>
        <h1 className="text-[1.5rem]">Esqueci minha senha</h1>
        {sent ? (
          <>
            <p className="meta">
              Se existir uma conta com esse e-mail, enviamos um link para criar
              uma nova senha. Confira também a caixa de spam.
            </p>
            <Link
              href="/entrar"
              className="btn btn-primary btn-block"
              style={{ textDecoration: "none" }}
            >
              Voltar para entrar
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <p className="meta">
              Digite o e-mail da sua conta e enviaremos um link para redefinir a
              senha.
            </p>
            <div className="mt-3">
              <Field label="E-mail">
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                />
              </Field>
            </div>
            {error && (
              <p
                role="alert"
                className="mt-3 text-[0.9rem] font-bold text-late-t"
              >
                {error}
              </p>
            )}
            <button
              type="submit"
              className="btn btn-primary btn-block"
              disabled={loading}
            >
              {loading ? "Enviando…" : "Enviar link"}
            </button>
            <p className="meta text-center">
              <Link href="/entrar" className="link" style={{ padding: 0 }}>
                Voltar para entrar
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
}
