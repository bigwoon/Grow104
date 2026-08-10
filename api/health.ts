import { VercelRequest, VercelResponse } from '@vercel/node';
import { checkDatabaseHealth } from '../lib/db-middleware';
import { setCorsHeaders } from '../lib/response';
import { handleCorsPreflightRequest } from '../lib/cors';

/**
 * Health check endpoint
 * GET /api/health
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
        const status = dbHealth.healthy ? 200 : 503;

        setCorsHeaders(res, origin);
        return res.status(status).json({
            status: dbHealth.healthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            database: {
                connected: dbHealth.healthy,
                latency: dbHealth.latency ? `${dbHealth.latency}ms` : undefined,
                error: dbHealth.error
            },
            environment: process.env.NODE_ENV || 'production'
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
