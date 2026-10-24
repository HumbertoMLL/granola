import type { Metadata, Viewport } from "next";
import { Instrument_Serif, Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "@granola/ui";

import "./globals.css";

const sans = Plus_Jakarta_Sans({
  variable: "--font-sans-var",
  subsets: ["latin", "latin-ext"],
  display: "swap",
});

const display = Instrument_Serif({
  variable: "--font-display-var",
  subsets: ["latin", "latin-ext"],
  weight: "400",
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Granola — La app que tus pacientes sí usan",
    template: "%s · Granola",
  },
  description:
    "Página pública, agenda con reservas, cobros sin comisión y WhatsApp automático para nutriólogas que atienden online. Prueba 14 días sin tarjeta.",
  applicationName: "Granola",
  keywords: ["nutriólogo", "nutrióloga", "agenda", "consulta online", "WhatsApp", "SPEI", "OXXO"],
  openGraph: {
    type: "website",
    locale: "es_MX",
    siteName: "Granola",
    title: "Granola — La app que tus pacientes sí usan",
    description:
      "La agenda que te llena la consulta: página pública, reservas, cobros 0% comisión y WhatsApp.",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className={`${sans.variable} ${display.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
