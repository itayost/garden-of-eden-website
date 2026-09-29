import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isPaymentPagePath, paymentPageCsp } from "@/lib/security/payment-csp";

export async function middleware(request: NextRequest) {
  if (!isPaymentPagePath(request.nextUrl.pathname)) return await updateSession(request);

  // The card page gets an enforced, per-request nonce policy. Next reads the
  // nonce from the request's CSP header and stamps it on its own scripts.
  const nonce = btoa(crypto.randomUUID());
  const csp = paymentPageCsp(nonce, { dev: process.env.NODE_ENV === "development" });
  request.headers.set("x-nonce", nonce);
  request.headers.set("Content-Security-Policy", csp);
  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
