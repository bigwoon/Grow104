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
        const { userId } = req.query;

        if (!userId || typeof userId !== 'string') {
            return res.status(400).json(handleError(new Error('User ID is required')));
        }

        // Get conversation between current user and specified user
        const messages = await prisma.message.findMany({
            where: {
                OR: [
                    { fromUserId: user.id, toUserId: userId },
                    { fromUserId: userId, toUserId: user.id }
                ]
            },
            include: {
                fromUser: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                },
                toUser: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        // Mark messages as read
        await prisma.message.updateMany({
            where: {
                fromUserId: userId,
                toUserId: user.id,
                read: false
            },
            data: {
                read: true,
                readAt: new Date()
            }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(messages, undefined, origin));

    } catch (error: any) {
        console.error('Get conversation error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
