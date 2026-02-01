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
        const { gardenId, userId, type } = req.query;

        // Build filter
        const where: any = {};
        if (gardenId && typeof gardenId === 'string') {
            where.gardenId = gardenId;
        }
        if (userId && typeof userId === 'string') {
            where.userId = userId;
        }
        if (type && typeof type === 'string') {
            where.type = type;
        }

        const reports = await prisma.report.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        role: true
                    }
                },
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(reports, undefined, origin));

    } catch (error: any) {
        console.error('List reports error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
