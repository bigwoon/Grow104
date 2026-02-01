import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { getGardenerGarden } from '../lib/utils';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin;

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'POST') return handleCreate(req, res, origin);

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { gardenId, userId, type } = req.query;

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

        return res.status(200).json(successResponse(reports, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const {
            gardenId,
            title,
            content,
            type,
            activityType,
            description,
            hoursWorked,
            rating,
            visitDate,
            notes
        } = req.body;

        if (!title || !content || !type || !activityType) {
            return res.status(400).json(handleError(new Error('Missing required fields'), origin));
        }

        let finalGardenId = gardenId;
        if (!finalGardenId && user.role === 'Gardener') {
            const garden = await getGardenerGarden(user.id);
            finalGardenId = garden.id;
        }

        const report = await prisma.report.create({
            data: {
                userId: user.id,
                gardenId: finalGardenId,
                title,
                content,
                type,
                activityType,
                description,
                hoursWorked: hoursWorked ? parseFloat(hoursWorked) : null,
                rating: rating ? parseInt(rating) : null,
                visitDate: visitDate ? new Date(visitDate) : null,
                notes
            },
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
            }
        });

        return res.status(201).json(successResponse(report, 'Report submitted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
