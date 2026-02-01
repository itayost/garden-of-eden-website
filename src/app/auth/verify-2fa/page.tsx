"use client";

/**
 * verify-2fa page - 2FA verification during login flow
 *
 * Shown when a user with MFA enabled completes first-factor auth (OTP)
 * but needs to complete second-factor (TOTP) before accessing dashboard.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectUrl } from "@/lib/utils/redirect";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import { TwoFactorVerify } from "@/components/auth/TwoFactorVerify";

export default function Verify2FAPage() {
  const [isChecking, setIsChecking] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const supabase = createClient();

      // Check if user has session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        // No session - redirect to login
        router.push("/auth/login");
        return;
      }

      // Check AAL level
      const { data: aalData } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

      if (!aalData) {
        // Error getting AAL - redirect to dashboard (fail-open for availability)
        router.push("/dashboard");
        return;
      }

      // If already aal2 - no need for 2FA, redirect to dashboard
      if (aalData.currentLevel === "aal2") {
        const redirect = getSafeRedirectUrl(sessionStorage.getItem("redirectAfterAuth"));
        router.push(redirect);
        return;
      }

      // If no MFA enrolled (nextLevel is aal1), redirect to dashboard
      if (aalData.nextLevel !== "aal2") {
        const redirect = getSafeRedirectUrl(sessionStorage.getItem("redirectAfterAuth"));
        router.push(redirect);
        return;
      }

      // User needs 2FA verification - show the form
      setIsChecking(false);
    };

    checkSession();
  }, [router]);

  const handleSuccess = () => {
    const redirect = getSafeRedirectUrl(sessionStorage.getItem("redirectAfterAuth"));
    sessionStorage.removeItem("redirectAfterAuth");
    // Hard redirect to ensure cookies are sent to server
    window.location.href = redirect;
  };

  const handleCancel = () => {
    // Sign out and redirect to login
    const signOut = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push("/auth/login");
    };
    signOut();
  };

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A1F0A] to-[#142814] p-4">
        <Card className="w-full max-w-md border-[#22C55E]/20">
          <CardHeader className="text-center">
            <Link href="/" className="font-display text-3xl text-[#22C55E] mb-4 block tracking-wider">
              GARDEN OF EDEN
            </Link>
          </CardHeader>
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-muted-foreground">טוען...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A1F0A] to-[#142814] p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="font-display text-3xl text-[#22C55E] block tracking-wider">
            GARDEN OF EDEN
          </Link>
        </div>
        <TwoFactorVerify onSuccess={handleSuccess} onCancel={handleCancel} />
      </div>
    </div>
  );
}
