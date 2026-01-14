"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Upload, X, User, AlertCircle } from "lucide-react";

interface ImageUploadProps {
  value: File | string | null;
  onChange: (file: File | null) => void;
  maxSizeMB?: number;
  acceptedFormats?: string[];
  previewSize?: "sm" | "md" | "lg";
  label?: string;
  description?: string;
  disabled?: boolean;
  error?: string;
  className?: string;
}

const sizeClasses = {
  sm: "w-20 h-20",
  md: "w-32 h-32",
  lg: "w-40 h-40",
};

export function ImageUpload({
  value,
  onChange,
  maxSizeMB = 2,
  acceptedFormats = ["image/jpeg", "image/png", "image/webp"],
  previewSize = "lg",
  label,
  description,
  disabled = false,
  error,
  className,
}: ImageUploadProps) {
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Validate URL is safe (prevents XSS via javascript: protocol)
  const isSafeUrl = (url: string): boolean => {
    try {
      const parsed = new URL(url, window.location.origin);
      return ["http:", "https:", "blob:", "data:"].includes(parsed.protocol);
    } catch {
      return false;
    }
  };

  // Generate preview URL with proper cleanup
  useEffect(() => {
    let objectUrl: string | null = null;

    if (value instanceof File) {
      objectUrl = URL.createObjectURL(value);
      setPreview(objectUrl);
    } else if (typeof value === "string" && value && isSafeUrl(value)) {
      setPreview(value);
    } else {
      setPreview(null);
    }

    return () => {
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [value]);

  const validateFile = useCallback(
    (file: File): { valid: boolean; error?: string } => {
      const maxSize = maxSizeMB * 1024 * 1024;
      if (file.size > maxSize) {
        return { valid: false, error: `הקובץ גדול מדי. מקסימום ${maxSizeMB}MB` };
      }
      if (!acceptedFormats.includes(file.type)) {
        return { valid: false, error: "פורמט לא נתמך. נא להעלות JPEG, PNG או WebP" };
      }
      return { valid: true };
    },
    [maxSizeMB, acceptedFormats]
  );

  const handleFile = useCallback(
    (file: File) => {
      const validation = validateFile(file);
      if (!validation.valid) {
        setLocalError(validation.error || "שגיאה בקובץ");
        return;
      }
      setLocalError(null);
      onChange(file);
    },
    [validateFile, onChange]
  );

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;

    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  };

  const handleRemove = () => {
    onChange(null);
    setLocalError(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  };

  const displayError = error || localError;

  return (
    <div className={cn("space-y-2", className)}>
      {label && (
        <label className="text-sm font-medium text-foreground">{label}</label>
      )}

      <div
        className={cn(
          "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors",
          sizeClasses[previewSize],
          isDragging && "border-primary bg-primary/5",
          displayError && "border-destructive",
          disabled && "opacity-50 cursor-not-allowed",
          !disabled && !preview && "cursor-pointer hover:border-primary hover:bg-muted/50"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !disabled && !preview && inputRef.current?.click()}
      >
        {preview ? (
          <>
            <img
              src={preview}
              alt="Preview"
              className="w-full h-full object-cover rounded-lg"
            />
            {!disabled && (
              <Button
                type="button"
                variant="destructive"
                size="icon"
                className="absolute -top-2 -right-2 h-6 w-6 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  handleRemove();
                }}
              >
                <X className="h-3 w-3" />
              </Button>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-muted-foreground p-4">
            <div className="rounded-full bg-muted p-3">
              <User className="h-6 w-6" />
            </div>
            <div className="text-center">
              <Upload className="h-4 w-4 mx-auto mb-1" />
              <span className="text-xs">העלאת תמונה</span>
            </div>
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={acceptedFormats.join(",")}
          onChange={handleInputChange}
          disabled={disabled}
          className="hidden"
        />
      </div>

      {description && !displayError && (
        <p className="text-xs text-muted-foreground">{description}</p>
      )}

      {displayError && (
        <p
          className="text-xs text-destructive flex items-center gap-1"
          role="alert"
          aria-live="polite"
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {displayError}
        </p>
      )}
    </div>
  );
}
