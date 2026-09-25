"use client";

import { useActionState } from "react";
import { submitTotp } from "../../actions";

/** Passo 2: código de 6 dígitos do aplicativo autenticador. */
export default function TwoFactorPage() {
  const [state, action, pending] = useActionState(submitTotp, null);
  return (
    <div className="center">
      <form className="login box" action={action}>
        <div className="brand">
          Segundo fator <small>Código do aplicativo autenticador</small>
        </div>
        <label>
          Código de 6 dígitos
          <input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9 ]{6,7}"
            maxLength={7}
            required
          />
        </label>
        {state?.error && <div className="flash err">{state.error}</div>}
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Verificando…" : "Entrar no painel"}
        </button>
      </form>
    </div>
  );
}
