"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectUrl } from "@/lib/utils/redirect";
import { getOtpErrorMessage } from "@/lib/auth/otp-error-messages";
import { formatPhoneToLocal } from "@/lib/validations/common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";

const OTP_LENGTH = 6;

export default function VerifyPage() {
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [isReady, setIsReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [phone, setPhone] = useState("");
  const [countdown, setCountdown] = useState(60);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  useEffect(() => {
    const storedPhone = sessionStorage.getItem("verifyPhone");

    if (!storedPhone) {
      router.push("/auth/login");
      return;
    }

    setPhone(storedPhone);
    setIsReady(true);
    setTimeout(() => inputRefs.current[0]?.focus(), 0);
  }, [router]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleChange = (index: number, value: string) => {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, "").slice(0, OTP_LENGTH);
      const newOtp = [...otp];
      digits.split("").forEach((digit, i) => {
        if (index + i < OTP_LENGTH) {
          newOtp[index + i] = digit;
        }
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, OTP_LENGTH - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Move to next input
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const code = otp.join("");
    if (code.length !== OTP_LENGTH) {
      setError(`נא להזין קוד בן ${OTP_LENGTH} ספרות`);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.verifyOtp({
        phone,
        token: code,
        type: "sms",
      });

      if (error) {
        throw error;
      }

      const redirect = getSafeRedirectUrl(sessionStorage.getItem("redirectAfterAuth"));
      sessionStorage.removeItem("verifyPhone");
      sessionStorage.removeItem("redirectAfterAuth");

      toast.success("התחברת בהצלחה!");
      // Use hard redirect to ensure session cookies are sent to server
      window.location.href = redirect;
    } catch (error: unknown) {
      console.error("Verify error:", error);
      setError(getOtpErrorMessage(error, "קוד האימות שגוי"));
      setOtp(Array(OTP_LENGTH).fill(""));
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0) return;

    setResending(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        phone,
        options: { shouldCreateUser: false },
      });

      if (error) throw error;

      setCountdown(60);
      setError(null);
      toast.success("קוד חדש נשלח");
    } catch (error: unknown) {
      console.error("Resend error:", error);
      toast.error(getOtpErrorMessage(error, "שגיאה בשליחת קוד חדש"));
    } finally {
      setResending(false);
    }
  };

  return (
    <main id="main-content" tabIndex={-1} className="outline-none min-h-dvh flex items-center justify-center bg-gradient-to-br from-[#0A1F0A] to-[#142814] p-4">
      <Card className="w-full max-w-md border-[#22C55E]/20">
        <CardHeader className="text-center">
          <Link href="/" className="font-display text-3xl text-primary mb-4 block tracking-wider">
            GARDEN OF EDEN
          </Link>
          <CardTitle className="text-2xl">
            <h1 id="otp-title">אימות קוד</h1>
          </CardTitle>
          <CardDescription id="otp-description">
            {`הזינו את הקוד שנשלח ב-WhatsApp למספר ${formatPhoneToLocal(phone)}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!isReady ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
              <span className="sr-only">טוען...</span>
            </div>
          ) : (
            <>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div
                  role="group"
                  aria-labelledby="otp-title"
                  aria-describedby={error ? "otp-description otp-error" : "otp-description"}
                  className="flex justify-center gap-1 sm:gap-2"
                  dir="ltr"
                >
                  {Array.from({ length: OTP_LENGTH }, (_, index) => (
                    <Input
                      key={index}
                      ref={(el) => { inputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      autoComplete={index === 0 ? "one-time-code" : "off"}
                      aria-label={`ספרה ${index + 1} מתוך ${OTP_LENGTH}`}
                      aria-invalid={error !== null}
                      maxLength={OTP_LENGTH}
                      value={otp[index] || ""}
                      onChange={(e) => handleChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className="w-8 sm:w-10 h-11 sm:h-12 text-center text-lg sm:text-xl font-bold px-0"
                      disabled={loading}
                    />
                  ))}
                </div>

                {error && (
                  <p id="otp-error" role="alert" className="text-center text-sm font-medium text-destructive">
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" size="lg" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
                      מאמת...
                    </>
                  ) : (
                    <>
                      אימות והתחברות
                      <ArrowLeft className="h-5 w-5" aria-hidden="true" />
                    </>
                  )}
                </Button>
              </form>

              <div className="mt-6 text-center space-y-4">
                <Button
                  variant="ghost"
                  onClick={handleResend}
                  disabled={countdown > 0 || resending}
                  className="text-muted-foreground"
                >
                  {resending ? (
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                  ) : (
                    <RefreshCw className="h-4 w-4" aria-hidden="true" />
                  )}
                  {countdown > 0 ? `שליחה מחדש בעוד ${countdown} שניות` : "שלח קוד מחדש"}
                </Button>

                <div>
                  <Link
                    href="/auth/login"
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    שינוי מספר טלפון
                  </Link>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
