# Phase 5: Auth Enhancements - Research

**Researched:** 2026-02-01
**Domain:** Supabase Auth - Password Reset & MFA/TOTP
**Confidence:** HIGH

## Summary

This phase adds password reset and two-factor authentication (2FA) to the existing auth system. Research reveals a critical architectural consideration: **the current app uses only OTP-based (passwordless) authentication** via email and phone. There are no passwords stored for users, which means:

1. **"Forgot Password" requires adding password-based auth first** - Users need an email+password or phone+password option before password reset makes sense
2. **OTP-based recovery is already available** - Users can re-authenticate via OTP to their email/phone at any time
3. **MFA/2FA with TOTP is well-supported** by Supabase and can be added to any auth method

Supabase provides comprehensive MFA APIs including `enroll()`, `challenge()`, `verify()`, `listFactors()`, and `unenroll()`. TOTP is free and enabled by default on all Supabase projects. Importantly, **Supabase does NOT provide built-in backup codes** - they recommend enrolling a secondary TOTP factor or phone factor instead.

**Primary recommendation:** Add optional password-based auth alongside existing OTP, implement password reset flow, then add TOTP-based 2FA. For recovery, offer secondary factor enrollment rather than backup codes.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| @supabase/supabase-js | ^2.89.0 | Auth client APIs | Already installed, provides full MFA API |
| @supabase/ssr | ^0.8.0 | Server-side auth | Already installed, handles session management |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| zod | ^4.2.1 | Form validation | Already installed, use for password strength validation |
| react-hook-form | ^7.69.0 | Form state | Already installed, use for auth forms |
| sonner | ^2.0.7 | Toast notifications | Already installed, use for success/error feedback |

### No Additional Installation Needed
All required libraries are already present in the project. Supabase MFA TOTP API is free and enabled by default.

**Installation:**
```bash
# No additional packages needed
```

## Architecture Patterns

### Recommended Project Structure
```
src/
├── app/auth/
│   ├── login/page.tsx              # Existing - add forgot password link
│   ├── verify/page.tsx             # Existing - OTP verification
│   ├── callback/route.ts           # Existing - OAuth callback
│   ├── forgot-password/page.tsx    # NEW - Request password reset
│   ├── reset-password/page.tsx     # NEW - Set new password (from email link)
│   └── verify-2fa/page.tsx         # NEW - 2FA challenge during login
├── app/dashboard/
│   └── settings/
│       └── security/page.tsx       # NEW - 2FA setup & password management
├── components/
│   └── auth/
│       ├── TwoFactorSetup.tsx      # NEW - QR code enrollment flow
│       ├── TwoFactorVerify.tsx     # NEW - TOTP code entry
│       └── PasswordStrength.tsx    # NEW - Password requirements indicator
└── lib/
    └── auth/
        └── mfa.ts                  # NEW - MFA helper functions
```

### Pattern 1: Password Reset Flow (Magic Link Style)
**What:** User requests password reset via email, receives magic link, lands on reset page
**When to use:** Standard password recovery
**Example:**
```typescript
// Source: Supabase Auth documentation
// Step 1: Request reset (forgot-password page)
await supabase.auth.resetPasswordForEmail(email, {
  redirectTo: `${window.location.origin}/auth/reset-password`,
})

// Step 2: Update password (reset-password page)
// User arrives via magic link, already authenticated
await supabase.auth.updateUser({ password: newPassword })
```

### Pattern 2: MFA Enrollment Flow
**What:** Three-step process: enroll -> challenge -> verify
**When to use:** Setting up TOTP for the first time
**Example:**
```typescript
// Source: Supabase MFA TOTP documentation
// Step 1: Enroll - generates QR code
const { data, error } = await supabase.auth.mfa.enroll({
  factorType: 'totp',
  friendlyName: 'Authenticator App'
})
// data.totp.qr_code contains SVG to display
// data.id is the factorId for subsequent steps

// Step 2: Challenge - prepares for verification
const { data: challengeData } = await supabase.auth.mfa.challenge({
  factorId: data.id
})

// Step 3: Verify - user enters code from authenticator app
await supabase.auth.mfa.verify({
  factorId: data.id,
  challengeId: challengeData.id,
  code: userEnteredCode
})
```

### Pattern 3: MFA-Aware Login Flow
**What:** Check AAL after login, show 2FA challenge if needed
**When to use:** Login when user has MFA enabled
**Example:**
```typescript
// Source: Supabase MFA documentation
// After successful first-factor login:
const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

if (data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel) {
  // User has MFA enrolled but hasn't verified yet this session
  // Redirect to 2FA verification page
  router.push('/auth/verify-2fa')
}
```

