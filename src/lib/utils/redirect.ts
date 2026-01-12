/**
 * Validate redirect URL to prevent open redirect attacks
 * Only allows relative paths starting with /
 */
export function getSafeRedirectUrl(url: string | null, defaultUrl = "/dashboard"): string {
  if (!url) return defaultUrl;

  // Must start with / and not be a protocol-relative URL (//)
  if (!url.startsWith("/") || url.startsWith("//")) {
    return defaultUrl;
  }

  // Block any URL that contains protocol indicators
  if (url.includes(":")) {
    return defaultUrl;
  }

  return url;
}
