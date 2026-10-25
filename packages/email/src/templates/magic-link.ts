import { z } from "zod";
import { linkSchema, renderEmail } from "./shared";

export function magicLink(input: { url: string }) {
  const { url } = z.object({ url: linkSchema }).parse(input);
  return renderEmail("Tu enlace para entrar a Granola", [
    "Usa este enlace para entrar a tu cuenta. Es válido durante 15 minutos y solo se puede usar una vez.",
    "Si no solicitaste este correo, puedes ignorarlo.",
  ], { label: "Entrar a Granola", url });
}
