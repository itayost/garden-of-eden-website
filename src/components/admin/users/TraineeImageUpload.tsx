"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Upload, Check, X, AlertCircle, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TraineeImageUploadProps {
  traineeUserId: string;
  currentAvatarUrl?: string | null;
  onSuccess: (originalUrl: string, processedUrl: string) => void;
  onCancel?: () => void;
}

type UploadStep = "select" | "preview" | "processing" | "result";

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
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Cleanup object URLs on unmount and step changes
  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

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
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("traineeUserId", traineeUserId);

      const response = await fetch("/api/images/process-background", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "שגיאה בעיבוד התמונה");
      }

      const data = await response.json();

      if (!data.originalUrl || !data.processedUrl) {
        throw new Error("תגובה לא תקינה מהשרת");
      }

      setOriginalUrl(data.originalUrl);
      setProcessedUrl(data.processedUrl);
      setStep("result");
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בעיבוד התמונה");
      setStep("preview");
    }
  };

  const handleCancel = () => {
    // Cleanup
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setError(null);
    setStep("select");

    // Reset file input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleTryAnother = () => {
    // Cleanup
    if (previewUrl && previewUrl.startsWith("blob:")) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setProcessedUrl(null);
    setOriginalUrl(null);
    setError(null);
    setStep("select");

    // Reset file input
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const handleSave = () => {
    if (originalUrl && processedUrl) {
      onSuccess(originalUrl, processedUrl);
    }
  };

  const handleRetry = () => {
    setError(null);
    handleConfirmAndProcess();
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

          {error && (
            <p className="text-sm text-destructive flex items-center gap-1">
              <AlertCircle className="h-4 w-4" />
              {error}
            </p>
          )}

          <div className="flex gap-3">
            <Button type="button" onClick={handleConfirmAndProcess}>
              <Check className="h-4 w-4 ml-2" />
              אשר והמשך
            </Button>
            <Button type="button" variant="outline" onClick={handleCancel}>
              <X className="h-4 w-4 ml-2" />
              ביטול
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Processing */}
      {step === "processing" && (
        <div className="flex flex-col items-center gap-4 py-8">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-lg text-muted-foreground">מעבד תמונה...</p>
          <p className="text-sm text-muted-foreground">
            הסרת רקע עשויה לקחת מספר שניות
          </p>
        </div>
      )}

      {/* Step 4: Result */}
      {step === "result" && processedUrl && (
        <div className="flex flex-col items-center gap-4 w-full max-w-sm">
          {/* Checkered background to show transparency */}
          <div
            className={cn(
              "relative rounded-lg overflow-hidden",
              "bg-[length:20px_20px]",
              "bg-[linear-gradient(45deg,#f0f0f0_25%,transparent_25%,transparent_75%,#f0f0f0_75%),linear-gradient(45deg,#f0f0f0_25%,transparent_25%,transparent_75%,#f0f0f0_75%)]",
              "bg-[position:0_0,10px_10px]"
            )}
          >
            <img
              src={processedUrl}
              alt="תוצאה מעובדת"
              className="max-w-64 max-h-64 object-contain"
            />
          </div>

          <p className="text-sm text-muted-foreground text-center">
            תמונה לאחר הסרת רקע
          </p>

          <div className="flex gap-3">
            <Button type="button" onClick={handleSave}>
              <Check className="h-4 w-4 ml-2" />
              שמור
            </Button>
            <Button type="button" variant="outline" onClick={handleTryAnother}>
              <RotateCcw className="h-4 w-4 ml-2" />
              נסה תמונה אחרת
            </Button>
          </div>
        </div>
      )}

      {/* Processing error with retry */}
      {step === "preview" && error && (
        <div className="flex gap-3 mt-2">
          <Button type="button" variant="secondary" onClick={handleRetry}>
            <RotateCcw className="h-4 w-4 ml-2" />
            נסה שוב
          </Button>
        </div>
      )}
    </div>
  );
}
