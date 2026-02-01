# Phase 10: Trainee Image Management & FIFA Card Photos - Research

**Researched:** 2026-02-01
**Domain:** Image Upload, Background Removal APIs, Supabase Storage
**Confidence:** HIGH

## Summary

This phase implements trainee photo management where admins/coaches can upload photos that display as avatars across the app and as professional cutouts on FIFA-style player cards. The project already has significant infrastructure in place: an `avatars` Supabase Storage bucket with RLS policies, an `ImageUpload` component, storage utility functions, and a `PlayerCard` component that accepts `avatarUrl`.

The key new work involves:
1. Extending RLS policies to allow admin/coach uploads for trainees
2. Integrating a background removal API (remove.bg) for FIFA card cutouts
3. Creating a new API route for server-side image processing
4. Building the admin upload interface with preview and processing feedback

**Primary recommendation:** Use remove.bg API for background removal via a Next.js API route, store both original and processed images in Supabase Storage, extend existing `storage.ts` utilities, and add an image upload section to the existing user edit page.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Supabase Storage | Current | Image storage with RLS | Already in use in project |
| remove.bg | npm latest | Background removal API | Industry standard, 50 free/month, TypeScript support |
| @radix-ui/react-avatar | ^1.x | Avatar component primitives | Already in use in project |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js API Routes | 15.x | Server-side image processing | Secure API key handling for remove.bg |
| sharp (optional) | ^0.33.x | Image optimization/resizing | Only if local image processing needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| remove.bg | Photoroom API | Similar pricing, remove.bg has better docs/npm wrapper |
| remove.bg | Clipdrop API | Good quality but less established npm support |
| remove.bg | rembg (local) | Free but requires Python runtime, not serverless-friendly |
| API route | Server Action | FormData in Server Actions works but API route gives more control for streaming/progress |

**Installation:**
```bash
npm install remove.bg
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/
│   └── api/
│       └── images/
│           └── process-background/
│               └── route.ts        # Background removal API endpoint
├── components/
│   └── admin/
│       └── users/
│           └── TraineeImageUpload.tsx  # Admin upload component
├── lib/
│   └── utils/
│       └── storage.ts              # Extend with processed image functions
└── types/
    └── database.ts                 # Add trainee_images table type if needed
```

### Pattern 1: Dual Image Storage (Original + Processed)
**What:** Store two versions of each trainee image - original for avatars, processed for FIFA cards
**When to use:** When different use cases require different image treatments
**Example:**
```typescript
// Source: CONTEXT.md decisions
interface TraineeImage {
  userId: string;
  originalUrl: string;      // Full photo with background - used for avatars
  processedUrl: string;     // Cutout version - used for FIFA cards
  createdAt: string;
  updatedAt: string;
}

// profiles.avatar_url points to originalUrl
// player_stats.avatar_url points to processedUrl
```

### Pattern 2: Server-Side API Processing
**What:** Use Next.js API route for background removal to keep API keys secure
**When to use:** When calling external APIs with secret keys
**Example:**
```typescript
// Source: Context7 Supabase docs + remove.bg npm docs
// src/app/api/images/process-background/route.ts
import { removeBackgroundFromImageBase64 } from "remove.bg";

export async function POST(request: NextRequest) {
  // 1. Verify admin/coach role
  // 2. Receive image as base64 or FormData
  // 3. Call remove.bg API
  // 4. Upload both original and processed to Supabase Storage
  // 5. Return URLs
}
```

### Pattern 3: Preview Before Upload with Confirm/Reject
**What:** Show selected image preview, then show processed cutout result before final save
**When to use:** When processing is expensive and user should approve result
**Example:**
```typescript
// Source: CONTEXT.md decisions
const [step, setStep] = useState<'select' | 'preview' | 'processing' | 'result'>('select');

// Step flow:
// 1. select: User picks file
// 2. preview: Show original image with confirm/cancel
// 3. processing: Call API, show spinner
// 4. result: Show cutout, offer "Save" or "Try another photo"
```

