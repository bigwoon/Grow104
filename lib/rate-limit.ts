import { Redis } from '@upstash/redis';

let redis: Redis | null = null;
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    }
} catch (err) {
    console.error('[Rate Limit] Failed to initialize Redis client:', err);
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
        return { allowed: true, remaining: maxRequests };
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
    if (!redis) return;
    const key = `rate-limit:${identifier}`;
    try {
        await redis.del(key);
    } catch (error) {
        console.error('[Rate Limit] Failed to reset:', error);
    }
}
