import { AuthForm } from "@/components/auth/auth-form";
import { Suspense } from "react";

export const metadata = { title: "Entrar — Ocafy" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="in" />
    </Suspense>
  );
}
