"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { FormBackButton, FormSubmitButton } from "@/components/forms";
import { nextGameSchema, type NextGameInput, todayInIsrael } from "@/lib/validations/next-game";
import { upsertNextGame } from "@/features/next-game/lib/actions/next-game";

interface NextGameFormProps {
  initialValues: NextGameInput;
}

export function NextGameForm({ initialValues }: NextGameFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<NextGameInput>({
    resolver: zodResolver(nextGameSchema),
    defaultValues: initialValues,
  });

  const onSubmit = async (data: NextGameInput) => {
    setLoading(true);
    const result = await upsertNextGame(data);
    setLoading(false);

    if (!result.success) {
      toast.error(result.error);
      return;
    }

    toast.success("המשחק הבא נשמר!");
    router.push("/dashboard");
    router.refresh();
  };

  return (
    <div className="max-w-2xl mx-auto">
      <FormBackButton href="/dashboard" label="חזרה לדשבורד" />

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">המשחק הבא שלי</CardTitle>
          <CardDescription>כדי שנגיע לראות 👍</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="game_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>מתי המשחק?</FormLabel>
                    <FormControl>
                      <Input type="date" min={todayInIsrael()} {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="opponent"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>נגד מי?</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="לדוגמה: מכבי חיפה"
                        autoComplete="off"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormSubmitButton
                loading={loading}
                label="שמירת המשחק"
                loadingLabel="שומר..."
              />
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
