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

/**
 * Sanitizes a filename to be safe for file storage and URLs
 * Replaces problematic characters with safe alternatives while preserving readability
 * @param filename - The original filename
 * @returns A sanitized filename safe for storage
 */
export function sanitizeFilename(filename: string): string {
  if (!filename || typeof filename !== 'string') {
    return 'unknown';
  }
  
  return filename
    // Replace brackets with parentheses
    .replace(/\[/g, '(')
    .replace(/\]/g, ')')
    // Replace hash with underscore
    .replace(/#/g, '_')
    // Replace other problematic characters
    .replace(/[<>:"|?*]/g, '_')
    // Replace multiple spaces with single space
    .replace(/\s+/g, ' ')
    // Remove leading/trailing whitespace
    .trim()
    // Limit length to prevent issues
    .substring(0, 255);
}

/**
 * Creates a safe unique filename by combining UUID with sanitized original filename
 * @param originalFilename - The original filename from the attachment
 * @param uuid - A unique identifier (typically from uuidv4())
 * @returns A safe unique filename
 */
export function createSafeUniqueFilename(originalFilename: string, uuid: string): string {
  const sanitized = sanitizeFilename(originalFilename);
  return `${uuid}-${sanitized}`;
} 