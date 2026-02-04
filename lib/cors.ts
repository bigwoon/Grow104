import { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Handle CORS preflight (OPTIONS) requests
 * Returns 200 with appropriate CORS headers
 */
export function handleCorsPreflightRequest(
    req: VercelRequest,
    res: VercelResponse,
    origin?: string
): void {
    const productionUrl = process.env.FRONTEND_URL || 'https://www.grow104.org';

    const allowedOrigins = [
        productionUrl,
        'https://www.grow104.org',
        'https://grow104.org',
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:5173',
        'https://localhost:5173',
        'http://localhost:5174',
        'https://localhost:5174',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000'
    ];

    let allowedOrigin = productionUrl;
    if (origin && allowedOrigins.includes(origin)) {
        allowedOrigin = origin;
    } else if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        allowedOrigin = origin;
    }

    res.status(200);
    res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    res.end();
}
