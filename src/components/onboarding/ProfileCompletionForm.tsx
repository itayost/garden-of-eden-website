"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  profileCompletionSchema,
  type ProfileCompletionData,
  validateImage,
  IMAGE_CONSTRAINTS,
} from "@/lib/validations/profile";
import { uploadProfilePhoto } from "@/lib/utils/storage";
import { POSITIONS, POSITION_LABELS_HE } from "@/types/player-stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ImageUpload } from "@/components/ui/image-upload";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, UserCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

interface ProfileCompletionFormProps {
  userId: string;
  initialData?: {
    full_name?: string | null;
    birthdate?: string | null;
    position?: string | null;
    avatar_url?: string | null;
  };
}

export function ProfileCompletionForm({ userId, initialData }: ProfileCompletionFormProps) {
  const [loading, setLoading] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<File | null>(null);

  const form = useForm<ProfileCompletionData>({
    resolver: zodResolver(profileCompletionSchema),
    defaultValues: {
      full_name: initialData?.full_name || "",
      birthdate: initialData?.birthdate || "",
      position: (initialData?.position as ProfileCompletionData["position"]) || undefined,
    },
  });

  const onSubmit = async (data: ProfileCompletionData) => {
    setLoading(true);

    try {
      const supabase = createClient();

      // Authorization check: verify current user matches the userId prop
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || user.id !== userId) {
        toast.error("אין הרשאה לעדכן פרופיל זה");
        setLoading(false);
        return;
      }

      let avatarUrl: string | null = initialData?.avatar_url || null;

      // Upload photo if provided
      if (profilePhoto) {
        const validation = validateImage(profilePhoto);
        if (!validation.valid) {
          toast.error(validation.error || "שגיאה בתמונה");
          setLoading(false);
          return;
        }

        const uploadResult = await uploadProfilePhoto(userId, profilePhoto);
        if ("error" in uploadResult) {
          toast.error(uploadResult.error);
          setLoading(false);
          return;
        }
        avatarUrl = uploadResult.url;
      }

      // Update profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update({
          full_name: data.full_name,
          birthdate: data.birthdate,
          position: data.position || null,
          avatar_url: avatarUrl,
          profile_completed: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Profile update error:", updateError);
        toast.error("שגיאה בשמירת הפרופיל. נסה שוב.");
        setLoading(false);
        return;
      }

      toast.success("הפרופיל הושלם בהצלחה!");

      // Hard redirect to dashboard (ensure cookies are properly set)
      window.location.href = "/dashboard";
    } catch (err) {
      console.error("Profile completion error:", err);
      toast.error("שגיאה בשמירת הפרופיל. נסה שוב.");
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto border-[#22C55E]/20">
      <CardHeader className="text-center space-y-2">
        <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-2xl">השלמת פרופיל</CardTitle>
        <CardDescription>
          עוד כמה פרטים ואתה מוכן להתחיל!
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Profile Photo */}
            <div className="flex justify-center">
              <ImageUpload
                value={profilePhoto || initialData?.avatar_url || null}
                onChange={setProfilePhoto}
                maxSizeMB={IMAGE_CONSTRAINTS.maxSizeMB}
                acceptedFormats={IMAGE_CONSTRAINTS.acceptedTypes}
                previewSize="lg"
                label="תמונת פרופיל"
                description="JPEG, PNG או WebP עד 2MB"
                disabled={loading}
              />
            </div>

            {/* Full Name - Required */}
            <FormField
              control={form.control}
              name="full_name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>שם מלא *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="הזן את שמך המלא"
                      disabled={loading}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Birthdate - Required */}
            <FormField
              control={form.control}
              name="birthdate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>תאריך לידה *</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      disabled={loading}
                      max={new Date().toISOString().split("T")[0]}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    משמש לחישוב קבוצת גיל
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Position - Optional */}
            <FormField
              control={form.control}
              name="position"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>עמדה מועדפת</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value || undefined}
                    disabled={loading}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="בחר עמדה (לא חובה)" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {POSITIONS.map((pos) => (
                        <SelectItem key={pos} value={pos}>
                          {POSITION_LABELS_HE[pos]} ({pos})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    העמדה שאתה משחק בה בדרך כלל
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full"
              size="lg"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  שומר...
                </>
              ) : (
                <>
                  <UserCheck className="ml-2 h-5 w-5" />
                  סיום והמשך
                </>
              )}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
