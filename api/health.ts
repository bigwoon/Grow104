import { VercelRequest, VercelResponse } from '@vercel/node';
import { checkDatabaseHealth } from '../lib/db-middleware';
import { setCorsHeaders } from '../lib/response';
import { handleCorsPreflightRequest } from '../lib/cors';

/**
 * Health check endpoint — reports full system readiness.
 * GET /api/health
 *
 * Returns connectivity status for every critical service so you can verify
 * the backend is production-ready before a deploy or demo.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method !== 'GET') {
        setCorsHeaders(res, origin);
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const dbHealth = await checkDatabaseHealth();

        // Surface the status of every env var so missing config is caught immediately
        const envStatus = {
            database:    !!process.env.DATABASE_URL,
            directUrl:   !!process.env.DIRECT_URL,
            jwt:         !!process.env.JWT_SECRET && !!process.env.JWT_REFRESH_SECRET,
            cloudinary:  !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET),
            frontendUrl: !!process.env.FRONTEND_URL,
            // Redis is optional but strongly recommended for distributed rate limiting
            redis:       !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
        };

        const allRequiredPresent = envStatus.database && envStatus.jwt && envStatus.cloudinary && envStatus.frontendUrl;
        const overallHealthy = dbHealth.healthy && allRequiredPresent;
        const status = overallHealthy ? 200 : 503;

        setCorsHeaders(res, origin);
        return res.status(status).json({
            status: overallHealthy ? 'healthy' : 'degraded',
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'production',
            database: {
                connected: dbHealth.healthy,
                latency:   dbHealth.latency ? `${dbHealth.latency}ms` : undefined,
                error:     dbHealth.error
            },
            services: {
                ...envStatus,
                rateLimiting: envStatus.redis
                    ? 'distributed (Upstash Redis)'
                    : 'in-memory fallback ⚠️ — add UPSTASH_REDIS_REST_URL & TOKEN for production'
            }
        });
    } catch (error: any) {
        setCorsHeaders(res, origin);
        return res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
}
