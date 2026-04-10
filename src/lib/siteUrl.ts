/**
 * Resolve the public site origin for building shareable URLs.
 *
 * Priority:
 *   1. NEXT_PUBLIC_APP_URL   (preferred, set this in production)
 *   2. NEXT_PUBLIC_SITE_URL  (legacy/alternate name)
 *   3. window.location.origin (client-side fallback, dev convenience)
 *   4. '' (server-side with no env var — caller must handle)
 *
 * The returned value never has a trailing slash, so callers can safely
 * append paths like `/report/${token}`.
 */
export function getSiteUrl(): string {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ?? process.env.NEXT_PUBLIC_SITE_URL

  if (envUrl && envUrl.length > 0) {
    return envUrl.replace(/\/+$/, '')
  }

  if (typeof window !== 'undefined') {
    return window.location.origin
  }

  return ''
}

/**
 * Build an absolute URL for a path on this site.
 * Accepts paths with or without a leading slash.
 */
export function buildSiteUrl(path: string): string {
  const base = getSiteUrl()
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${base}${normalizedPath}`
}
