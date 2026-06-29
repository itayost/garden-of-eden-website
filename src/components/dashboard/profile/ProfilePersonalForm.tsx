"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  profileSelfUpdateSchema,
  type ProfileSelfUpdateData,
} from "@/lib/validations/profile";
import { updateOwnProfileAction } from "@/lib/actions/update-own-profile";
import { POSITIONS, POSITION_LABELS_HE } from "@/types/player-stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

const NO_POSITION = "none";

interface ProfilePersonalFormProps {
  readonly initialBirthdate: string | null;
  readonly initialPosition: string | null;
}

export function ProfilePersonalForm({
  initialBirthdate,
  initialPosition,
}: ProfilePersonalFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<ProfileSelfUpdateData>({
    resolver: zodResolver(profileSelfUpdateSchema),
    defaultValues: {
      birthdate: initialBirthdate ?? "",
      position:
        (initialPosition as ProfileSelfUpdateData["position"]) ?? undefined,
    },
  });

  const onSubmit = async (data: ProfileSelfUpdateData) => {
    setLoading(true);
    const result = await updateOwnProfileAction({
      birthdate: data.birthdate,
      position: data.position ?? null,
    });
    setLoading(false);

    if ("error" in result) {
      toast.error(result.error);
      return;
    }

    toast.success("הפרטים נשמרו");
    router.refresh();
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="birthdate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>תאריך לידה</FormLabel>
              <FormControl>
                <Input
                  type="date"
                  disabled={loading}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full max-w-full"
                  {...field}
                />
              </FormControl>
              <FormDescription>משמש לחישוב קבוצת הגיל שלך בדירוגים</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="position"
          render={({ field }) => (
            <FormItem>
              <FormLabel>עמדה מועדפת</FormLabel>
              <Select
                value={field.value ?? NO_POSITION}
                onValueChange={(v) =>
                  field.onChange(v === NO_POSITION ? null : v)
                }
                disabled={loading}
                dir="rtl"
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר עמדה" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value={NO_POSITION}>ללא עמדה</SelectItem>
                  {POSITIONS.map((pos) => (
                    <SelectItem key={pos} value={pos}>
                      {POSITION_LABELS_HE[pos]} ({pos})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>העמדה שאתה משחק בה בדרך כלל</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              שומר...
            </>
          ) : (
            <>
              <Save className="ml-2 h-4 w-4" />
              שמירה
            </>
          )}
        </Button>
      </form>
    </Form>
  );
}
