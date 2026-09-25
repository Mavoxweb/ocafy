import {
  LEGAL_DOCS,
  type LegalDocId,
  controllerFromEnv,
  fillLegal,
  missingControllerFields,
} from "@ocafy/core";
import Link from "next/link";

/** Página pública de um documento legal (renderizada no servidor, com os dados da empresa do ambiente). */
export function LegalDocument({ id }: { id: LegalDocId }) {
  const doc = LEGAL_DOCS[id];
  const c = controllerFromEnv(process.env);
  const missing = missingControllerFields(c);
  const f = (s: string) => fillLegal(s, c);
  const other = id === "terms" ? "privacidade" : "termos";
  const otherName =
    id === "terms" ? "Política de Privacidade" : "Termos de Uso";

  return (
    <main className="legal mx-auto max-w-[720px] px-4 py-8">
      <p className="meta">
        <Link href="/" className="link" style={{ padding: 0 }}>
          ← Voltar ao Ocafy
        </Link>
      </p>
      <h1 className="text-[1.6rem]">{doc.title}</h1>
      {missing.length > 0 && (
        <p className="panel meta" role="note">
          Atenção: alguns dados da empresa ainda não foram informados neste
          ambiente e aparecem como “[a preencher]”.
        </p>
      )}
      <p>{f(doc.intro)}</p>
      {doc.sections.map((s) => (
        <section key={s.id} id={s.id}>
          <h2>{s.title}</h2>
          {s.paragraphs?.map((p) => (
            <p key={p}>{f(p)}</p>
          ))}
          {s.items && (
            <ul>
              {s.items.map((i) => (
                <li key={i}>{f(i)}</li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <p className="meta">
        Veja também:{" "}
        <Link href={`/${other}`} className="link" style={{ padding: 0 }}>
          {otherName}
        </Link>
        .
      </p>
    </main>
  );
}
