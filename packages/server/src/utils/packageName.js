const FALLBACK_NAME = 'kiosk-app';

// Debian package names must match [a-z0-9][a-z0-9+.-]*; RPM is more lenient
// but this satisfies both. productName is often Cyrillic (e.g. "Музей СВО"),
// which Linux packaging tools reject outright — this derives a stable ASCII
// identifier (from appId) instead, used as executableName/packageName while
// productName stays the human-readable display name.
export function sanitizePackageName(rawAppId) {
  const lowered = String(rawAppId || '').toLowerCase();
  const sanitized = lowered
    .replace(/[^a-z0-9+.-]/g, '-')
    .replace(/^[^a-z0-9]+/, '')
    .replace(/-{2,}/g, '-')
    .replace(/-+$/, '');

  return sanitized.length >= 2 ? sanitized : FALLBACK_NAME;
}