### Pattern 4: Factor Management (Unenroll)
**What:** Allow users to disable MFA
**When to use:** Settings page for security management
**Example:**
```typescript
// Source: Supabase MFA documentation
// List all factors
const { data: factors } = await supabase.auth.mfa.listFactors()
const totpFactors = factors.totp // array of TOTP factors

// Unenroll a specific factor
await supabase.auth.mfa.unenroll({ factorId: factorToRemove.id })

// After unenroll, session downgrades from aal2 to aal1
// Call refreshSession() for immediate downgrade
await supabase.auth.refreshSession()
```

### Anti-Patterns to Avoid
- **Storing backup codes in client-side storage:** Security risk - if needed, store server-side only
- **Auto-enrolling MFA without user consent:** Always make MFA opt-in
- **Skipping AAL check after login:** Users with MFA can access protected resources without 2FA
- **Hard-coding redirect URLs:** Always configure in Supabase dashboard AND use environment variables

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| QR code generation | Custom QR library | `supabase.auth.mfa.enroll()` | Returns SVG directly, handles encoding |
| TOTP validation | Time-based OTP logic | `supabase.auth.mfa.verify()` | Server-side validation, timing attacks handled |
| Password hashing | bcrypt/argon2 | Supabase Auth | Automatic, secure, maintained |
| Session management | Custom JWT logic | @supabase/ssr | Cookie handling, refresh tokens |
| Rate limiting | Custom throttling | Supabase built-in | Auth has rate limits by default |

**Key insight:** Supabase Auth handles all cryptographic operations server-side. Client code only needs to call APIs and handle UI.

## Common Pitfalls

### Pitfall 1: Missing Redirect URL Configuration
**What goes wrong:** Password reset emails link to wrong URL or fail
**Why it happens:** redirectTo URLs must be allowlisted in Supabase dashboard
**How to avoid:**
1. Configure Site URL in Supabase Auth settings
2. Add all valid redirect URLs (localhost for dev, production domain)
3. Use environment variables for redirectTo parameter
**Warning signs:** "Invalid redirect URL" errors, users landing on wrong pages

### Pitfall 2: AAL Check Timing
**What goes wrong:** MFA users can access protected content without 2FA
**Why it happens:** AAL check not performed after login, or performed too late
**How to avoid:** Check AAL immediately after sign-in, before redirecting to protected routes
**Warning signs:** Users with MFA enabled skip the 2FA step

### Pitfall 3: No Secondary Recovery Factor
**What goes wrong:** Users locked out when they lose their authenticator device
**Why it happens:** Supabase doesn't provide backup codes - developers assume they exist
**How to avoid:**
1. Encourage users to enroll a secondary factor (second TOTP app or phone)
2. Consider implementing custom backup codes in database (if absolutely needed)
3. Clearly warn users during enrollment about recovery options
**Warning signs:** Support requests from locked-out users

### Pitfall 4: Password Requirements Not Enforced Client-Side
**What goes wrong:** Supabase rejects weak passwords with generic error
**Why it happens:** Only relying on server-side validation
**How to avoid:** Implement real-time password strength indicator with zod validation
**Warning signs:** Poor UX, users frustrated by unclear password requirements

### Pitfall 5: Hebrew RTL in Auth Forms
**What goes wrong:** OTP inputs, password fields display incorrectly
**Why it happens:** Mixed RTL (Hebrew text) and LTR (input values) content
**How to avoid:** Use `dir="ltr"` on input fields, keep labels RTL
**Warning signs:** Numbers appear reversed, cursor jumps unexpectedly

## Code Examples

Verified patterns from official sources:

### Complete Password Reset Flow
```typescript
// Source: Supabase Auth documentation - passwords.mdx

// forgot-password/page.tsx - Request reset
'use client'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

async function handleForgotPassword(email: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  })

  if (error) {
    toast.error('שגיאה בשליחת הודעת איפוס')
    return
  }

  toast.success('נשלח אליך קישור לאיפוס סיסמה')
}

// reset-password/page.tsx - Set new password
// User arrives via email link, already authenticated via magic link
async function handleResetPassword(newPassword: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) {
    toast.error('שגיאה בעדכון הסיסמה')
    return
  }

  toast.success('הסיסמה עודכנה בהצלחה')
  router.push('/dashboard')
}
```

