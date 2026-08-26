import { randomBytes } from "crypto";
import { redis_service } from "../utils/redis";
import { FLASH_SALE_CONFIG } from "../config";

export class RedisRepository {
  /**
   * Rate Limiter: Check if user has requests remaining
   * Uses sliding window with Redis expiry
   */
  async isRateLimited(userId: string): Promise<boolean> {
    const redis = redis_service.get();
    const key = `rate_limit:${userId}`;
    const now = Date.now();
    const windowStart = now - FLASH_SALE_CONFIG.rateLimitWindow * 1000;

    // Remove old requests outside the window
    await redis.zRemRangeByScore(key, "-inf", windowStart);

    // Get count of requests in window
    const count = await redis.zCard(key);

    if (count >= FLASH_SALE_CONFIG.rateLimitMaxRequests) {
      return true; // Rate limited
    }

    // Add current request
    await redis.zAdd(key, { score: now, value: `${now}-${Math.random()}` });

    // Set expiry (clean up old keys)
    await redis.expire(key, FLASH_SALE_CONFIG.rateLimitWindow + 1);

    return false; // Not rate limited
  }

  /**
   * Get remaining requests for user
   */
  async getRemaining(userId: string): Promise<number> {
    const redis = redis_service.get();
    const key = `rate_limit:${userId}`;
    const now = Date.now();
    const windowStart = now - FLASH_SALE_CONFIG.rateLimitWindow * 1000;

    // Remove old requests outside window
    await redis.zRemRangeByScore(key, "-inf", windowStart);

    // Get count
    const count = await redis.zCard(key);

    return Math.max(0, FLASH_SALE_CONFIG.rateLimitMaxRequests - count);
  }

  /**
   * Generate & store CSRF token in Redis with expiry
   */
  async generateCsrfToken(): Promise<string> {
    const redis = redis_service.get();
    const token = this.generateRandomToken();
    const key = `csrf_token:${token}`;
    const expirySeconds = FLASH_SALE_CONFIG.csrfTokenExpiry;

    // Store in Redis with expiry
    await redis.setEx(key, expirySeconds, "1");

    return token;
  }

  /**
   * Verify and consume CSRF token (one-time use)
   */
  async verifyCsrfToken(token: string): Promise<boolean> {
    const redis = redis_service.get();
    const key = `csrf_token:${token}`;

    // Check if token exists
    const exists = await redis.exists(key);

    if (!exists) {
      return false;
    }

    // Delete token (one-time use)
    await redis.del(key);

    return true;
  }

  /**
   * Store audit log entry in Redis (append-only)
   * Also persists to database via background job
   */
  async logAudit(
    action: string,
    details: Record<string, any>,
    correlationId: string,
    userId?: string,
    success: boolean = true
  ): Promise<void> {
    const redis = redis_service.get();
    const key = "audit_log";

    const entry = {
      timestamp: new Date().toISOString(),
      correlationId,
      action,
      userId,
      details,
      success,
    };

    // Store in Redis (LPUSH = prepend, so newest first)
    // Keep last 10,000 entries in Redis
    await redis.lPush(key, JSON.stringify(entry));
    await redis.lTrim(key, 0, 9999);
  }

  /**
   * Get audit logs from Redis
   */
  async getAuditLogs(limit: number = 100): Promise<Array<any>> {
    const redis = redis_service.get();
    const key = "audit_log";

    const logs = await redis.lRange(key, 0, limit - 1);

    return logs.map((log) => JSON.parse(log));
  }

  /**
   * Cache management - store value with expiry
   */
  async cacheSet(
    key: string,
    value: string,
    ttlSeconds: number
  ): Promise<void> {
    const redis = redis_service.get();
    await redis.setEx(key, ttlSeconds, value);
  }

  /**
   * Get cached value
   */
  async cacheGet(key: string): Promise<string | null> {
    const redis = redis_service.get();
    return await redis.get(key);
  }

  /**
   * Clear cache key
   */
  async cacheDel(key: string): Promise<void> {
    const redis = redis_service.get();
    await redis.del(key);
  }

  /**
   * Reset for testing
   */
  async reset(): Promise<void> {
    const redis = redis_service.get();
    // Flush Redis (DEVELOPMENT ONLY)
    if (process.env.NODE_ENV !== "production") {
      await redis.flushDb();
    }
  }

  /**
   * Helper: Generate random token
   */
  private generateRandomToken(): string {
    return randomBytes(16).toString("hex");
  }
}

export const redisRepository = new RedisRepository();