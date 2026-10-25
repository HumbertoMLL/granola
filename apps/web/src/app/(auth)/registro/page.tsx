import Link from "next/link";
import { Card } from "@granola/ui";
import { Logo } from "@/components/logo";
import { RegistroForm } from "./registro-form";

export const metadata = { title: "Crear cuenta" };
export default function RegistroPage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[432px] items-center px-4 py-8">
      <Card className="w-full gap-6 p-6 md:p-8">
        <Link
          href="/"
          aria-label="Granola, inicio"
          className="w-fit rounded-md"
        >
          <Logo size={24} />
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">
          Crea tu cuenta en Granola
        </h1>
        <RegistroForm />
        <p className="text-sm text-muted-foreground">
          ¿Ya tienes cuenta?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </Card>
    </main>
  );
}
