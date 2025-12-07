/**
 * Text Sanitization Utilities
 *
 * Sanitizes LLM output to prevent XSS attacks.
 * Uses a simple HTML entity encoding approach that works in both
 * server and client environments.
 */

/**
 * HTML entities to escape
 */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#x60;',
  '=': '&#x3D;',
};

/**
 * Escape HTML special characters to prevent XSS
 */
export function escapeHtml(text: string): string {
  if (typeof text !== 'string') {
    return String(text);
  }
  return text.replace(/[&<>"'`=/]/g, (char) => HTML_ENTITIES[char] || char);
}

/**
 * Sanitize a string for safe display
 * Removes potential script injection patterns
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

  // Escape remaining HTML
  return escapeHtml(text);
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
