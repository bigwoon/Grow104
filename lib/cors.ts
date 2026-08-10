import { VercelRequest, VercelResponse } from '@vercel/node';
import { setCorsHeaders } from './response';

/**
 * Handle CORS preflight (OPTIONS) requests
 * Returns 200 with appropriate CORS headers
 */
export function handleCorsPreflightRequest(
    req: VercelRequest,
    res: VercelResponse,
    origin?: string
): void {
    setCorsHeaders(res, origin);
    res.status(200).end();
}
