"use client";

import { authClient } from "@/lib/auth-client";
import { ADMIN_BASE } from "@/lib/base";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";

/** Passo 1: e-mail e senha (Neon Auth). O passo 2 (código do autenticador) libera o painel. */
export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    try {
      const { error: err } = await authClient.signIn.email({
        email: String(f.get("email") ?? "").trim(),
        password: String(f.get("password") ?? ""),
      });
      if (err) {
        setError("E-mail ou senha incorretos.");
        return;
      }
      router.replace(`${ADMIN_BASE}/login/2fa`);
    } catch {
      setError("Não foi possível entrar. Tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center">
      <form className="login box" onSubmit={onSubmit}>
        <div className="brand">
          ocafy <small>Painel administrativo</small>
        </div>
        <label>
          E-mail
          <input name="email" type="email" autoComplete="username" required />
        </label>
        <label>
          Senha
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error && <div className="flash err">{error}</div>}
        <button type="submit" className="primary" disabled={busy}>
          {busy ? "Entrando…" : "Continuar"}
        </button>
      </form>
    </div>
  );
}
