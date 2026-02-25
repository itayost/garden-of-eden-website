"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  userCreateSchema,
  type CreateUserInput,
} from "@/lib/validations/user-create";
import { createUserAction } from "@/lib/actions/admin-users";
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
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

interface UserCreateFormProps {
  isAdmin?: boolean;
}

export function UserCreateForm({ isAdmin = true }: UserCreateFormProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const form = useForm<CreateUserInput>({
    resolver: zodResolver(userCreateSchema),
    defaultValues: {
      full_name: "",
      phone: "",
      role: "trainee",
    },
  });

  const onSubmit = async (data: CreateUserInput) => {
    setLoading(true);
    try {
      const result = await createUserAction(data);

      if (!("success" in result)) {
        if (result.fieldErrors) {
          // Set field-level errors
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            form.setError(field as keyof CreateUserInput, {
              message: errors[0],
            });
          });
        }
        toast.error(result.error);
        return;
      }

      toast.success("המשתמש נוצר בהצלחה!");
      router.push("/admin/users");
      router.refresh();
    } catch (error) {
      console.error("Create user error:", error);
      toast.error("שגיאה ביצירת המשתמש");
    } finally {
      setLoading(false);
    }
  };

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
                <Input
                  placeholder="הזן שם מלא"
                  {...field}
                  disabled={loading}
                />
              </FormControl>
              <FormDescription>השם המלא של המשתמש</FormDescription>
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
                  disabled={loading}
                />
              </FormControl>
              <FormDescription>
                פורמט: 0501234567 או +972501234567
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Role (admin only - trainers can only create trainees) */}
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

        {/* Submit */}
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              יוצר משתמש...
            </>
          ) : (
            <>
              <UserPlus className="ml-2 h-4 w-4" />
              צור משתמש
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
