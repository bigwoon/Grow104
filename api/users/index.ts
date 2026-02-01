import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import prisma from '../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);

        // Only admins can list all users
        requireAdmin(user);

        const { role } = req.query;

        // Build filter
        const where: any = { isActive: true };
        if (role && typeof role === 'string') {
            where.role = role;
        }

        const users = await prisma.user.findMany({
            where,
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
                lastSeen: true,
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(users, undefined, origin));

    } catch (error: any) {
        console.error('List users error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
