"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Mail, ArrowRight, Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("נא להזין כתובת אימייל תקינה");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();
      const origin = window.location.origin;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${origin}/auth/reset-password`,
      });

      if (error) {
        throw error;
      }

      setSuccess(true);
      toast.success("נשלח לך קישור לאיפוס סיסמה");
    } catch (error: unknown) {
      console.error("Reset password error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "שגיאה בשליחת קישור האיפוס";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#0A1F0A] to-[#142814] p-4">
      <Card className="w-full max-w-md border-[#22C55E]/20">
        <CardHeader className="text-center">
          <Link
            href="/"
            className="font-display text-3xl text-[#22C55E] mb-4 block tracking-wider"
          >
            GARDEN OF EDEN
          </Link>
          <CardTitle className="text-2xl">איפוס סיסמה</CardTitle>
          <CardDescription>
            {success
              ? "בדקו את תיבת האימייל שלכם"
              : "הזינו את כתובת האימייל שלכם ונשלח לכם קישור לאיפוס"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {success ? (
            <div className="space-y-6">
              <div className="flex flex-col items-center gap-4 py-6">
                <CheckCircle2 className="h-16 w-16 text-[#22C55E]" />
                <p className="text-center text-muted-foreground">
                  נשלח לך קישור לאיפוס סיסמה לכתובת האימייל
                </p>
                <p className="text-center font-medium" dir="ltr">
                  {email}
                </p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setSuccess(false);
                  setEmail("");
                }}
              >
                שלח שוב
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">כתובת אימייל</Label>
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pr-10 text-lg"
                    dir="ltr"
                    disabled={loading}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    שולח...
                  </>
                ) : (
                  <>
                    <ArrowRight className="ml-2 h-5 w-5" />
                    שלח קישור איפוס
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/auth/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              חזרה להתחברות
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
