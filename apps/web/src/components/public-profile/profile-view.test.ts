import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProfileView } from "./profile-view";
import { resolveTheme, THEME_PRESETS } from "./theme";
import type { PublicProfile } from "./types";

function profile(preset: (typeof THEME_PRESETS)[number]): PublicProfile {
  return {
    slug: "karla",
    displayName: "Karla",
    bio: "Nutrición",
    avatarUrl: null,
    cedula: "12345678",
    phoneWa: "525511111111",
    theme: resolveTheme({ preset }),
    links: [
      {
        id: "ig",
        label: "Instagram",
        url: "https://instagram.com/karla",
        icon: "instagram",
      },
    ],
    services: [
      {
        id: "service",
        name: "Seguimiento",
        description: null,
        durationMin: 30,
        priceCents: 50000,
        currency: "MXN",
        modality: "online",
        packageSessions: null,
      },
    ],
    reviews: [],
    reviewStats: null,
  };
}

describe("Perfil público y preview", () => {
  for (const preset of THEME_PRESETS) {
    it(`conserva ${preset}, un CTA y servicios antes de enlaces`, () => {
      const html = renderToStaticMarkup(
        createElement(ProfileView, { profile: profile(preset) }),
      );
      expect(html).toContain(`data-preset="${preset}"`);
      expect(html.match(/Agendar consulta/g)).toHaveLength(1);
      expect(html.indexOf("Seguimiento")).toBeLessThan(
        html.indexOf("Instagram"),
      );
      expect(html).toContain("--pp-booking-primary");
      expect(html).toContain('aria-label="Enlaces"');
      expect(html).toContain('class="sr-only">Instagram');
      expect(html).not.toContain("shadow-");
      expect(html).not.toContain("pp-glow)");
    });
  }
  it("el preview no navega ni inventa una disponibilidad", () => {
    const html = renderToStaticMarkup(
      createElement(ProfileView, { profile: profile("avena"), preview: true }),
    );
    expect(html).not.toContain("href=");
    expect(html).toContain("El próximo horario disponible aparecerá aquí.");
  });
  it("normaliza temas legacy al preset visual por defecto", () => {
    expect(resolveTheme({})).toMatchObject({ preset: "avena" });
  });
});
