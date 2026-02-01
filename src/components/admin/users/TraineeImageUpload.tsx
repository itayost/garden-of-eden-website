"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Loader2, Upload, Check, X, AlertCircle, RotateCcw } from "lucide-react";
import { useBackgroundRemoval } from "@/hooks/useBackgroundRemoval";

interface TraineeImageUploadProps {
  traineeUserId: string;
  currentAvatarUrl?: string | null;
  onSuccess: (originalUrl: string, processedUrl: string) => void;
  onCancel?: () => void;
}

type UploadStep = "select" | "preview" | "processing" | "uploading" | "result";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];

export function TraineeImageUpload({
  traineeUserId,
  currentAvatarUrl,
  onSuccess,
  onCancel,
}: TraineeImageUploadProps) {
  const [step, setStep] = useState<UploadStep>("select");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [, setProcessedBlob] = useState<Blob | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [uploadedUrls, setUploadedUrls] = useState<{ original: string; processed: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const {
    removeBackground,
    progress: bgProgress,
    status: bgStatus,
    error: bgError,
    reset: resetBgRemoval,
  } = useBackgroundRemoval();

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
      if (processedPreviewUrl && processedPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(processedPreviewUrl);
      }
    };
  }, [previewUrl, processedPreviewUrl]);

  const validateFile = useCallback((file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) {
      return "יש לבחור קובץ JPG או PNG בלבד";
    }
    if (file.size > MAX_FILE_SIZE) {
      return "הקובץ גדול מדי. מקסימום 5MB";
    }
    return null;
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setSelectedFile(file);

    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    setStep("preview");
  };

  const handleConfirmAndProcess = async () => {
    if (!selectedFile) return;

    setStep("processing");
    setError(null);

    try {
      // Process background removal client-side
      const processed = await removeBackground(selectedFile);

      if (!processed) {
        throw new Error(bgError || "שגיאה בעיבוד התמונה");
      }

      setProcessedBlob(processed);
      const processedUrl = URL.createObjectURL(processed);
      setProcessedPreviewUrl(processedUrl);

      // Now upload both images
      setStep("uploading");

      const formData = new FormData();
      formData.append("original", selectedFile);
      formData.append("processed", processed, "processed.png");
      formData.append("traineeUserId", traineeUserId);

      const response = await fetch("/api/images/upload-trainee-images", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "שגיאה בהעלאת התמונות");
      }

      const data = await response.json();

      if (!data.originalUrl || !data.processedUrl) {
        throw new Error("תגובה לא תקינה מהשרת");
      }

      setUploadedUrls({
        original: data.originalUrl,
        processed: data.processedUrl,
      });
      setStep("result");
    } catch (err) {
      console.error("[TraineeImageUpload] Error:", err);
      setError(err instanceof Error ? err.message : "שגיאה בעיבוד התמונה");
      setStep("preview");
    }
  };

  const handleCancel = () => {
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    if (processedPreviewUrl && processedPreviewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(processedPreviewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setProcessedBlob(null);
    setProcessedPreviewUrl(null);
    setError(null);
    setStep("select");
    resetBgRemoval();

    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleTryAnother = () => {
    handleCancel();
  };

  const handleSave = () => {
    if (uploadedUrls) {
      onSuccess(uploadedUrls.original, uploadedUrls.processed);
    }
  };

  const handleRetry = () => {
    setError(null);
    resetBgRemoval();
    handleConfirmAndProcess();
  };

  const getStatusText = () => {
    switch (bgStatus) {
      case "loading-model":
        return "טוען מודל עיבוד תמונה...";
      case "processing":
        return "מסיר רקע מהתמונה...";
      default:
        return "מעבד...";
    }
  };

  return (
    <div className="flex flex-col items-center gap-4 p-4" dir="rtl">
      {/* Step 1: Select */}
      {step === "select" && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          {currentAvatarUrl && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <img
                src={currentAvatarUrl}
                alt="תמונה נוכחית"
                className="w-12 h-12 rounded-full object-cover border"
              />
              <span>תמונה נוכחית</span>
            </div>
          )}

          <div className="flex flex-col items-center gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => inputRef.current?.click()}
              className="h-32 w-48 flex-col gap-3 border-dashed border-2"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span>בחר תמונה</span>
            </Button>

            <p className="text-xs text-muted-foreground text-center">
              JPG או PNG, עד 5MB
            </p>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            onChange={handleFileSelect}
            className="hidden"
          />

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}

          {onCancel && (
            <Button type="button" variant="ghost" onClick={onCancel}>
              ביטול
            </Button>
          )}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && previewUrl && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="relative">
            <img
              src={previewUrl}
              alt="תצוגה מקדימה"
              className="max-w-64 max-h-64 rounded-lg object-contain border"
            />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            הרקע יוסר אוטומטית מהתמונה
          </p>

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="button" onClick={handleConfirmAndProcess}>
              <Check className="h-4 w-4 ml-2" />
              אשר ועבד
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 ml-2" />
              ביטול
            </Button>
          </div>

          {error && (
            <Button type="button" variant="secondary" onClick={handleRetry}>
              <RotateCcw className="h-4 w-4 ml-2" />
              נסה שוב
            </Button>
          )}
        </div>
      )}

      {/* Step 3: Processing */}
      {step === "processing" && (
        <div className="flex flex-col items-center gap-4 py-8 w-full max-w-sm">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">{getStatusText()}</p>
          <Progress value={bgProgress} className="w-full" />
          <p className="text-sm text-muted-foreground">{bgProgress}%</p>
        </div>
      )}

      {/* Step 4: Uploading */}
      {step === "uploading" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">מעלה תמונות...</p>
        </div>
      )}

      {/* Step 5: Result */}
      {step === "result" && uploadedUrls && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          <div className="flex gap-4">
            <div className="flex flex-col items-center gap-2">
              <img
                src={uploadedUrls.original}
                alt="תמונה מקורית"
                className="w-32 h-32 rounded-lg object-cover border"
              />
              <span className="text-xs text-muted-foreground">מקורית</span>
            </div>
            <div className="flex flex-col items-center gap-2">
              <div className="w-32 h-32 rounded-lg border bg-[url('/checkerboard.svg')] bg-repeat flex items-center justify-center">
                <img
                  src={uploadedUrls.processed}
                  alt="תמונה מעובדת"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              <span className="text-xs text-muted-foreground">ללא רקע</span>
            </div>
          </div>

          <p className="text-sm text-green-600 text-center">
            התמונות הועלו בהצלחה!
          </p>

          <div className="flex gap-3">
            <Button type="button" onClick={handleSave}>
              <Check className="h-4 w-4 ml-2" />
              שמור
            </Button>
            <Button type="button" variant="outline" onClick={handleTryAnother}>
              <RotateCcw className="h-4 w-4 ml-2" />
              בחר תמונה אחרת
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
