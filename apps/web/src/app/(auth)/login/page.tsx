import Link from "next/link";
import { Suspense } from "react";
import { Card, Skeleton } from "@granola/ui";
import { Logo } from "@/components/logo";
import { LoginForm } from "./login-form";

export const metadata = { title: "Entrar" };
export default function LoginPage() {
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
          Entrar a Granola
        </h1>
        <Suspense
          fallback={
            <div className="space-y-4">
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-11 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          }
        >
          <LoginForm />
        </Suspense>
        <p className="text-sm text-muted-foreground">
          ¿Aún no tienes cuenta?{" "}
          <Link
            href="/registro"
            className="font-medium text-primary hover:underline"
          >
            Crear cuenta
          </Link>
        </p>
      </Card>
    </main>
  );
}
