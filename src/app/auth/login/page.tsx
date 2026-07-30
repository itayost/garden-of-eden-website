"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectUrl } from "@/lib/utils/redirect";
import { normalizePhone } from "@/lib/arbox/normalize-phone";
import { getOtpErrorMessage } from "@/lib/auth/otp-error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Phone, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirectUrl(searchParams.get("redirect"));

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const e164Phone = normalizePhone(phone);

    if (!e164Phone) {
      toast.error("נא להזין מספר נייד ישראלי תקין (למשל 0501234567)");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        phone: e164Phone,
        options: { shouldCreateUser: false },
      });

      if (error) {
        throw error;
      }

      sessionStorage.setItem("verifyPhone", e164Phone);
      sessionStorage.setItem("redirectAfterAuth", redirect);

      toast.success("קוד אימות נשלח ב-WhatsApp");
      router.push("/auth/verify");
    } catch (error: unknown) {
      console.error("Login error:", error);
      toast.error(getOtpErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handlePhoneSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="phone">מספר טלפון</Label>
        <div className="relative">
          <Phone className="absolute end-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            id="phone"
            type="tel"
            placeholder="050-123-4567"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="pe-10 text-lg text-start"
            dir="ltr"
            disabled={loading}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          נשלח לכם קוד אימות ב-WhatsApp
        </p>
      </div>

      <Button type="submit" className="w-full" size="lg" disabled={loading}>
        {loading ? (
          <>
            <Loader2 className="ml-2 h-5 w-5 animate-spin" />
            שולח...
          </>
        ) : (
          <>
            <ArrowRight className="ml-2 h-5 w-5" />
            שלח קוד אימות
          </>
        )}
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A1F0A] to-[#142814] p-4">
      <Card className="w-full max-w-md border-[#22C55E]/20">
        <CardHeader className="text-center">
          <Link href="/" className="font-display text-3xl text-[#22C55E] mb-4 block tracking-wider">
            GARDEN OF EDEN
          </Link>
          <CardTitle className="text-2xl">התחברות</CardTitle>
          <CardDescription>
            הזינו את מספר הטלפון שלכם כדי להתחבר
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-8 text-center">טוען...</div>}>
            <LoginForm />
          </Suspense>

          <div className="mt-4 text-center">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              חזרה לדף הבית
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
