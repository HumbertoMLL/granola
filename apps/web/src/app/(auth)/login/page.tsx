import Link from "next/link";
import { Suspense } from "react";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };

// Formulario mínimo funcional; el design system (packages/ui) lo pule después.
export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Entrar a Granola</h1>
      {/* useSearchParams requiere Suspense con cacheComponents */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
      <p className="text-sm">
        ¿Aún no tienes cuenta?{" "}
        <Link href="/registro" className="underline">
          Crear cuenta
        </Link>
      </p>
    </main>
  );
}
