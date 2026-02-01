import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { successResponse, handleError } from '../../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json(handleError(new Error('Refresh token is required')));
        }

        // Verify refresh token
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

        // Generate new access token
        const newToken = jwt.sign(
            { id: decoded.id, email: decoded.email, role: decoded.role },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        // Generate new refresh token
        const newRefreshToken = jwt.sign(
            { id: decoded.id },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: '30d' }
        );

        const origin = req.headers.origin;
        return res.status(200).json(successResponse({
            token: newToken,
            refreshToken: newRefreshToken
        }, undefined, origin));

    } catch (error: any) {
        console.error('Refresh token error:', error);
        const origin = req.headers.origin;
        return res.status(401).json(handleError(new Error('INVALID_TOKEN'), origin));
    }
}
