"use client";

/**
 * Security Settings Page
 *
 * Allows users to manage their 2FA settings:
 * - View current 2FA status (enabled/disabled)
 * - Enable 2FA via TwoFactorSetup component
 * - Disable 2FA via TwoFactorDisable component
 */

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
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
import { ShieldCheck, ShieldOff, Loader2, Lock, Info } from "lucide-react";
import { toast } from "sonner";
import { useMFA } from "@/hooks/use-mfa";
import { TwoFactorSetup } from "@/components/auth/TwoFactorSetup";
import { unenrollFactor, verifyMFA } from "@/lib/auth/mfa";

export default function SecuritySettingsPage() {
  const { hasMFA, factors, isLoading, error, refresh } = useMFA();
  const [showSetup, setShowSetup] = useState(false);
  const [showDisable, setShowDisable] = useState(false);
  const [disableCode, setDisableCode] = useState("");
  const [disableLoading, setDisableLoading] = useState(false);
  const [disableError, setDisableError] = useState<string | null>(null);

  // Get the verified factor for disable flow
  const verifiedFactor = factors.find((f) => f.status === "verified");

  const handleSetupSuccess = () => {
    setShowSetup(false);
    refresh();
  };

  const handleDisableSubmit = async () => {
    if (!verifiedFactor) {
      setDisableError("לא נמצא גורם אימות פעיל");
      return;
    }

    if (disableCode.length !== 6 || !/^\d+$/.test(disableCode)) {
      setDisableError("נא להזין קוד בן 6 ספרות");
      return;
    }

    setDisableLoading(true);
    setDisableError(null);

    // First verify the code to ensure user has access
    const verifyResult = await verifyMFA(verifiedFactor.id, disableCode);

    if ("error" in verifyResult) {
      setDisableError("קוד אימות שגוי");
      setDisableLoading(false);
      return;
    }

    // Now unenroll the factor
    const unenrollResult = await unenrollFactor(verifiedFactor.id);

    if ("error" in unenrollResult) {
      setDisableError(unenrollResult.error);
      setDisableLoading(false);
      return;
    }

    toast.success("אימות דו-שלבי בוטל בהצלחה");
    setShowDisable(false);
    setDisableCode("");
    setDisableLoading(false);
    refresh();
  };

  const handleDisableCancel = () => {
    setShowDisable(false);
    setDisableCode("");
    setDisableError(null);
  };

  const handleCodeChange = (value: string) => {
    // Only allow digits, max 6
    const digits = value.replace(/\D/g, "").slice(0, 6);
    setDisableCode(digits);
    setDisableError(null);
  };

  // Format enrollment date if available
  const enrolledDate = verifiedFactor?.createdAt
    ? new Date(verifiedFactor.createdAt).toLocaleDateString("he-IL", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* 2FA Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                {hasMFA ? (
                  <ShieldCheck className="h-5 w-5 text-primary" />
                ) : (
                  <ShieldOff className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div>
                <CardTitle className="text-lg">אימות דו-שלבי (2FA)</CardTitle>
                <CardDescription>
                  הגנו על החשבון שלכם עם שכבת אבטחה נוספת
                </CardDescription>
              </div>
            </div>
            {!isLoading && (
              <Badge variant={hasMFA ? "default" : "secondary"}>
                {hasMFA ? "מופעל" : "לא מופעל"}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : hasMFA ? (
            <>
              {enrolledDate && (
                <p className="text-sm text-muted-foreground">
                  הופעל ב-{enrolledDate}
                </p>
              )}
              <Button
                variant="outline"
                onClick={() => setShowDisable(true)}
                className="text-destructive hover:text-destructive"
              >
                <ShieldOff className="ml-2 h-4 w-4" />
                בטל 2FA
              </Button>
            </>
          ) : (
            <Button onClick={() => setShowSetup(true)}>
              <ShieldCheck className="ml-2 h-4 w-4" />
              הפעל 2FA
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Security Tips Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10">
              <Info className="h-5 w-5 text-blue-500" />
            </div>
            <CardTitle className="text-lg">עצות אבטחה</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <ul className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>השתמשו בסיסמה חזקה שמכילה אותיות גדולות וקטנות, מספרים ותווים מיוחדים</span>
            </li>
            <li className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>אל תשתפו את פרטי ההתחברות שלכם עם אחרים</span>
            </li>
            <li className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>הפעילו אימות דו-שלבי להגנה נוספת על החשבון</span>
            </li>
            <li className="flex items-start gap-2">
              <Lock className="h-4 w-4 mt-0.5 shrink-0" />
              <span>התנתקו מהמערכת בסיום השימוש במחשבים ציבוריים</span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* 2FA Setup Sheet */}
      <Sheet open={showSetup} onOpenChange={setShowSetup}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-6">
            <SheetTitle>הפעלת אימות דו-שלבי</SheetTitle>
            <SheetDescription>
              הגדירו אימות דו-שלבי כדי להגן על החשבון שלכם
            </SheetDescription>
          </SheetHeader>
          <TwoFactorSetup
            onSuccess={handleSetupSuccess}
            onCancel={() => setShowSetup(false)}
          />
        </SheetContent>
      </Sheet>

      {/* 2FA Disable AlertDialog */}
      <AlertDialog open={showDisable} onOpenChange={(open) => !open && handleDisableCancel()}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ביטול אימות דו-שלבי</AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <span className="block">
                הזינו את קוד האימות הנוכחי כדי לבטל את האימות הדו-שלבי
              </span>
              <span className="block text-destructive font-medium">
                שימו לב: ביטול האימות הדו-שלבי יפחית את אבטחת החשבון שלכם
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-2 py-4">
            <Label htmlFor="disable-code">קוד אימות</Label>
            <Input
              id="disable-code"
              type="text"
              inputMode="numeric"
              placeholder="000000"
              value={disableCode}
              onChange={(e) => handleCodeChange(e.target.value)}
              className="text-center text-xl tracking-widest font-mono"
              dir="ltr"
              maxLength={6}
              autoComplete="one-time-code"
              disabled={disableLoading}
            />
            {disableError && (
              <p className="text-sm text-destructive">{disableError}</p>
            )}
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDisableCancel} disabled={disableLoading}>
              ביטול
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDisableSubmit}
              disabled={disableLoading || disableCode.length !== 6}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disableLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  מבטל...
                </>
              ) : (
                "בטל אימות דו-שלבי"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
