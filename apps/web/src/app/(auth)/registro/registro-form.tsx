"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { authClient } from "@granola/auth/client";

const schema = z.object({
  name: z.string().trim().min(2, "Escribe tu nombre"),
  email: z.email("Escribe un correo válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

const inputClass = "w-full rounded-md border border-neutral-300 px-3 py-2 text-base";
const buttonClass = "w-full rounded-md bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-50";
const secondaryClass = "w-full rounded-md border border-neutral-300 px-3 py-2 font-medium disabled:opacity-50";

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
    const { error: err } = await authClient.signUp.email({ ...parsed.data, callbackURL: "/app" });
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
    const { error: err } = await authClient.signIn.social({ provider: "google", callbackURL: "/app" });
    if (err) {
      setPending(false);
      setError(err.message ?? "Google no está configurado todavía");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        Nombre
        <input
          className={inputClass}
          type="text"
          name="name"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Correo
        <input
          className={inputClass}
          type="email"
          name="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Contraseña
        <input
          className={inputClass}
          type="password"
          name="password"
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={8}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button type="submit" className={buttonClass} disabled={pending}>
        Crear cuenta
      </button>
      <button type="button" className={secondaryClass} disabled={pending} onClick={onGoogle}>
        Continuar con Google
      </button>
    </form>
  );
}
