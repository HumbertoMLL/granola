"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@granola/auth/client";
import { Button, FormField, Input } from "@granola/ui";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre"),
  email: z.email("Escribe un correo válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export function RegistroForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = schema.safeParse({ name, email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setPending(true);
    const { error: err } = await authClient.signUp.email({
      ...parsed.data,
      callbackURL: "/app",
    });
    setPending(false);
    if (err) {
      setError(err.message ?? "No pudimos crear la cuenta");
      return;
    }
    router.push("/app");
  }

  async function onGoogle() {
    setError(null);
    setPending(true);
    const { error: err } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/app",
    });
    if (err) {
      setPending(false);
      setError(err.message ?? "Google no está configurado todavía");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <FormField label="Nombre">
        <Input
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Correo">
        <Input
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </FormField>
      <FormField label="Contraseña" hint="Mínimo 8 caracteres">
        <Input
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </FormField>
      {error ? (
        <p role="alert" className="text-sm text-destructive-ink">
          {error}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full">
        Crear cuenta
      </Button>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onGoogle}
        >
          Continuar con Google
        </Button>
      </div>
    </form>
  );
}
