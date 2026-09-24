import { AuthForm } from "@/components/auth/auth-form";
import { Suspense } from "react";

export const metadata = { title: "Criar conta — Ocafy" };

export default function Page() {
  return (
    <Suspense fallback={null}>
      <AuthForm mode="up" />
    </Suspense>
  );
}
