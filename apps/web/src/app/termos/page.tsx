import { LegalDocument } from "@/components/legal/legal-document";

export const metadata = { title: "Termos de Uso — Ocafy" };
// Lê os dados da empresa do ambiente em tempo de execução (sem precisar de novo build).
export const dynamic = "force-dynamic";

export default function Page() {
  return <LegalDocument id="terms" />;
}
