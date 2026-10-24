import { Globe, Instagram, Link2, MessageCircle, Youtube } from "lucide-react";

import type { LinkIcon as LinkIconKind } from "./theme";

type Props = { kind: LinkIconKind; className?: string };

/** lucide no trae TikTok (quitó las marcas); lo dibujamos a mano. */
function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M16.6 5.82a4.28 4.28 0 0 1-1.05-2.82h-3.1v12.4a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12V9.75a5.7 5.7 0 1 0 4.92 5.65V9.04a7.33 7.33 0 0 0 4.3 1.38V7.33a4.3 4.3 0 0 1-3.25-1.51Z" />
    </svg>
  );
}

export function LinkIcon({ kind, className = "size-5" }: Props) {
  switch (kind) {
    case "instagram":
      return <Instagram className={className} aria-hidden />;
    case "tiktok":
      return <TikTokIcon className={className} />;
    case "youtube":
      return <Youtube className={className} aria-hidden />;
    case "whatsapp":
      return <MessageCircle className={className} aria-hidden />;
    case "web":
      return <Globe className={className} aria-hidden />;
    default:
      return <Link2 className={className} aria-hidden />;
  }
}
