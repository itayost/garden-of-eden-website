---
name: Profile Image Upload 413 Fix
description: Fix 413 Request Entity Too Large error when uploading background-removed profile images
type: project
---

# Profile Image Upload — 413 Fix

## Problem

When an admin/trainer uploads a profile picture for a trainee, the flow succeeds through client-side background removal (Transformers.js) but fails at the upload step with HTTP 413 (Request Entity Too Large).

**Root cause:** The original JPEG (e.g. 686KB) may have dimensions of 2000×1500px. After background removal, the canvas exports a full-resolution RGBA PNG via `canvas.toBlob(..., "image/png", 1.0)`. A 2000×1500 RGBA PNG is ~12MB — well above Vercel's 4.5MB body size limit for Next.js API routes. The server-side `MAX_PROCESSED_SIZE = 10MB` validation never runs because Vercel rejects the request first.

**Why remove.bg is not an option:** A previous attempt using the `/api/images/process-background` route (remove.bg API) was dropped due to unresolved issues. The client-side ML pipeline (`Xenova/segformer_b2_clothes` via Transformers.js) is intentional.

## Solution

Pre-compress and resize the selected image **before** passing it to `removeBackground()` using the `browser-image-compression` library. A smaller input means a smaller canvas, which means a smaller output PNG — naturally and without changes to the background removal logic.

### Why this works

| | Before fix | After fix |
| --- | --- | --- |
| Input to ML | 2000×1500 (686KB JPEG) | 1200×900 (~250KB) |
| Canvas dimensions | 2000×1500 | 1200×900 |
| Output PNG size | ~12MB | ~1.2MB |
| Vercel 4.5MB limit | Exceeded → 413 | Well under |

### Why `browser-image-compression`

- `maxWidthOrHeight` + `maxSizeMB` options cover both dimension and size constraints
- `useWebWorker: true` runs off the main thread — no UI freeze during compression
- Handles EXIF orientation automatically (critical for mobile photos, which are often rotated)
- Returns a `File` object compatible with the existing `removeBackground(file)` call signature
- TypeScript types are bundled — no separate `@types/` package needed

### PNG input behaviour

`browser-image-compression` converts PNG inputs to JPEG when `maxSizeMB` is set, because PNG-to-PNG compression is often ineffective. This is acceptable: the `original` stored in Supabase becomes a JPEG regardless of input format, which is consistent with the primary JPEG use case and produces smaller files. The `fileType` option is left unset (library default).

## Affected Files

| File | Change |
| --- | --- |
| `package.json` | Add `browser-image-compression` dependency |
| `src/components/admin/users/TraineeImageUpload.tsx` | Add pre-compression step; update FormData to use compressed file as original |

No changes to:

- `useBackgroundRemoval.ts`
- Any API routes
- `TraineeImageSection.tsx`

## Implementation

### 1. Install dependency

```bash
npm install browser-image-compression
```

### 2. Modify `TraineeImageUpload.tsx`

#### 2a. Add import and compression config

```typescript
import imageCompression from "browser-image-compression";

const COMPRESSION_OPTIONS = {
  maxSizeMB: 3,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
} as const;
```

#### 2b. Replace `handleConfirmAndProcess`

The key changes are:

1. Call `imageCompression(selectedFile, COMPRESSION_OPTIONS)` first
2. Pass `compressedFile` to `removeBackground()` instead of `selectedFile`
3. Append `compressedFile` (not `selectedFile`) as `original` in the FormData

```typescript
const handleConfirmAndProcess = async () => {
  if (!selectedFile) return;
  setStep("processing");
  setError(null);

  try {
    // Step 1: Compress and resize before background removal.
    // This keeps canvas dimensions small → output PNG stays under Vercel's 4.5MB limit.
    let compressedFile: File;
    try {
      compressedFile = await imageCompression(selectedFile, COMPRESSION_OPTIONS);
    } catch {
      throw new Error("שגיאה בדחיסת התמונה. נסה שוב.");
    }

    // Step 2: Background removal (unchanged logic, smaller input)
    const processed = await removeBackground(compressedFile);

    if (!processed) {
      throw new Error(bgError || "שגיאה בעיבוד התמונה");
    }

    setProcessedBlob(processed);
    const processedUrl = URL.createObjectURL(processed);
    setProcessedPreviewUrl(processedUrl);

    // Step 3: Upload both images — use compressedFile as original (not selectedFile)
    setStep("uploading");

    const formData = new FormData();
    formData.append("original", compressedFile);           // changed from selectedFile
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
```

## Compression Parameters

| Option | Value | Rationale |
| --- | --- | --- |
| `maxWidthOrHeight` | `1200` | Sufficient for avatars and FIFA cards; reduces canvas area by ~64% vs 2000px |
| `maxSizeMB` | `3` | Best-effort ceiling well under Vercel's 4.5MB limit, leaving headroom for the FormData envelope. Note: this is best-effort — the library may overshoot on pathological inputs, but the server's independent `MAX_FILE_SIZE = 5MB` check on the original acts as a safety net. |
| `useWebWorker` | `true` | Non-blocking; runs in a background thread |

## Existing Validations Unaffected

- Client-side `MAX_FILE_SIZE = 5MB` gate on the raw input (before compression) is unchanged — users still see "עד 5MB" hint, which is correct since the input limit is 5MB
- Server-side `MAX_FILE_SIZE = 5MB` check on `original` and `MAX_PROCESSED_SIZE = 10MB` check on `processed` remain unchanged and act as server-level safety nets
- The `previewUrl` shown to the user is still created from `selectedFile` (the original uncompressed file) — this is intentional, the preview shows the full-quality image before processing

## Retry Path

If compression throws, the error is caught, `setStep("preview")` runs, and the retry button appears. `handleRetry` calls `handleConfirmAndProcess()` again, which re-runs compression on the original `selectedFile`. This is correct — `selectedFile` is never mutated, so retries are safe.

## Testing

- Upload a high-resolution JPEG (>2000px, any size) — should succeed end-to-end
- Upload a mobile photo taken in portrait orientation — EXIF rotation should be handled correctly (no upside-down or sideways stored image)
- Upload a PNG — stored original will be JPEG; verify this is acceptable
- Verify both original and processed images appear in Supabase Storage at reduced dimensions
- Verify background removal quality has not regressed
- Trigger a retry (e.g. by simulating a network error on the first attempt) — verify second attempt completes successfully

## Non-Goals

- Does not change the background removal model or quality
- Does not increase Vercel's body size limit
- Does not affect the `/api/images/process-background` (remove.bg) route
- Does not update the UI hint text "עד 5MB" — the 5MB input limit is unchanged
