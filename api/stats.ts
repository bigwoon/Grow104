import { VercelRequest, VercelResponse } from '@vercel/node';
import { successResponse, handleError, setCorsHeaders } from '../lib/response';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';
import { Redis } from '@upstash/redis';

// Redis is optional — gracefully skip caching if not configured
let redis: Redis | null = null;
try {
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
        redis = new Redis({
            url: process.env.UPSTASH_REDIS_REST_URL,
            token: process.env.UPSTASH_REDIS_REST_TOKEN,
        });
    }
} catch (err) {
    console.error('[Stats] Failed to initialize Redis client:', err);
}

const CACHE_KEY = 'community:stats';
const CACHE_TTL = 60 * 5; // 5 minutes

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin;

    // Set CORS headers immediately on all responses
    setCorsHeaders(res, origin);

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // ── Cache read (only if Redis is available) ─────────────
        if (redis) {
            const cached = await redis.get<object>(CACHE_KEY).catch(() => null);
            if (cached) {
                return res.status(200).json(successResponse(cached));
            }
        }

        // ── Cache miss: query DB ────────────────────────────────
        const now = new Date();

        const [totalMembers, activePlots, volunteerHoursRaw, upcomingEvents] = await Promise.all([
            prisma.user.count({
                where: {
                    isActive: true,
                    role: { in: ['gardener', 'volunteer', 'Gardener', 'Volunteer'] }
                }
            }),
            prisma.garden.count({
                where: { status: 'active' }
            }),
            prisma.report.aggregate({
                _sum: { hoursWorked: true }
            }),
            prisma.event.count({
                where: { date: { gte: now } }
            })
        ]);

        const stats = {
            totalMembers,
            activePlots,
            volunteerHours: Math.round(Number(volunteerHoursRaw._sum.hoursWorked ?? 0)),
            upcomingEvents,
        };

        // ── Cache write (fire-and-forget, only if Redis available) ──
        if (redis) {
            redis.set(CACHE_KEY, stats, { ex: CACHE_TTL }).catch(() => { /* non-fatal */ });
        }

        return res.status(200).json(successResponse(stats));

    } catch (error: any) {
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

