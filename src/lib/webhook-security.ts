/**
 * Webhook Security Utility
 *
 * Provides HMAC-SHA256 signature verification for webhooks.
 * Includes replay protection via timestamp validation.
 */

import * as crypto from "crypto";

/**
 * Result of webhook signature verification
 */
export interface WebhookVerificationResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** Error message if validation failed */
  error?: string;
}

/**
 * Verify a webhook signature using HMAC-SHA256.
 *
 * @param rawBody - The raw request body as a string
 * @param signature - The signature from the webhook header (hex encoded)
 * @param secret - The shared secret for HMAC computation
 * @param timestamp - Optional timestamp for replay protection (Unix seconds as string)
 * @param toleranceSeconds - Maximum age of the webhook in seconds (default: 300 = 5 minutes)
 * @returns Verification result with valid flag and optional error message
 *
 * @example
 * ```ts
 * const result = verifyWebhookSignature(
 *   rawBody,
 *   req.headers.get('x-signature'),
 *   process.env.WEBHOOK_SECRET!,
 *   req.headers.get('x-timestamp')
 * );
 *
 * if (!result.valid) {
 *   return new Response(result.error, { status: 401 });
 * }
 * ```
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
  secret: string,
  timestamp: string | null = null,
  toleranceSeconds: number = 300
): WebhookVerificationResult {
  // Check for missing signature
  if (!signature) {
    return { valid: false, error: "Missing signature" };
  }

  // Replay protection: validate timestamp if provided
  if (timestamp !== null) {
    const webhookTime = parseInt(timestamp, 10);

    if (isNaN(webhookTime)) {
      return { valid: false, error: "Invalid timestamp" };
    }

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - webhookTime) > toleranceSeconds) {
      return { valid: false, error: "Timestamp out of range" };
    }
  }

  // Compute expected signature
  // If timestamp provided, include it in the payload (standard pattern: timestamp.body)
  const payload = timestamp ? `${timestamp}.${rawBody}` : rawBody;

  const expectedSignature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  // Timing-safe comparison to prevent timing attacks
  // First check buffer lengths match (timingSafeEqual requires equal lengths)
  const signatureBuffer = Buffer.from(signature, "hex");
  const expectedBuffer = Buffer.from(expectedSignature, "hex");

  if (signatureBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: "Invalid signature" };
  }

  const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

  if (!isValid) {
    return { valid: false, error: "Invalid signature" };
  }

  return { valid: true };
}

/**
 * Headers object type for webhook verification
 */
interface WebhookHeaders {
  get(name: string): string | null;
}

/**
 * Verify a GROW webhook using the standard HMAC-SHA256 pattern.
 *
 * Attempts to extract signature and timestamp from common header names:
 * - Signature: x-grow-signature, x-webhook-signature
 * - Timestamp: x-grow-timestamp, x-webhook-timestamp
 *
 * Uses GROW_WEBHOOK_SECRET environment variable.
 *
 * @param rawBody - The raw request body as a string
 * @param headers - Headers object with get() method (like Request.headers)
 * @returns Verification result
 *
 * @example
 * ```ts
 * const result = verifyGrowWebhook(rawBody, request.headers);
 * if (!result.valid) {
 *   return new Response(result.error, { status: 401 });
 * }
 * ```
 */
export function verifyGrowWebhook(
  rawBody: string,
  headers: WebhookHeaders
): WebhookVerificationResult {
  const secret = process.env.GROW_WEBHOOK_SECRET;

  if (!secret) {
    console.error("[webhook] GROW_WEBHOOK_SECRET not configured");
    return { valid: false, error: "Webhook secret not configured" };
  }

  // Try common header names for signature
  const signature =
    headers.get("x-grow-signature") || headers.get("x-webhook-signature");

  // Try common header names for timestamp
  const timestamp =
    headers.get("x-grow-timestamp") || headers.get("x-webhook-timestamp");

  return verifyWebhookSignature(rawBody, signature, secret, timestamp);
}

/**
 * Parsed GROW webhook payload structure (minimal)
 */
interface GrowWebhookPayload {
  processToken?: string;
  [key: string]: unknown;
}

/**
 * Verify a GROW webhook using process token validation.
 *
 * This is a fallback verification method when HMAC signature is not available.
 * GROW may send a processToken in the payload that should match a stored value.
 *
 * Security note: This method is less secure than HMAC signature verification
 * as the token is visible in the payload. Use verifyGrowWebhook when possible.
 *
 * @param payload - Parsed JSON payload from the webhook
 * @param expectedToken - The expected process token (from env or database)
 * @returns Verification result
 *
 * @example
 * ```ts
 * const payload = await request.json();
 * const result = verifyGrowProcessToken(payload, process.env.GROW_PROCESS_TOKEN!);
 * if (!result.valid) {
 *   return new Response(result.error, { status: 401 });
 * }
 * ```
 */
export function verifyGrowProcessToken(
  payload: GrowWebhookPayload,
  expectedToken: string
): WebhookVerificationResult {
  if (!expectedToken) {
    console.error("[webhook] Expected process token not provided");
    return { valid: false, error: "Process token not configured" };
  }

  const receivedToken = payload.processToken;

  if (!receivedToken) {
    return { valid: false, error: "Missing processToken in payload" };
  }

  if (typeof receivedToken !== "string") {
    return { valid: false, error: "Invalid processToken type" };
  }

  // Use timing-safe comparison even for tokens
  const receivedBuffer = Buffer.from(receivedToken);
  const expectedBuffer = Buffer.from(expectedToken);

  if (receivedBuffer.length !== expectedBuffer.length) {
    return { valid: false, error: "Invalid processToken" };
  }

  const isValid = crypto.timingSafeEqual(receivedBuffer, expectedBuffer);

  if (!isValid) {
    return { valid: false, error: "Invalid processToken" };
  }

  return { valid: true };
}
