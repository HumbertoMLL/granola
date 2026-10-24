"use client";

import { useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { z } from "zod";
import { authClient } from "@granola/auth/client";

const schema = z.object({
  email: z.email("Escribe un correo válido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
});

const inputClass = "w-full rounded-md border border-neutral-300 px-3 py-2 text-base";
const buttonClass = "w-full rounded-md bg-neutral-900 px-3 py-2 font-medium text-white disabled:opacity-50";
const secondaryClass = "w-full rounded-md border border-neutral-300 px-3 py-2 font-medium disabled:opacity-50";

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
    const { error: err } = await authClient.signIn.email({ ...parsed.data, callbackURL: next });
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
    setInfo("Te mandamos un link para entrar. Revisa tu correo (en dev sale en la consola del server).");
  }

  async function onGoogle() {
    setError(null);
    setPending(true);
    const { error: err } = await authClient.signIn.social({ provider: "google", callbackURL: next });
    if (err) {
      setPending(false);
      setError(err.message ?? "Google no está configurado todavía");
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
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
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-green-700">{info}</p>}

      <button type="submit" className={buttonClass} disabled={pending}>
        Entrar
      </button>
      <button type="button" className={secondaryClass} disabled={pending} onClick={onMagicLink}>
        Mandarme un link por correo
      </button>
      <button type="button" className={secondaryClass} disabled={pending} onClick={onGoogle}>
        Continuar con Google
      </button>
    </form>
  );
}
