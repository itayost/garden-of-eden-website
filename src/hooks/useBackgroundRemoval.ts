"use client";

import { useState, useCallback, useRef } from "react";

type ProgressStatus = "idle" | "loading-model" | "processing" | "complete" | "error";

interface BackgroundRemovalResult {
  removeBackground: (imageFile: File) => Promise<Blob | null>;
  isProcessing: boolean;
  progress: number;
  status: ProgressStatus;
  error: string | null;
  reset: () => void;
}

// Type for segmentation result
interface SegmentationResult {
  label: string;
  score?: number;
  mask: {
    width: number;
    height: number;
    channels: number;
    data: Uint8Array | Uint8ClampedArray;
    toCanvas: () => HTMLCanvasElement;
  };
}

// Type for the segmenter function
type SegmenterFunction = (input: string) => Promise<SegmentationResult[]>;

/**
 * Hook for client-side background removal using Transformers.js
 * Runs entirely in the browser - no API keys needed
 */
export function useBackgroundRemoval(): BackgroundRemovalResult {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<ProgressStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  // Cache the segmenter pipeline
  const segmenterRef = useRef<SegmenterFunction | null>(null);

  const reset = useCallback(() => {
    setIsProcessing(false);
    setProgress(0);
    setStatus("idle");
    setError(null);
  }, []);

  const removeBackground = useCallback(async (imageFile: File): Promise<Blob | null> => {
    setIsProcessing(true);
    setProgress(5);
    setStatus("loading-model");
    setError(null);

    try {
      // Dynamic import to avoid loading on pages that don't need it
      const { pipeline, RawImage } = await import("@huggingface/transformers");
      setProgress(15);

      // Create or reuse segmentation pipeline
      let segmenter = segmenterRef.current;

      if (!segmenter) {
        const createdPipeline = await pipeline(
          "image-segmentation",
          "Xenova/segformer_b2_clothes",
          {
            progress_callback: (p: unknown) => {
              const progressInfo = p as { progress?: number } | undefined;
              if (progressInfo?.progress !== undefined) {
                // Model loading progress: 15-60%
                setProgress(15 + Math.round(progressInfo.progress * 0.45));
              }
            },
          }
        );
        segmenter = createdPipeline as unknown as SegmenterFunction;
        segmenterRef.current = segmenter;
      }

      setProgress(60);
      setStatus("processing");

      // Process image
      const imageUrl = URL.createObjectURL(imageFile);

      try {
        const result = await segmenter(imageUrl);
        setProgress(75);

        // Load the raw image
        const rawImage = await RawImage.fromURL(imageUrl);
        setProgress(80);

        // Find non-background masks (foreground)
        const foregroundMasks = result.filter(
          (x: SegmentationResult) => x.label !== "Background"
        );

        if (foregroundMasks.length === 0) {
          throw new Error("לא זוהה אדם בתמונה");
        }

        setProgress(85);

        // Create output canvas with transparency
        const canvas = document.createElement("canvas");
        canvas.width = rawImage.width;
        canvas.height = rawImage.height;
        const ctx = canvas.getContext("2d");

        if (!ctx) {
          throw new Error("Failed to create canvas context");
        }

        // Draw original image
        const originalCanvas = rawImage.toCanvas();
        ctx.drawImage(originalCanvas, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const pixels = imageData.data;

        // Create combined mask from all foreground segments
        const combinedMask = new Uint8Array(canvas.width * canvas.height);

        for (const segment of foregroundMasks) {
          const maskData = segment.mask.data;
          for (let i = 0; i < combinedMask.length; i++) {
            // If any foreground mask has this pixel, keep it
            if (maskData[i] > 0) {
              combinedMask[i] = 255;
            }
          }
        }

        // Apply mask - set alpha to 0 for background pixels
        for (let i = 0; i < combinedMask.length; i++) {
          const pixelIndex = i * 4;
          if (combinedMask[i] === 0) {
            // Background pixel - make transparent
            pixels[pixelIndex + 3] = 0;
          }
        }

        // Put modified image data back
        ctx.putImageData(imageData, 0, 0);

        setProgress(90);

        // Convert to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b: Blob | null) => {
              if (b) resolve(b);
              else reject(new Error("Failed to create blob"));
            },
            "image/png",
            1.0
          );
        });

        setProgress(100);
        setStatus("complete");
        setIsProcessing(false);

        return blob;
      } finally {
        URL.revokeObjectURL(imageUrl);
      }
    } catch (err) {
      console.error("[useBackgroundRemoval] Error:", err);
      const errorMessage = err instanceof Error ? err.message : "שגיאה בעיבוד התמונה";
      setError(errorMessage);
      setStatus("error");
      setIsProcessing(false);
      return null;
    }
  }, []);

  return { removeBackground, isProcessing, progress, status, error, reset };
}
