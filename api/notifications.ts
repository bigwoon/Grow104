import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    const origin = req.headers.origin;

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'POST' && action === 'mark-all-read') return handleMarkAllRead(req, res, origin);
    if (req.method === 'PUT' && id && typeof id === 'string') return handleMarkRead(req, res, origin, id);
    if (req.method === 'DELETE' && id && typeof id === 'string') return handleDelete(req, res, origin, id);

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { isRead, type, limit = '50', offset = '0' } = req.query;

        const where: any = {
            userId: user.id
        };

        if (isRead !== undefined) {
            where.isRead = isRead === 'true';
        }

        if (type && typeof type === 'string') {
            where.type = type;
        }

        const notifications = await prisma.notification.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit as string),
            skip: parseInt(offset as string)
        });

        const total = await prisma.notification.count({ where });

        return res.status(200).json(successResponse({
            notifications,
            total,
            limit: parseInt(limit as string),
            offset: parseInt(offset as string)
        }, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleMarkRead(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        // Verify notification belongs to user
        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification) {
            return res.status(404).json(handleError(new Error('Notification not found'), origin));
        }

        if (notification.userId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        const updated = await prisma.notification.update({
            where: { id },
            data: { isRead: true }
        });

        return res.status(200).json(successResponse(updated, 'Notification marked as read', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        // Verify notification belongs to user
        const notification = await prisma.notification.findUnique({
            where: { id }
        });

        if (!notification) {
            return res.status(404).json(handleError(new Error('Notification not found'), origin));
        }

        if (notification.userId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        await prisma.notification.delete({
            where: { id }
        });

        return res.status(200).json(successResponse({ success: true }, 'Notification deleted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleMarkAllRead(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const result = await prisma.notification.updateMany({
            where: {
                userId: user.id,
                isRead: false
            },
            data: {
                isRead: true
            }
        });

        return res.status(200).json(successResponse(
            { count: result.count },
            `Marked ${result.count} notifications as read`,
            origin
        ));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
