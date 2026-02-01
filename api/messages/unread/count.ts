import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../../lib/middleware';
import { successResponse, handleError } from '../../../lib/response';
import prisma from '../../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);

        const count = await prisma.message.count({
            where: {
                toUserId: user.id,
                read: false
            }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse({ count }, undefined, origin));

    } catch (error: any) {
        console.error('Get unread count error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
