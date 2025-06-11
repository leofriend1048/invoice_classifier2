/**
 * Joins a base URL with a path, ensuring no double slashes
 * @param baseUrl - The base URL (e.g., "https://example.com/" or "https://example.com")
 * @param path - The path to append (e.g., "/reset-password" or "reset-password")
 * @returns The properly joined URL
 */
export function joinUrl(baseUrl: string, path: string): string {
  if (!baseUrl || !path) {
    return baseUrl || path || '';
  }
  
  // Remove trailing slash from base URL
  const cleanBase = baseUrl.replace(/\/+$/, '');
  
  // Ensure path starts with a slash
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  
  return `${cleanBase}${cleanPath}`;
}

/**
 * Gets the base URL from environment variables and joins it with a path
 * @param path - The path to append
 * @returns The complete URL or just the path if no base URL is configured
 */
export function getFullUrl(path: string): string {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (!baseUrl) {
    return path;
  }
  return joinUrl(baseUrl, path);
} 