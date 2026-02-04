import { VercelRequest, VercelResponse } from '@vercel/node';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    return res.status(200).json({
        success: true,
        message: 'SS Garden App API is running',
        timestamp: new Date().toISOString(),
        endpoints: {
            auth: {
                signup: 'POST /api/auth/signup',
                login: 'POST /api/auth/login'
            }
        },
        environment: {
            hasDatabase: !!process.env.DATABASE_URL,
            hasJWT: !!process.env.JWT_SECRET,
            hasCloudinary: !!process.env.CLOUDINARY_CLOUD_NAME
        }
    });
}
