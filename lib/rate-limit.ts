import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
const memoryStore = new Map<string, { count: number; resetAt: number }>();

try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    } else {
        console.warn('[Rate Limit] UPSTASH_REDIS_REST_URL not configured. Using in-memory fallback rate limiter.');
    }
} catch (err) {
    console.error('[Rate Limit] Failed to initialize Redis client, falling back to memory store:', err);
}

/**
 * Check if a request should be rate limited
 * @param identifier Unique identifier (e.g., email, IP address)
 * @param maxRequests Maximum number of requests allowed in the window
 * @param windowSeconds Time window in seconds
 * @returns Object with allowed status and remaining requests
 */
export async function checkRateLimit(
    identifier: string,
    maxRequests: number = 10,
    windowSeconds: number = 60
): Promise<{ allowed: boolean; remaining: number }> {
    if (!redis) {
        const now = Date.now();
        const entry = memoryStore.get(identifier);

        if (!entry || now > entry.resetAt) {
            memoryStore.set(identifier, { count: 1, resetAt: now + windowSeconds * 1000 });
            return { allowed: true, remaining: Math.max(0, maxRequests - 1) };
        }

        entry.count += 1;
        const allowed = entry.count <= maxRequests;
        const remaining = Math.max(0, maxRequests - entry.count);
        return { allowed, remaining };
    }

    const key = `rate-limit:${identifier}`;

    try {
        // Increment the counter
        const current = await redis.incr(key);

        // Set expiry on first request
        if (current === 1) {
            await redis.expire(key, windowSeconds);
        }

        const allowed = current <= maxRequests;
        const remaining = Math.max(0, maxRequests - current);

        return { allowed, remaining };
    } catch (error) {
        console.error('[Rate Limit] Redis error:', error);
        // Fail open (allow request if Redis is down)
        return { allowed: true, remaining: maxRequests };
    }
}

/**
 * Reset rate limit for a specific identifier
 * Useful for testing or manual unlocking
 */
export async function resetRateLimit(identifier: string): Promise<void> {
    if (!redis) {
        memoryStore.delete(identifier);
        return;
    }
    const key = `rate-limit:${identifier}`;
    try {
        await redis.del(key);
    } catch (error) {
        console.error('[Rate Limit] Failed to reset:', error);
    }
}
