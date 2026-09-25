"use client";

import Link from "next/link";

/**
 * Caixa de aceite dos Termos de Uso. Nunca vem marcada (o aceite precisa ser um ato da pessoa) e os
 * documentos abrem em outra aba, para não perder o que já foi preenchido.
 */
export function LegalCheck({
  checked,
  onChange,
}: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="legal-check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>
        Li e aceito os{" "}
        <Link href="/termos" target="_blank" rel="noopener" className="link">
          Termos de Uso
        </Link>{" "}
        e declaro ter lido a{" "}
        <Link
          href="/privacidade"
          target="_blank"
          rel="noopener"
          className="link"
        >
          Política de Privacidade
        </Link>
        .
      </span>
    </label>
  );
}
