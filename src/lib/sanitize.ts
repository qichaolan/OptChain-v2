/**
 * Text Sanitization Utilities
 *
 * Sanitizes LLM output to prevent XSS attacks.
 * React automatically escapes text content, so we only need to remove
 * dangerous patterns - not encode HTML entities.
 */

/**
 * Sanitize a string for safe display
 * Removes potential script injection patterns
 * Note: We don't HTML-encode here because React handles text escaping
 */
export function sanitizeText(text: string | null | undefined): string {
  if (text == null) {
    return '';
  }

  if (typeof text !== 'string') {
    text = String(text);
  }

  // Remove null bytes
  text = text.replace(/\0/g, '');

  // Remove potential script tags and event handlers
  text = text.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  text = text.replace(/javascript:/gi, '');
  text = text.replace(/on\w+\s*=/gi, '');
  text = text.replace(/data:/gi, '');

  // Remove any HTML tags (React will escape text content anyway)
  text = text.replace(/<[^>]*>/g, '');

  return text;
}

/**
 * Sanitize an object's string values recursively
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeText(obj) as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject) as T;
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized as T;
  }

  return obj;
}

/**
 * Sanitize AI response content for safe rendering
 */
export function sanitizeAiResponse<T>(response: T): T {
  return sanitizeObject(response);
}