### MFA Enrollment Component
```typescript
// Source: Supabase MFA TOTP documentation

'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function TwoFactorSetup({ onEnrolled }: { onEnrolled: () => void }) {
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [verifyCode, setVerifyCode] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    const enrollFactor = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.enroll({
        factorType: 'totp',
        friendlyName: 'Authenticator App'
      })

      if (error) {
        setError(error.message)
        return
      }

      setFactorId(data.id)
      setQrCode(data.totp.qr_code) // SVG string
    }

    enrollFactor()
  }, [])

  const handleVerify = async () => {
    const supabase = createClient()

    // Create challenge
    const { data: challengeData, error: challengeError } =
      await supabase.auth.mfa.challenge({ factorId })

    if (challengeError) {
      setError(challengeError.message)
      return
    }

    // Verify the code
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challengeData.id,
      code: verifyCode
    })

    if (verifyError) {
      setError(verifyError.message)
      return
    }

    onEnrolled()
  }

  return (
    <div>
      {error && <div className="text-red-500">{error}</div>}
      {qrCode && (
        <div
          dangerouslySetInnerHTML={{ __html: qrCode }}
          className="w-48 h-48"
        />
      )}
      <input
        type="text"
        dir="ltr"
        value={verifyCode}
        onChange={(e) => setVerifyCode(e.target.value)}
        placeholder="123456"
        maxLength={6}
      />
      <button onClick={handleVerify}>אמת והפעל</button>
    </div>
  )
}
```

### AAL Check Hook
```typescript
// Source: Supabase MFA documentation

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useAALCheck() {
  const [needsMFA, setNeedsMFA] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const checkAAL = async () => {
      const supabase = createClient()
      const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel()

      if (!error && data) {
        // Need MFA if nextLevel is aal2 but current isn't
        setNeedsMFA(data.nextLevel === 'aal2' && data.currentLevel !== data.nextLevel)
      }

      setLoading(false)
    }

    checkAAL()
  }, [])

  return { needsMFA, loading }
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Custom TOTP libraries | Built-in Supabase MFA | 2022 | No external dependencies needed |
| Recovery codes | Secondary factor enrollment | Current | Users need backup TOTP instead |
| Email-only recovery | Email + Phone + TOTP options | Current | More flexible recovery paths |

**Deprecated/outdated:**
- Custom backup code implementations: Supabase recommends secondary factors instead
- Manual QR code generation: Use `enroll()` which returns SVG directly

## Open Questions

Things that couldn't be fully resolved:

1. **Custom Backup Codes Implementation**
   - What we know: Supabase doesn't provide backup codes natively
   - What's unclear: Best practice for implementing custom backup codes if business requires them
   - Recommendation: Start with secondary factor approach (recommended by Supabase). If backup codes are absolutely required, implement as a database table with hashed one-time codes, but this adds complexity.

2. **Password-Based Auth Migration**
   - What we know: Current users have OTP-only accounts (no password set)
   - What's unclear: Whether to require password setup for existing users or make it optional
   - Recommendation: Make password setup optional. Existing OTP flow continues to work. Users who want 2FA or password login can add it in settings.

3. **Phone vs Email Priority for Recovery**
   - What we know: App supports both phone and email OTP
   - What's unclear: Which should be primary recovery method
   - Recommendation: Let Claude's discretion decide based on existing codebase patterns. Email is currently the first tab in login.

## Critical Architectural Note

**The current app is passwordless.** This affects phase implementation:

### Current State
- Users authenticate via OTP (email or phone)
- No passwords are stored
- Re-authentication works via new OTP

### Required for "Forgot Password"
Password reset only makes sense if users have passwords. Options:
1. **Add optional password auth** - Let users set a password in settings, then forgot password link appears
2. **Reframe as "Account Recovery"** - Since OTP already works for recovery, focus on 2FA only

### Recommendation
Add optional password-based auth as an alternative login method:
1. Update login page to support email+password in addition to OTP
2. Add "set password" option in user settings (for users who want it)
3. Once a user has a password, show "forgot password" link on login
4. Users without passwords continue using OTP as before

## Sources

### Primary (HIGH confidence)
- Context7 /supabase/supabase - Password reset, MFA enrollment, verification flows
- Context7 /supabase/supabase - AAL check, factor management
- Supabase MFA Documentation - Backup codes/secondary factor recommendation

### Secondary (MEDIUM confidence)
- [Supabase MFA Documentation](https://supabase.com/docs/guides/auth/auth-mfa/totp) - TOTP implementation details
- [Supabase Password Authentication](https://supabase.com/docs/guides/auth/passwords) - Password reset flow
- [Supabase Multi-factor Authentication](https://supabase.com/docs/guides/platform/multi-factor-authentication) - Platform MFA (confirmed no recovery codes)

### Tertiary (LOW confidence)
- WebSearch findings on backup code alternatives - Verified against official Supabase position

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Using existing installed packages, verified APIs
- Architecture: HIGH - Patterns from official Supabase documentation
- Password reset: HIGH - Well-documented standard flow
- MFA/TOTP: HIGH - Verified against official docs and Context7
- Backup codes: MEDIUM - Confirmed Supabase doesn't provide them, but custom implementation needs validation
- Pitfalls: MEDIUM - Mix of docs and experience

**Research date:** 2026-02-01
**Valid until:** 2026-03-01 (30 days - Supabase Auth is stable)
