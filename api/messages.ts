import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, validateRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { MessageCreateSchema } from '../lib/validation';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { userId, action, id } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method === 'GET') {
        if (action === 'unread-count') return handleUnreadCount(req, res, origin);
        if (userId && typeof userId === 'string') return handleGetConversation(req, res, origin, userId);
        return res.status(400).json(handleError(new Error('Missing userId or action'), origin));
    }

    if (req.method === 'POST') return handleSend(req, res, origin);
    if (req.method === 'DELETE' && id && typeof id === 'string') return handleDelete(req, res, origin, id);

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleGetConversation(req: VercelRequest, res: VercelResponse, userId: string, origin?: string) {
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
        const validatedData = validateRequest(MessageCreateSchema, req.body);

        const message = await prisma.message.create({
            data: {
                fromUserId: user.id,
                ...validatedData
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

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const message = await prisma.message.findUnique({
            where: { id }
        });

        if (!message) {
            return res.status(404).json(handleError(new Error('Message not found'), origin));
        }

        // Users can only delete messages they sent or received
        if (message.fromUserId !== user.id && message.toUserId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        await prisma.message.delete({
            where: { id }
        });

        return res.status(200).json(successResponse({ success: true }, 'Message deleted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
