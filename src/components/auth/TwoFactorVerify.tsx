"use client";

/**
 * TwoFactorVerify - 2FA verification component for login
 *
 * Used during login when user has MFA enabled but hasn't verified
 * this session (transitioning from aal1 to aal2).
 */

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2 } from "lucide-react";
import { listFactors, verifyMFA } from "@/lib/auth/mfa";

interface TwoFactorVerifyProps {
  onSuccess: () => void;
  onCancel?: () => void;
}

export function TwoFactorVerify({ onSuccess, onCancel }: TwoFactorVerifyProps) {
  const [loading, setLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Fetch factor ID on mount
  useEffect(() => {
    const fetchFactor = async () => {
      const result = await listFactors();

      if ("error" in result) {
        setError(result.error);
        setInitializing(false);
        return;
      }

      // Find the first verified TOTP factor
      const verifiedFactor = result.factors.find(
        (factor) => factor.status === "verified"
      );

      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
      } else {
        setError("לא נמצא אימות דו-שלבי פעיל");
      }

      setInitializing(false);
    };

    fetchFactor();
  }, []);

  const handleVerify = async () => {
    if (!factorId) {
      setError("חסר מזהה גורם אימות");
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
      setCode("");
      return;
    }

    onSuccess();
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && code.length === 6) {
      handleVerify();
    }
  };

  if (initializing) {
    return (
      <Card className="w-full max-w-md">
        <CardContent className="py-12">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-muted-foreground">טוען...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <ShieldCheck className="h-7 w-7 text-primary" />
        </div>
        <CardTitle className="text-xl">אימות דו-שלבי</CardTitle>
        <CardDescription>
          הזינו את קוד האימות מאפליקציית האימות שלכם
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="verify-totp-code">קוד אימות</Label>
          <Input
            id="verify-totp-code"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className="text-center text-2xl tracking-widest font-mono"
            dir="ltr"
            maxLength={6}
            autoComplete="one-time-code"
            autoFocus
            disabled={loading || !factorId}
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <Button
            onClick={handleVerify}
            disabled={loading || code.length !== 6 || !factorId}
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                מאמת...
              </>
            ) : (
              "אמת"
            )}
          </Button>
          {onCancel && (
            <Button variant="ghost" onClick={onCancel} disabled={loading}>
              ביטול
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
