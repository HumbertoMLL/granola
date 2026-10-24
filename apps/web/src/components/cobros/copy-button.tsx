"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

import { Button } from "@granola/ui";

export function CopyButton({ value, label = "Copiar" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Sin clipboard (http sin https, iOS viejo): el usuario selecciona a mano.
    }
  }

  return (
    <Button type="button" size="sm" variant="outline" onClick={copy} aria-live="polite">
      {copied ? <Check /> : <Copy />} {copied ? "Copiado" : label}
    </Button>
  );
}
