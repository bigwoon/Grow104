import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCorsPreflightRequest } from '../lib/cors';
import { successResponse, errorResponse, setCorsHeaders } from '../lib/response';
import { validateEnvironment } from '../lib/validators';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    // Validate environment on first call
    const envCheck = validateEnvironment();
    if (!envCheck.valid) {
        setCorsHeaders(res, origin);
        return res.status(500).json(errorResponse(
            `Missing required environment variables: ${envCheck.missing.join(', ')}`,
            500
        ));
    }

    setCorsHeaders(res, origin);

    return res.status(200).json(successResponse({
        message: 'SS Garden App API is running',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: {
                signup: 'POST /api/auth?action=signup',
                login: 'POST /api/auth?action=login'
            }
        },
        environment: {
            hasDatabase: !!process.env.DATABASE_URL,
            hasJWT: !!process.env.JWT_SECRET,
            hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME,
            hasRedis: !!process.env.UPSTASH_REDIS_REST_URL
        }
    }));
}
