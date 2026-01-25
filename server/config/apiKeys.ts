/**
 * Hardcoded API Keys Configuration
 * In production, these should be stored in environment variables
 */

export const API_KEYS = {
  // External API integration
  EXTERNAL_API_KEY: process.env.EXTERNAL_API_KEY || '',

  // Internal system API key
  INTERNAL_API_KEY: process.env.INTERNAL_API_KEY || '',

  // Webhook authentication
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || '',

  // Admin API key for system operations
  ADMIN_API_KEY: process.env.ADMIN_API_KEY || '',

  // Access tokens for external system integration
  ACCESS_TOKEN_1: process.env.ACCESS_TOKEN_1 || '',
  ACCESS_TOKEN_2: process.env.ACCESS_TOKEN_2 || ''
} as const;

/**
 * Get masked API key for display purposes
 * @param keyType - Type of API key to mask
 * @returns Masked API key string
 */
export function getMaskedApiKey(keyType: keyof typeof API_KEYS): string {
  const key = API_KEYS[keyType];
  if (key.length <= 8) {
    return '*'.repeat(key.length);
  }

  // Show first 4 and last 4 characters, mask the middle
  const start = key.substring(0, 4);
  const end = key.substring(key.length - 4);
  const middle = '*'.repeat(key.length - 8);

  return `${start}${middle}${end}`;
}

/**
 * Validate API key
 * @param providedKey - API key to validate
 * @param keyType - Type of API key to validate against
 * @returns True if valid, false otherwise
 */
export function validateApiKey(providedKey: string, keyType: keyof typeof API_KEYS): boolean {
  return API_KEYS[keyType] === providedKey;
}

/**
 * Get all API keys with their types (for admin display)
 */
export function getAllApiKeys(): Array<{ type: string; key: string; masked: string }> {
  return Object.entries(API_KEYS).map(([type, key]) => ({
    type: type.replace(/_/g, ' ').toLowerCase(),
    key,
    masked: getMaskedApiKey(type as keyof typeof API_KEYS)
  }));
}
