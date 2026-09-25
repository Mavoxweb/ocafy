import { LegalDocument } from "@/components/legal/legal-document";

export const metadata = { title: "Política de Privacidade — Ocafy" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <LegalDocument id="privacy" />;
}
