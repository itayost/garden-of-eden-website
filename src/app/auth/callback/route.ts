import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { getSafeRedirectUrl } from "@/lib/utils/redirect";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = getSafeRedirectUrl(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Check if user needs MFA verification
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      // If user has MFA enabled but hasn't verified this session, redirect to 2FA page
      if (aalData?.nextLevel === "aal2" && aalData?.currentLevel !== aalData.nextLevel) {
        // Store the intended redirect for after 2FA verification
        // Note: This is handled via sessionStorage on client side for the verify-2fa page
        return NextResponse.redirect(`${origin}/auth/verify-2fa`);
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Return the user to an error page with instructions
  return NextResponse.redirect(`${origin}/auth/login?error=auth_error`);
}
