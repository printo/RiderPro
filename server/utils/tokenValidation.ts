import { Request } from 'express';

export interface TokenCreationData {
  name: string;
  description?: string;
  permissions: 'read' | 'write' | 'admin';
  expirationOption?: string;
  customExpiration?: string;
}

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedData?: TokenCreationData;
}

/**
 * Sanitize string input to prevent injection attacks
 */
export function sanitizeString(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove null bytes and control characters
  let sanitized = input.replace(/[\x00-\x1F\x7F]/g, '');

  // Trim whitespace
  sanitized = sanitized.trim();

  // Remove potentially dangerous characters for SQL injection
  // Note: We use parameterized queries, but this is defense in depth
  sanitized = sanitized.replace(/[<>'"&]/g, '');

  return sanitized;
}

/**
 * Validate token name
 */
export function validateTokenName(name: string): ValidationError | null {
  if (!name || typeof name !== 'string') {
    return { field: 'name', message: 'Token name is required' };
  }

  const sanitized = sanitizeString(name);

  if (sanitized.length < 3) {
    return { field: 'name', message: 'Token name must be at least 3 characters long' };
  }

  if (sanitized.length > 50) {
    return { field: 'name', message: 'Token name must be less than 50 characters long' };
  }

  // Check for valid characters (alphanumeric, spaces, hyphens, underscores)
  if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitized)) {
    return { field: 'name', message: 'Token name can only contain letters, numbers, spaces, hyphens, and underscores' };
  }

  return null;
}

/**
 * Validate token description
 */
export function validateTokenDescription(description?: string): ValidationError | null {
  if (!description) {
    return null; // Description is optional
  }

  if (typeof description !== 'string') {
    return { field: 'description', message: 'Description must be a string' };
  }

  const sanitized = sanitizeString(description);

  if (sanitized.length > 200) {
    return { field: 'description', message: 'Description must be less than 200 characters long' };
  }

  return null;
}

/**
 * Validate token permissions
 */
export function validateTokenPermissions(permissions: string): ValidationError | null {
  if (!permissions || typeof permissions !== 'string') {
    return { field: 'permissions', message: 'Permissions are required' };
  }

  const validPermissions = ['read', 'write', 'admin'];
  if (!validPermissions.includes(permissions)) {
    return { field: 'permissions', message: 'Invalid permissions. Must be read, write, or admin' };
  }

  return null;
}

/**
 * Validate expiration date
 */
export function validateExpirationDate(expirationOption?: string, customExpiration?: string): ValidationError | null {
  if (!expirationOption) {
    return null; // Expiration is optional (defaults to never)
  }

  const validOptions = ['never', '30days', '90days', '1year', 'custom'];
  if (!validOptions.includes(expirationOption)) {
    return { field: 'expirationOption', message: 'Invalid expiration option' };
  }

  if (expirationOption === 'custom') {
    if (!customExpiration) {
      return { field: 'customExpiration', message: 'Custom expiration date is required when using custom option' };
    }

    const expiryDate = new Date(customExpiration);

    // Check if date is valid
    if (isNaN(expiryDate.getTime())) {
      return { field: 'customExpiration', message: 'Invalid expiration date format' };
    }

    // Check if date is in the future
    const now = new Date();
    if (expiryDate <= now) {
      return { field: 'customExpiration', message: 'Expiration date must be in the future' };
    }

    // Check if date is not too far in the future (max 10 years)
    const maxDate = new Date(now.getTime() + 10 * 365 * 24 * 60 * 60 * 1000);
    if (expiryDate > maxDate) {
      return { field: 'customExpiration', message: 'Expiration date cannot be more than 10 years in the future' };
    }
  }

  return null;
}

/**
 * Comprehensive validation for token creation data
 */
export function validateTokenCreationData(data: any): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate name
  const nameError = validateTokenName(data.name);
  if (nameError) errors.push(nameError);

  // Validate description
  const descriptionError = validateTokenDescription(data.description);
  if (descriptionError) errors.push(descriptionError);

  // Validate permissions
  const permissionsError = validateTokenPermissions(data.permissions);
  if (permissionsError) errors.push(permissionsError);

  // Validate expiration
  const expirationError = validateExpirationDate(data.expirationOption, data.customExpiration);
  if (expirationError) errors.push(expirationError);

  if (errors.length > 0) {
    return { isValid: false, errors };
  }

  // Return sanitized data
  const sanitizedData: TokenCreationData = {
    name: sanitizeString(data.name),
    description: data.description ? sanitizeString(data.description) : undefined,
    permissions: data.permissions,
    expirationOption: data.expirationOption,
    customExpiration: data.customExpiration
  };

  return { isValid: true, errors: [], sanitizedData };
}

/**
 * Rate limiting storage (in-memory for simplicity)
 * In production, consider using Redis or database storage
 */
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Check rate limit for token creation
 * Allows 5 token creations per hour per IP address
 */
export function checkRateLimit(req: Request): { allowed: boolean; resetTime?: number } {
  const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
  const now = Date.now();
  const windowMs = 60 * 60 * 1000; // 1 hour
  const maxRequests = 5;

  const key = `token_creation_${clientIp}`;
  const current = rateLimitStore.get(key);

  if (!current || now > current.resetTime) {
    // First request or window expired
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (current.count >= maxRequests) {
    return { allowed: false, resetTime: current.resetTime };
  }

  // Increment count
  current.count++;
  rateLimitStore.set(key, current);

  return { allowed: true };
}

/**
 * Clean up expired rate limit entries
 * Should be called periodically
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  for (const [key, value] of rateLimitStore.entries()) {
    if (now > value.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}

// Clean up rate limit store every hour
setInterval(cleanupRateLimitStore, 60 * 60 * 1000);