### Anti-Patterns to Avoid
- **Client-side API calls:** Never expose remove.bg API key to browser
- **Single image storage:** Don't use same image for avatar and FIFA card (different requirements per CONTEXT.md)
- **Blocking on processing failure:** Per CONTEXT.md, don't save unprocessed image - show error and retry
- **Processing before preview:** Per CONTEXT.md, show original preview before starting background removal

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Background removal | Edge detection algorithm | remove.bg API | ML-based, handles hair/transparency correctly |
| Image preview | Manual FileReader | URL.createObjectURL() | Already used in existing ImageUpload component |
| Avatar with fallback | Custom component | @radix-ui/react-avatar | Already in project, handles fallback gracefully |
| Storage RLS | Custom auth checks | Supabase Storage policies | Declarative, database-enforced security |
| Image transformations | Server-side resize | Supabase Storage transforms | Built-in, cached at edge (Pro plan) |

**Key insight:** The project already has most primitives - the work is extending them for admin uploads and adding background removal integration.

## Common Pitfalls

### Pitfall 1: RLS Policy for Cross-User Upload
**What goes wrong:** Admin tries to upload to trainee's folder, RLS blocks it
**Why it happens:** Current policies only allow users to upload to their own user_id folder
**How to avoid:** Add admin/coach override policies:
```sql
-- Allow admin/coach to upload to any user's folder
CREATE POLICY "Admins can upload trainee avatars"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'avatars' AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role IN ('admin', 'trainer')
  )
);
```
**Warning signs:** 403 errors when admin uploads for trainee

### Pitfall 2: remove.bg API Rate Limits
**What goes wrong:** Bulk uploads hit rate limit (500 images/minute scaled by resolution)
**Why it happens:** High-resolution images reduce effective rate limit
**How to avoid:**
- Resize images before sending to API (client-side)
- Implement retry with exponential backoff
- Handle HTTP 429 gracefully with "Retry-After" header
**Warning signs:** 429 responses, X-RateLimit-Remaining header approaching 0

### Pitfall 3: Large File Processing Timeout
**What goes wrong:** API route times out during background removal
**Why it happens:** remove.bg processing + Supabase upload exceeds default timeout
**How to avoid:**
- Validate file size before upload (5MB per CONTEXT.md)
- Consider async processing with status polling for large images
- Set appropriate API route timeout (Vercel default is 10s for hobby)
**Warning signs:** 504 Gateway Timeout errors

### Pitfall 4: Memory Issues with Base64
**What goes wrong:** Large images encoded as base64 cause memory issues
**Why it happens:** Base64 increases size by ~33%, held in memory during processing
**How to avoid:**
- Stream directly to remove.bg when possible (use `removeBackgroundFromImageFile`)
- For API route, accept FormData and process as buffer
**Warning signs:** Out of memory errors, slow response times

### Pitfall 5: Inconsistent Avatar States
**What goes wrong:** Avatar shows in some places but not others after upload
**Why it happens:** Different components read from different sources (profile vs player_stats)
**How to avoid:**
- Update both `profiles.avatar_url` AND `player_stats.avatar_url` atomically
- Use transaction or ensure both updates succeed
- Revalidate paths after upload
**Warning signs:** Dashboard shows avatar but FIFA card doesn't, or vice versa

## Code Examples

Verified patterns from official sources:

### Upload File to Supabase Storage
```typescript
// Source: Context7 /supabase/supabase-js
const { data: uploadData, error: uploadError } = await supabase.storage
  .from('avatars')
  .upload(`${userId}/${timestamp}.png`, file, {
    cacheControl: '3600',
    upsert: false,
    contentType: 'image/png'
  });

if (uploadData) {
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(uploadData.path);
  // urlData.publicUrl contains the URL
}
```

### Remove Background with remove.bg
```typescript
// Source: https://github.com/EddyVerbruggen/remove.bg
import { removeBackgroundFromImageBase64 } from "remove.bg";

const result = await removeBackgroundFromImageBase64({
  base64img: imageBase64,  // Without data:image/... prefix
  apiKey: process.env.REMOVEBG_API_KEY!,
  size: "regular",         // preview, regular, medium, hd, full, auto
  type: "person",          // auto, person, product, car
  format: "png",           // png for transparency
});

// result.base64img contains the processed image
```

