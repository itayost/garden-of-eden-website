# Profile Image Upload 413 Fix — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix HTTP 413 errors when uploading background-removed profile images by pre-compressing the input image before passing it to the background removal pipeline.

**Architecture:** Install `browser-image-compression`, then add a single compression step at the top of `handleConfirmAndProcess` in `TraineeImageUpload.tsx`. The compressed file replaces the raw `selectedFile` as both the input to `removeBackground()` and the `original` field in the FormData upload. No other files change.

**Tech Stack:** `browser-image-compression` (npm), Vitest (existing), React 19, TypeScript strict, Next.js 16 App Router.

---

## Chunk 1: Install and Implement

### Task 1: Install `browser-image-compression`

**Files:**
- Modify: `package.json` (dependency added by npm)

- [ ] **Step 1: Install the package**

```bash
npm install browser-image-compression
```

Expected output: package added, `package.json` + `package-lock.json` updated. No peer dependency warnings expected.

- [ ] **Step 2: Verify TypeScript types are available (bundled — no `@types/` needed)**

```bash
npx tsc --noEmit
```

Expected: same output as before (zero new errors). The library ships its own types.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add browser-image-compression dependency"
```

---

### Task 2: Pre-compress input in `TraineeImageUpload.tsx`

**Files:**
- Modify: `src/components/admin/users/TraineeImageUpload.tsx`

The current `handleConfirmAndProcess` passes `selectedFile` directly to `removeBackground()`. After this task it will:
1. Compress `selectedFile` first (max 1200px, max 3MB, WebWorker)
2. Pass the compressed file to `removeBackground()`
3. Send the compressed file as `original` in FormData (not the raw `selectedFile`)

- [ ] **Step 1: Add import at the top of the file**

Open `src/components/admin/users/TraineeImageUpload.tsx`.

After the existing imports (currently ending around line 7 with `useBackgroundRemoval`), add:

```typescript
import imageCompression from "browser-image-compression";
```

- [ ] **Step 2: Add compression constants after the existing `MAX_FILE_SIZE` and `ACCEPTED_TYPES` constants**

The existing constants are around lines 18–19:
```typescript
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
```

Add immediately after:

```typescript
const COMPRESSION_OPTIONS = {
  maxSizeMB: 3,
  maxWidthOrHeight: 1200,
  useWebWorker: true,
} as const;
```

- [ ] **Step 3: Replace `handleConfirmAndProcess`**

The current function starts at around line 85. Replace it entirely with:

```typescript
const handleConfirmAndProcess = async () => {
  if (!selectedFile) return;

  setStep("processing");
  setError(null);

  try {
    // Compress and resize before background removal.
    // Keeps canvas dimensions small → output PNG stays under Vercel's 4.5MB limit.
    let compressedFile: File;
    try {
      compressedFile = await imageCompression(selectedFile, COMPRESSION_OPTIONS);
    } catch {
      throw new Error("שגיאה בדחיסת התמונה. נסה שוב.");
    }

    // Process background removal (unchanged logic, smaller input)
    const processed = await removeBackground(compressedFile);

    if (!processed) {
      throw new Error(bgError || "שגיאה בעיבוד התמונה");
    }

    setProcessedBlob(processed);
    const processedUrl = URL.createObjectURL(processed);
    setProcessedPreviewUrl(processedUrl);

    // Upload both images — use compressedFile as original (not selectedFile)
    setStep("uploading");

    const formData = new FormData();
    formData.append("original", compressedFile);
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

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: zero new errors or warnings.

- [ ] **Step 6: Run existing tests to confirm no regression**

```bash
npm run test:run
```

Expected: all tests pass (no test files changed, utility tests unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/components/admin/users/TraineeImageUpload.tsx
git commit -m "fix(images): pre-compress input before background removal to fix 413"
```

---

### Task 3: Manual verification

These steps must be done in a browser against the running dev or production environment.

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to any trainee's admin page**

Go to `/admin/users/[traineeId]` and open the profile picture upload sheet.

- [ ] **Step 3: Upload a high-resolution JPEG (the original failing case)**

Use the same image that was producing the 413. Expected: the upload completes end-to-end and both images appear in the result step without error.

- [ ] **Step 4: Verify stored image dimensions are reduced**

In Supabase Storage → `avatars` bucket, find the newly uploaded `original` and `processed` files. Confirm the original is ≤1200px on its longest side.

- [ ] **Step 5: Upload a mobile portrait photo (EXIF rotation test)**

Take or find a portrait photo taken with a phone (often stored rotated in EXIF). Upload it. Expected: the stored image is correctly oriented, not sideways or upside-down.

- [ ] **Step 6: Confirm background removal quality is unchanged**

The processed image should have clean background removal. No regression from the compression step (1200px is more than enough for the segmentation model).

- [ ] **Step 7: Open browser DevTools and confirm no 413 in the Network tab**

`/api/images/upload-trainee-images` should return 200.
