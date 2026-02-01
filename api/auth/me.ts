import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import prisma from '../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);

        // Get full user details
        const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatarUrl: true,
                zipcode: true,
                phone: true,
                address: true,
                growing: true,
                isOnline: true,
                isActive: true,
                lastSeen: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!fullUser) {
            throw new Error('User not found');
        }

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(fullUser, undefined, origin));

    } catch (error: any) {
        console.error('Get current user error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