### Preview Image Before Upload (Existing Pattern)
```typescript
// Source: src/components/ui/image-upload.tsx (project code)
const [preview, setPreview] = useState<string | null>(null);

useEffect(() => {
  if (file instanceof File) {
    const objectUrl = URL.createObjectURL(file);
    setPreview(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }
}, [file]);
```

### Admin Storage RLS Policy
```sql
-- Source: Context7 /supabase/supabase
CREATE POLICY "Admins can manage all avatars"
ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'avatars' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
)
WITH CHECK (
  bucket_id = 'avatars' AND
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
);
```

### Supabase Image Transformation (Pro Plan)
```typescript
// Source: Context7 /supabase/supabase
// Get resized image URL for avatars
const { data } = supabase.storage.from('avatars').getPublicUrl('image.jpg', {
  transform: {
    width: 200,
    height: 200,
    resize: 'cover'  // 'cover' | 'contain' | 'fill'
  },
});
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Client-side background removal | Server-side API | 2024 | Better quality, secure API keys |
| Single image for all uses | Separate original + processed | Best practice | Different requirements for avatar vs FIFA card |
| Manual image optimization | Supabase Storage transforms | 2023 | Automatic resizing, caching |
| Direct Supabase upload from browser | Upload via API route | For processing | Required for background removal step |

**Deprecated/outdated:**
- Using canvas-based edge detection for background removal (poor quality)
- Storing only processed image (loses original)

## Open Questions

Things that couldn't be fully resolved:

1. **Supabase Storage bucket for processed images**
   - What we know: Can use same `avatars` bucket with different folder structure
   - What's unclear: Should processed images be in separate bucket for cleaner organization?
   - Recommendation: Use same bucket with folder structure: `{userId}/original/` and `{userId}/processed/`

2. **remove.bg credit consumption**
   - What we know: 50 free credits/month, then paid
   - What's unclear: Expected monthly upload volume
   - Recommendation: Monitor usage, implement credit check before processing

3. **Existing avatar_url references**
   - What we know: `profiles.avatar_url` and `player_stats.avatar_url` both exist
   - What's unclear: Current data integrity between these fields
   - Recommendation: Audit existing data, determine if migration needed

## Sources

### Primary (HIGH confidence)
- Context7 /supabase/supabase - Storage upload, RLS policies, image transformations
- Context7 /supabase/supabase-js - Storage API, bucket creation
- https://github.com/EddyVerbruggen/remove.bg - npm package documentation
- https://www.remove.bg/api - Official API documentation

### Secondary (MEDIUM confidence)
- https://dev.to/marufrahmanlive/nextjs-server-actions-complete-guide-with-examples-for-2026-2do0 - Next.js Server Actions patterns
- https://dev.to/mukul_sharma/best-remove-image-background-apis-features-pricing-accuracy-3le1 - API comparison

### Tertiary (LOW confidence)
- Web search results for pricing comparisons - Verify current pricing on official sites

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Supabase docs verified, remove.bg npm tested
- Architecture: HIGH - Follows existing project patterns
- Pitfalls: MEDIUM - Based on common patterns, project-specific issues may vary

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - remove.bg pricing/API may update)

---

## Project-Specific Context

### Existing Infrastructure (Verified)
- **Storage bucket:** `avatars` exists with 2MB limit, JPG/PNG/WebP allowed, public
- **RLS policies:** Users can upload/update/delete own avatar, all can view
- **ImageUpload component:** Full-featured with preview, drag-drop, validation
- **storage.ts utilities:** `uploadProfilePhoto`, `deleteProfilePhoto`, `getAvatarUrl`
- **PlayerCard component:** Already accepts `avatarUrl` prop, shows initials fallback

### CONTEXT.md Decisions (Locked)
- Upload method: Click to browse (no drag-drop per discussion)
- Preview: Show before upload with confirm/cancel
- Processing failure: Block and retry, don't save unprocessed
- Result preview: Show cutout before saving with "Try another photo" option
- Avatar source: Original photo (not cutout)
- FIFA card: Processed cutout, centered, transparent background visible
- No image fallback: User initials (same as current default)

### Database Schema Notes
- `profiles.avatar_url`: Currently used for avatar display
- `player_stats.avatar_url`: Exists but may not be consistently populated
- Consider: New `trainee_images` table or extend profiles with `processed_avatar_url`
