"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  resetPasswordSchema,
  passwordRequirements,
  type ResetPasswordInput,
} from "@/lib/validations/auth";
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
import {
  Lock,
  ArrowRight,
  Loader2,
  Eye,
  EyeOff,
  Check,
  X,
} from "lucide-react";
import { toast } from "sonner";

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const router = useRouter();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const password = watch("password", "");

  const onSubmit = async (data: ResetPasswordInput) => {
    setLoading(true);

    try {
      const supabase = createClient();

      const { error } = await supabase.auth.updateUser({
        password: data.password,
      });

      if (error) {
        throw error;
      }

      toast.success("הסיסמה עודכנה בהצלחה");
      router.push("/dashboard");
    } catch (error: unknown) {
      console.error("Update password error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "שגיאה בעדכון הסיסמה";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const allRequirementsMet = passwordRequirements.every((req) =>
    req.test(password)
  );

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
          <CardTitle className="text-2xl">הגדרת סיסמה חדשה</CardTitle>
          <CardDescription>בחרו סיסמה חדשה לחשבון שלכם</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="password">סיסמה חדשה</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="הזינו סיסמה חדשה"
                  {...register("password")}
                  className="pr-10 pl-10 text-lg"
                  dir="ltr"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Password requirements checklist */}
            <div className="space-y-2 p-3 rounded-lg bg-muted/50">
              <p className="text-sm font-medium text-muted-foreground">
                דרישות סיסמה:
              </p>
              <ul className="space-y-1">
                {passwordRequirements.map((req, index) => {
                  const isMet = req.test(password);
                  return (
                    <li
                      key={index}
                      className={`flex items-center gap-2 text-sm ${
                        isMet ? "text-[#22C55E]" : "text-muted-foreground"
                      }`}
                    >
                      {isMet ? (
                        <Check className="h-4 w-4" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      {req.label}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">אימות סיסמה</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="הזינו את הסיסמה שוב"
                  {...register("confirmPassword")}
                  className="pr-10 pl-10 text-lg"
                  dir="ltr"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="text-sm text-destructive">
                  {errors.confirmPassword.message}
                </p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading || !allRequirementsMet}
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  מעדכן...
                </>
              ) : (
                <>
                  <ArrowRight className="ml-2 h-5 w-5" />
                  עדכן סיסמה
                </>
              )}
            </Button>
          </form>

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
