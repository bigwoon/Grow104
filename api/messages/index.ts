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
        const { toUserId, subject, content, requestType } = req.body;

        if (!toUserId || !subject || !content) {
            return res.status(400).json(handleError(new Error('Missing required fields')));
        }

        // Create message
        const message = await prisma.message.create({
            data: {
                fromUserId: user.id,
                toUserId,
                subject,
                content,
                requestType
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
            }
        });

        const origin = req.headers.origin;
        return res.status(201).json(successResponse(message, 'Message sent successfully', origin));

    } catch (error: any) {
        console.error('Send message error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
