import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import prisma from '../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);

        // Update user's online status and last seen
        await prisma.user.update({
            where: { id: user.id },
            data: {
                isOnline: true,
                lastSeen: new Date()
            }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse({
            success: true,
            message: 'Heartbeat received'
        }, undefined, origin));

    } catch (error: any) {
        console.error('Heartbeat error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
