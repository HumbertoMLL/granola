import { z } from "zod";
import { linkSchema, nameSchema, renderEmail } from "./shared";

export function bienvenida(input: { name: string; appUrl: string }) {
  const d = z.object({ name: nameSchema, appUrl: linkSchema }).parse(input);
  return renderEmail("Te damos la bienvenida a Granola", [
    `Hola, ${d.name}.`,
    "Tu cuenta está lista. Configura tu perfil y disponibilidad para empezar a recibir citas.",
  ], { label: "Ir a mi panel", url: d.appUrl });
}
