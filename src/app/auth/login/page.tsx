"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getSafeRedirectUrl } from "@/lib/utils/redirect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Phone, Mail, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";

function LoginForm() {
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [authType, setAuthType] = useState<"email" | "phone">("phone");
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirectUrl(searchParams.get("redirect"));

  const formatPhoneNumber = (value: string) => {
    const digits = value.replace(/\D/g, "");
    if (digits.startsWith("972")) {
      return digits;
    }
    if (digits.startsWith("0")) {
      return "972" + digits.slice(1);
    }
    return digits;
  };

  const handlePhoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const formattedPhone = formatPhoneNumber(phone);

    if (formattedPhone.length < 10) {
      toast.error("נא להזין מספר טלפון תקין");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        phone: `+${formattedPhone}`,
        options: { shouldCreateUser: false },
      });

      if (error) {
        throw error;
      }

      sessionStorage.setItem("verifyPhone", `+${formattedPhone}`);
      sessionStorage.setItem("verifyType", "phone");
      sessionStorage.setItem("redirectAfterAuth", redirect);

      toast.success("קוד אימות נשלח ב-WhatsApp");
      router.push("/auth/verify");
    } catch (error: unknown) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error ? error.message : "שגיאה בשליחת קוד האימות";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !email.includes("@")) {
      toast.error("נא להזין כתובת אימייל תקינה");
      return;
    }

    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: false,
        },
      });

      if (error) {
        throw error;
      }

      sessionStorage.setItem("verifyEmail", email);
      sessionStorage.setItem("verifyType", "email");
      sessionStorage.setItem("redirectAfterAuth", redirect);

      toast.success("קוד אימות נשלח לאימייל שלך");
      router.push("/auth/verify");
    } catch (error: unknown) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error ? error.message : "שגיאה בשליחת קוד האימות";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tabs value={authType} onValueChange={(v) => setAuthType(v as "email" | "phone")} className="w-full">
      <TabsList className="grid w-full grid-cols-2 mb-6">
        <TabsTrigger value="phone" className="gap-2">
          <Phone className="h-4 w-4" />
          טלפון
        </TabsTrigger>
        <TabsTrigger value="email" className="gap-2">
          <Mail className="h-4 w-4" />
          אימייל
        </TabsTrigger>
      </TabsList>

      <TabsContent value="email">
        <form onSubmit={handleEmailSubmit} className="space-y-6">
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
            <p className="text-sm text-muted-foreground">
              נשלח לכם קוד אימות באימייל
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
      </TabsContent>

      <TabsContent value="phone">
        <form onSubmit={handlePhoneSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="phone">מספר טלפון</Label>
            <div className="relative">
              <Phone className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                id="phone"
                type="tel"
                placeholder="050-123-4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="pr-10 text-lg"
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
      </TabsContent>
    </Tabs>
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
            בחרו את שיטת ההתחברות המועדפת עליכם
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Suspense fallback={<div className="py-8 text-center">טוען...</div>}>
            <LoginForm />
          </Suspense>

          <div className="mt-4 text-center">
            <Link
              href="/auth/forgot-password"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              שכחתי סיסמה
            </Link>
          </div>

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
