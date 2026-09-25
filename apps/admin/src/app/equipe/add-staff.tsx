"use client";

import { useActionState } from "react";
import { addStaff } from "../actions";

export function AddStaff({
  roles,
}: { roles: { value: string; label: string }[] }) {
  const [state, action, pending] = useActionState(addStaff, null);
  return (
    <div className="box">
      <form action={action} className="inline">
        <label>
          E-mail (já precisa ter conta no Ocafy)
          <input name="email" type="email" required />
        </label>
        <label>
          Papel
          <select name="role" defaultValue="support">
            {roles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
        <label style={{ flex: "1 1 240px" }}>
          Justificativa
          <input name="reason" required minLength={5} />
        </label>
        <button type="submit" className="primary" disabled={pending}>
          {pending ? "Criando…" : "Adicionar"}
        </button>
      </form>
      {state?.error && <div className="flash err">{state.error}</div>}
      {state?.secret && (
        <div className="flash">
          <b>Envie à pessoa agora — não será mostrado de novo.</b>
          <br />
          Segredo do autenticador: <code>{state.secret}</code>
          <br />
          <span className="muted">Ou o endereço para o app autenticador:</span>
          <pre>{state.uri}</pre>
        </div>
      )}
    </div>
  );
}
