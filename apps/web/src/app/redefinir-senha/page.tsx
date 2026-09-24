"use client";

import { OcafySymbol } from "@/components/ui/logo";
import { Field } from "@/components/ui/primitives";
import { authClient } from "@/lib/auth/client";
import { isNetworkError } from "@/lib/auth/errors";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { type FormEvent, Suspense, useState } from "react";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPassword />
    </Suspense>
  );
}

function ResetPassword() {
  const params = useSearchParams();
  const token = params.get("token");
  // O Neon Auth redireciona com ?error=INVALID_TOKEN quando o link expirou/já foi usado.
  const invalid = !token || !!params.get("error");
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password") ?? "");
    if (password.length < 8) {
      setError("A senha precisa de pelo menos 8 caracteres.");
      return;
    }
    if (password !== String(f.get("confirm") ?? "")) {
      setError("As senhas não são iguais.");
      return;
    }
    setLoading(true);
    try {
      const { error: err } = await authClient.resetPassword({
        newPassword: password,
        token: token ?? "",
      });
      if (err) {
        setError("Este link expirou ou já foi usado. Peça um novo.");
        return;
      }
      setDone(true);
    } catch (e) {
      setError(
        isNetworkError(e)
          ? "Sem conexão. Confira a internet e tente de novo."
          : "Este link expirou ou já foi usado. Peça um novo.",
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
        <h1 className="text-[1.5rem]">Nova senha</h1>
        {done ? (
          <>
            <p className="meta">
              Senha alterada. Agora é só entrar com a nova senha.
            </p>
            <Link
              href="/entrar"
              className="btn btn-primary btn-block"
              style={{ textDecoration: "none" }}
            >
              Entrar
            </Link>
          </>
        ) : invalid ? (
          <>
            <p className="meta">
              Este link é inválido, expirou ou já foi usado.
            </p>
            <Link
              href="/esqueci-senha"
              className="btn btn-primary btn-block"
              style={{ textDecoration: "none" }}
            >
              Pedir um novo link
            </Link>
          </>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="mt-3 grid gap-3">
              <Field label="Nova senha">
                <input
                  name="password"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                />
              </Field>
              <Field label="Repita a nova senha">
                <input
                  name="confirm"
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
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
              {loading ? "Salvando…" : "Salvar nova senha"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
