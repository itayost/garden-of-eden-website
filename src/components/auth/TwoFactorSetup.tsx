"use client";

/**
 * TwoFactorSetup - 2FA enrollment component
 *
 * Multi-step flow for setting up TOTP-based two-factor authentication:
 * 1. Intro: Explain 2FA benefits
 * 2. QR: Display QR code for scanning with authenticator app
 * 3. Verify: Enter 6-digit code to confirm enrollment
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, QrCode, Loader2, CheckCircle2, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { enrollMFA, verifyMFA } from "@/lib/auth/mfa";

interface TwoFactorSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

type Step = "intro" | "qr" | "verify";

export function TwoFactorSetup({ onSuccess, onCancel }: TwoFactorSetupProps) {
  const [step, setStep] = useState<Step>("intro");
  const [loading, setLoading] = useState(false);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleStartSetup = async () => {
    setLoading(true);
    setError(null);

    const result = await enrollMFA();

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    setFactorId(result.factorId);
    setQrCode(result.qrCode);
    setSecret(result.secret);
    setStep("qr");
    setLoading(false);
  };

  const handleVerify = async () => {
    if (!factorId) {
      setError("Missing factor ID");
      return;
    }

    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setError("נא להזין קוד בן 6 ספרות");
      return;
    }

    setLoading(true);
    setError(null);

    const result = await verifyMFA(factorId, code);

    if ("error" in result) {
      setError(result.error);
      setLoading(false);
      return;
    }

    toast.success("אימות דו-שלבי הופעל בהצלחה");
    onSuccess();
  };

  const handleCopySecret = async () => {
    if (secret) {
      await navigator.clipboard.writeText(secret);
      setCopied(true);
      toast.success("הקוד הועתק");
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
  };

  // Intro Step
  if (step === "intro") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <ShieldCheck className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">אימות דו-שלבי</CardTitle>
          <CardDescription>
            הוסיפו שכבת אבטחה נוספת לחשבון שלכם
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              אימות דו-שלבי מגן על החשבון שלכם גם אם הסיסמה נחשפת.
            </p>
            <p>
              לאחר ההפעלה, תצטרכו להזין קוד מאפליקציית האימות בכל התחברות.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Button onClick={handleStartSetup} disabled={loading} className="w-full">
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מכין...
                </>
              ) : (
                "התחל הגדרה"
              )}
            </Button>
            <Button variant="ghost" onClick={onCancel} disabled={loading}>
              ביטול
            </Button>
          </div>
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </CardContent>
      </Card>
    );
  }

  // QR Code Step
  if (step === "qr") {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <QrCode className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">סרקו את קוד ה-QR</CardTitle>
          <CardDescription>
            סרקו עם אפליקציית האימות שלכם (Google Authenticator, Authy וכו&apos;)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* QR Code Display */}
          {qrCode && (
            <div
              className="mx-auto bg-white p-4 rounded-lg w-fit"
              dangerouslySetInnerHTML={{ __html: qrCode }}
            />
          )}

          {/* Manual Entry Fallback */}
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground text-center">
              לא מצליחים לסרוק? הזינו ידנית:
            </p>
            {secret && (
              <div className="flex items-center gap-2 bg-muted p-3 rounded-md">
                <code className="flex-1 text-sm font-mono break-all" dir="ltr">
                  {secret}
                </code>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopySecret}
                  className="shrink-0"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <Button onClick={() => setStep("verify")} className="w-full">
              המשך
            </Button>
            <Button variant="ghost" onClick={onCancel}>
              ביטול
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Verify Step
  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <CheckCircle2 className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-xl">הזינו את קוד האימות</CardTitle>
        <CardDescription>
          הזינו את הקוד בן 6 הספרות מאפליקציית האימות
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="totp-code">קוד אימות</Label>
          <Input
            id="totp-code"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="text-center text-2xl tracking-widest font-mono"
            dir="ltr"
            maxLength={6}
            autoComplete="one-time-code"
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleVerify}
            disabled={loading || code.length !== 6}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                מאמת...
              </>
            ) : (
              "אמת והפעל"
            )}
          </Button>
          <Button variant="ghost" onClick={() => setStep("qr")} disabled={loading}>
            חזרה
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
