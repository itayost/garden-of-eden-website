# Phase 5: Auth Enhancements - Context

**Gathered:** 2026-02-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Add forgot password flow and two-factor authentication (2FA) to the existing auth system. Users can recover their accounts via password reset and optionally enable 2FA for additional security.

**In scope:**
- Forgot password link on login page
- Password reset flow (request + reset pages)
- 2FA setup in user settings
- TOTP support (Google Authenticator, etc.)
- Backup codes for 2FA recovery
- 2FA verification during login

**Out of scope:**
- Social login (OAuth)
- Single sign-on (SSO)
- Passwordless authentication
- Session management changes

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation decisions deferred to Claude:
- Recovery method (OTP vs magic link vs both)
- Email vs SMS priority for recovery
- 2FA setup UX (QR code presentation, confirmation flow)
- 2FA login experience (separate page vs modal)
- "Remember this device" functionality
- Backup codes quantity and regeneration flow
- Error messaging and rate limiting UX

**Guidance:** Follow Supabase Auth best practices and existing codebase patterns. Prioritize security over convenience. Use Hebrew for user-facing text consistent with existing app.

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches following Supabase Auth documentation.

</specifics>

<deferred>
## Deferred Ideas

None — discussion skipped at user request.

</deferred>

---

*Phase: 05-auth-enhancements*
*Context gathered: 2026-02-01*
