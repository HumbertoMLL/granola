import Link from "next/link";
import { RegistroForm } from "./registro-form";

export const metadata = { title: "Crear cuenta" };

// Formulario mínimo funcional; el design system (packages/ui) lo pule después.
export default function RegistroPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-4 py-12">
      <h1 className="text-2xl font-semibold">Crea tu cuenta en Granola</h1>
      <RegistroForm />
      <p className="text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="underline">
          Entrar
        </Link>
      </p>
    </main>
  );
}
