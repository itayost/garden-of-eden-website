"use client";

/**
 * TwoFactorDisable - 2FA disable confirmation component
 *
 * AlertDialog for securely disabling 2FA.
 * Requires current TOTP code verification before allowing disable.
 */

import { useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { verifyMFA, unenrollFactor } from "@/lib/auth/mfa";

interface TwoFactorDisableProps {
  factorId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  onCancel: () => void;
}

export function TwoFactorDisable({
  factorId,
  open,
  onOpenChange,
  onSuccess,
  onCancel,
}: TwoFactorDisableProps) {
  const [loading, setLoading] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleCodeChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setCode(digits);
    setError(null);
  };

  const handleDisable = async () => {
    if (code.length !== 6 || !/^\d+$/.test(code)) {
      setError("נא להזין קוד בן 6 ספרות");
      return;
    }

    setLoading(true);
    setError(null);

    // First verify the code to ensure user has access to authenticator
    const verifyResult = await verifyMFA(factorId, code);

    if ("error" in verifyResult) {
      setError(verifyResult.error);
      setLoading(false);
      setCode("");
      return;
    }

    // Now unenroll the factor
    const unenrollResult = await unenrollFactor(factorId);

    if ("error" in unenrollResult) {
      setError(unenrollResult.error);
      setLoading(false);
      return;
    }

    toast.success("אימות דו-שלבי בוטל בהצלחה");
    setCode("");
    setError(null);
    onSuccess();
  };

  const handleCancel = () => {
    setCode("");
    setError(null);
    onCancel();
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <ShieldOff className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            ביטול אימות דו-שלבי
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center space-y-2">
            <span className="block">
              הזינו את קוד האימות הנוכחי כדי לבטל את האימות הדו-שלבי
            </span>
            <span className="block text-destructive font-medium">
              שימו לב: ביטול האימות הדו-שלבי יפחית את אבטחת החשבון שלכם
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-2 py-4">
          <Label htmlFor="disable-totp-code">קוד אימות</Label>
          <Input
            id="disable-totp-code"
            type="text"
            inputMode="numeric"
            placeholder="000000"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            className="text-center text-xl tracking-widest font-mono"
            dir="ltr"
            maxLength={6}
            autoComplete="one-time-code"
            disabled={loading}
          />
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel} disabled={loading}>
            ביטול
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleDisable();
            }}
            disabled={loading || code.length !== 6}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                מבטל...
              </>
            ) : (
              "בטל אימות דו-שלבי"
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
