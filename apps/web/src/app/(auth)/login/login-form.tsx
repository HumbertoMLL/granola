"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { authClient } from "@granola/auth/client";
import { Button, FormField, Input } from "@granola/ui";

const schema = z.object({
  email: z.email("Escribe un correo válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Datos inválidos");
      return;
    }
    setPending(true);
    const { error: err } = await authClient.signIn.email({
      ...parsed.data,
      callbackURL: next,
    });
    setPending(false);
    if (err) {
      setError(err.message ?? "No pudimos iniciar sesión");
      return;
    }
    router.push(next);
  }

  async function onMagicLink() {
    setError(null);
    setInfo(null);
    const parsedEmail = z.email().safeParse(email);
    if (!parsedEmail.success) {
      setError("Escribe tu correo para mandarte el link");
      return;
    }
    setPending(true);
    const { error: err } = await authClient.signIn.magicLink({
      email: parsedEmail.data,
      callbackURL: next,
    });
    setPending(false);
    if (err) {
      setError(err.message ?? "No pudimos mandar el link");
      return;
    }
    setInfo("Revisa tu correo. Te mandamos un enlace para entrar.");
  }

  async function onGoogle() {
    setError(null);
    setPending(true);
    const { error: err } = await authClient.signIn.social({
      provider: "google",
      callbackURL: next,
    });
    if (err) {
      setPending(false);
      setError(err.message ?? "Google no está configurado todavía");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
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
      <FormField label="Contraseña">
        <Input
          type="password"
          name="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </FormField>
      {error ? (
        <p role="alert" className="text-sm text-destructive-ink">
          {error}
        </p>
      ) : null}
      {info ? (
        <p role="status" className="text-sm text-status-confirmed-foreground">
          {info}
        </p>
      ) : null}
      <Button type="submit" loading={pending} className="w-full">
        Entrar
      </Button>
      <div className="flex flex-col gap-2 border-t border-border pt-4">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={onMagicLink}
        >
          Mandarme un link por correo
        </Button>
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
