"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { updateUserAction } from "@/lib/actions/admin-users";
import {
  userEditSchema,
  type UserEditFormData,
  getUserEditDefaults,
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
      const result = await updateUserAction(user.id, data);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      if (result.message) {
        toast.info(result.message);
      } else {
        toast.success("המשתמש עודכן בהצלחה!");
      }
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
