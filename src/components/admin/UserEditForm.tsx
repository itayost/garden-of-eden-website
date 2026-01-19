"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { createClient } from "@/lib/supabase/client";
import {
  userEditSchema,
  type UserEditFormData,
  getUserEditDefaults,
  getFieldChanges,
  getActionType,
} from "@/lib/validations/user-edit";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import type { Profile, UserRole } from "@/types/database";

interface UserEditFormProps {
  user: Profile;
  currentUserRole: UserRole;
}

export function UserEditForm({ user, currentUserRole }: UserEditFormProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: getUserEditDefaults(user),
  });

  const onSubmit = async (data: UserEditFormData) => {
    setLoading(true);

    try {
      const supabase = createClient();
      const {
        data: { user: currentUser },
      } = await supabase.auth.getUser();

      if (!currentUser) {
        toast.error("נא להתחבר מחדש");
        return;
      }

      // Get current admin profile for logging
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: adminProfile, error: profileError } = await (supabase as any)
        .from("profiles")
        .select("full_name, role")
        .eq("id", currentUser.id)
        .single();

      if (profileError) {
        console.error("Failed to fetch admin profile:", profileError);
        toast.error("שגיאה בטעינת פרופיל המשתמש");
        return;
      }

      if (adminProfile?.role !== "admin") {
        toast.error("אין הרשאה לעדכן משתמש");
        return;
      }

      // Detect changes for activity log
      const changes = getFieldChanges(user, data);

      if (changes.length === 0) {
        toast.info("לא בוצעו שינויים");
        return;
      }

      // Prevent self-modification of role or is_active
      if (user.id === currentUser.id) {
        const roleChanged = changes.some((c) => c.field === "role");
        const statusChanged = changes.some((c) => c.field === "is_active");

        if (roleChanged || statusChanged) {
          toast.error("לא ניתן לשנות את התפקיד או הסטטוס של עצמך");
          return;
        }
      }

      // Prepare update data, handling empty strings
      const updateData = {
        full_name: data.full_name,
        phone: data.phone || null,
        birthdate: data.birthdate || null,
        role: data.role,
        is_active: data.is_active,
        updated_at: new Date().toISOString(),
      };

      // Update profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update(updateData)
        .eq("id", user.id);

      if (updateError) throw updateError;

      // Log activity
      const actionType = getActionType(changes);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: logError } = await (supabase as any)
        .from("activity_logs")
        .insert({
          user_id: user.id,
          action: actionType,
          actor_id: currentUser.id,
          actor_name: adminProfile?.full_name || "מנהל",
          changes: changes,
        });

      if (logError) {
        console.error("Failed to log activity:", logError);
        // Don't fail the entire operation, but log it
      }

      toast.success("המשתמש עודכן בהצלחה!");
      router.refresh();
    } catch (error) {
      console.error("Update error:", error);
      const errorMessage =
        error instanceof Error ? error.message : "שגיאה בעדכון המשתמש";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const isAdmin = currentUserRole === "admin";

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Full Name */}
        <FormField
          control={form.control}
          name="full_name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>שם מלא</FormLabel>
              <FormControl>
                <Input placeholder="הזן שם מלא" {...field} disabled={loading} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Phone */}
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>טלפון</FormLabel>
              <FormControl>
                <Input
                  placeholder="0501234567"
                  dir="ltr"
                  className="text-right"
                  {...field}
                  value={field.value || ""}
                  disabled={loading}
                />
              </FormControl>
              <FormDescription>פורמט: 0501234567 או +972501234567</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Birthdate */}
        <FormField
          control={form.control}
          name="birthdate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>תאריך לידה</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  max={new Date().toISOString().split("T")[0]}
                  {...field}
                  value={field.value || ""}
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Role (Admin Only) */}
        {isAdmin && (
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>תפקיד</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                  disabled={loading}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="בחר תפקיד" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="trainee">מתאמן</SelectItem>
                    <SelectItem value="trainer">מאמן</SelectItem>
                    <SelectItem value="admin">מנהל</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>תפקיד המשתמש במערכת</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* Is Active (Admin Only) */}
        {isAdmin && (
          <FormField
            control={form.control}
            name="is_active"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">חשבון פעיל</FormLabel>
                  <FormDescription>
                    כאשר מושבת, המשתמש לא יוכל להתחבר למערכת
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    disabled={loading}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        )}

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" />
              שמור שינויים
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
