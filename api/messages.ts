import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { userId, action } = req.query;
    const origin = req.headers.origin;

    if (req.method === 'GET') {
        if (action === 'unread-count') return handleUnreadCount(req, res, origin);
        if (userId && typeof userId === 'string') return handleGetConversation(req, res, origin, userId);
        return res.status(400).json(handleError(new Error('Missing userId or action'), origin));
    }

    if (req.method === 'POST') return handleSend(req, res, origin);

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetConversation(req: VercelRequest, res: VercelResponse, origin?: string, userId: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

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

        return res.status(200).json(successResponse(messages, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleSend(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { toUserId, subject, content, requestType } = req.body;

        if (!toUserId || !subject || !content) {
            return res.status(400).json(handleError(new Error('Missing required fields'), origin));
        }

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

        return res.status(201).json(successResponse(message, 'Message sent successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleUnreadCount(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const count = await prisma.message.count({
            where: {
                toUserId: user.id,
                read: false
            }
        });

        return res.status(200).json(successResponse({ count }, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
