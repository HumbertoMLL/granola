import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "@granola/auth/cookies";

// Next 16 renombró middleware.ts → proxy.ts (ver node_modules/next/dist/docs/.../proxy.md).
// Solo comprueba que exista la cookie de sesión (optimista, sin tocar la DB).
// La validación real la hace requireNutritionist() en cada página del panel.
export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }
  // Los layouts no reciben el pathname: lo pasamos como header del request para el
  // gate de onboarding (lib/onboarding-gate.ts). `set` pisa cualquier valor del cliente.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-granola-pathname", request.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/app", "/app/:path*"],
};
