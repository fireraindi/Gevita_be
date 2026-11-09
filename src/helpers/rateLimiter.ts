import { TooManyRequestsError } from "../errors/errors";

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const loginAttempts = new Map<string, RateLimitRecord>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function checkLoginRateLimit(identifier: string): void {
  const now = Date.now();
  const record = loginAttempts.get(identifier);

  if (!record || now > record.resetAt) {
    loginAttempts.set(identifier, { count: 1, resetAt: now + WINDOW_MS });
    return;
  }

  if (record.count >= MAX_ATTEMPTS) {
    throw new TooManyRequestsError("Too many login attempts. Please try again after 15 minutes.");
  }

  record.count += 1;
}

export function resetLoginRateLimit(identifier?: string): void {
  if (identifier) {
    loginAttempts.delete(identifier);
  } else {
    loginAttempts.clear();
  }
}

