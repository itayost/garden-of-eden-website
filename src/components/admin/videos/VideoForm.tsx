"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  videoFormSchema,
  type VideoFormInput,
  getDayTopicSuggestion,
} from "@/lib/validations/video";
import {
  createVideoAction,
  updateVideoAction,
} from "@/lib/actions/admin-videos";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { Loader2, Plus, Save } from "lucide-react";
import type { WorkoutVideo } from "@/types/database";

interface VideoFormProps {
  video?: WorkoutVideo;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function VideoForm({ video, onSuccess, onCancel }: VideoFormProps) {
  const [loading, setLoading] = useState(false);
  const isEditMode = !!video;

  const form = useForm({
    resolver: zodResolver(videoFormSchema),
    defaultValues: {
      title: video?.title ?? "",
      youtube_url: video?.youtube_url ?? "",
      day_number: video?.day_number ?? 1,
      day_topic: video?.day_topic ?? getDayTopicSuggestion(1),
      duration_minutes: video?.duration_minutes ?? 1,
      description: video?.description ?? "",
      order_index: video?.order_index,
    } satisfies VideoFormInput,
  });

  const dayNumber = form.watch("day_number");
  const dayTopic = form.watch("day_topic");

  // Auto-suggest day topic when day changes (only in create mode or if topic matches suggestion)
  useEffect(() => {
    if (!isEditMode || dayTopic === getDayTopicSuggestion(video?.day_number ?? 1)) {
      const suggestion = getDayTopicSuggestion(dayNumber);
      if (suggestion && dayTopic !== suggestion) {
        // Only auto-fill if current topic is empty or matches previous suggestion
        const previousSuggestion = getDayTopicSuggestion(
          form.getValues("day_number") === dayNumber
            ? dayNumber
            : dayNumber === 1
              ? 5
              : dayNumber - 1
        );
        if (!dayTopic || dayTopic === previousSuggestion) {
          form.setValue("day_topic", suggestion);
        }
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dayNumber]);

  const onSubmit = async (data: VideoFormInput) => {
    setLoading(true);
    try {
      const result = isEditMode
        ? await updateVideoAction(video.id, data)
        : await createVideoAction(data);

      if (!("success" in result)) {
        if (result.fieldErrors) {
          Object.entries(result.fieldErrors).forEach(([field, errors]) => {
            form.setError(field as keyof VideoFormInput, {
              message: errors[0],
            });
          });
        }
        toast.error(result.error);
        return;
      }

      toast.success(isEditMode ? "הסרטון עודכן בהצלחה!" : "הסרטון נוסף בהצלחה!");
      onSuccess?.();
    } catch (error) {
      console.error("Video form error:", error);
      toast.error(isEditMode ? "שגיאה בעדכון הסרטון" : "שגיאה בהוספת הסרטון");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Title */}
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>כותרת</FormLabel>
              <FormControl>
                <Input
                  placeholder="הזן כותרת לסרטון"
                  {...field}
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* YouTube URL */}
        <FormField
          control={form.control}
          name="youtube_url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>קישור YouTube</FormLabel>
              <FormControl>
                <Input
                  placeholder="https://youtube.com/watch?v=..."
                  dir="ltr"
                  className="text-left"
                  {...field}
                  disabled={loading}
                />
              </FormControl>
              <FormDescription>
                פורמטים נתמכים: youtube.com/watch, youtu.be, youtube.com/shorts
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Day Number */}
        <FormField
          control={form.control}
          name="day_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>יום אימון</FormLabel>
              <Select
                onValueChange={(value) => field.onChange(Number(value))}
                value={String(field.value)}
                disabled={loading}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="בחר יום" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="1">יום 1</SelectItem>
                  <SelectItem value="2">יום 2</SelectItem>
                  <SelectItem value="3">יום 3</SelectItem>
                  <SelectItem value="4">יום 4</SelectItem>
                  <SelectItem value="5">יום 5</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Day Topic */}
        <FormField
          control={form.control}
          name="day_topic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>נושא היום</FormLabel>
              <FormControl>
                <Input
                  placeholder="נושא האימון ליום זה"
                  {...field}
                  disabled={loading}
                />
              </FormControl>
              <FormDescription>
                משתנה אוטומטית לפי היום, ניתן לשנות ידנית
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Duration */}
        <FormField
          control={form.control}
          name="duration_minutes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>משך (דקות)</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  dir="ltr"
                  className="text-left"
                  placeholder="10"
                  {...field}
                  value={field.value ?? ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    field.onChange(value === "" ? undefined : Number(value));
                  }}
                  disabled={loading}
                />
              </FormControl>
              <FormDescription>משך הסרטון בדקות (1-120)</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Description */}
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>תיאור (אופציונלי)</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="תיאור קצר של הסרטון (אופציונלי)"
                  className="resize-none"
                  rows={3}
                  {...field}
                  value={field.value ?? ""}
                  disabled={loading}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {/* Buttons */}
        <div className="flex gap-3">
          <Button type="submit" className="flex-1" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                {isEditMode ? "שומר..." : "מוסיף..."}
              </>
            ) : isEditMode ? (
              <>
                <Save className="ml-2 h-4 w-4" />
                שמור שינויים
              </>
            ) : (
              <>
                <Plus className="ml-2 h-4 w-4" />
                הוסף סרטון
              </>
            )}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={loading}
            >
              ביטול
            </Button>
          )}
        </div>
      </form>
    </Form>
  );
}
