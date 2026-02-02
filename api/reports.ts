import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { getGardenerGarden } from '../lib/utils';
import { ReportCreateSchema } from '../lib/validation';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;
    const origin = req.headers.origin;

    if (req.method === 'GET') {
        if (id && typeof id === 'string') return handleGetSingle(req, res, origin, id);
        return handleList(req, res, origin);
    }
    if (req.method === 'POST') return handleCreate(req, res, origin);
    if (req.method === 'DELETE' && id && typeof id === 'string') return handleDelete(req, res, origin, id);

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

async function handleGetSingle(req: VercelRequest, res: VercelResponse, origin?: string, id?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        if (!id) {
            return res.status(400).json(handleError(new Error('Report ID is required'), origin));
        }

        const report = await prisma.report.findUnique({
            where: { id },
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

        if (!report) {
            return res.status(404).json(handleError(new Error('Report not found'), origin));
        }

        return res.status(200).json(successResponse(report, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const validatedData = validateRequest(ReportCreateSchema, req.body);

        let finalGardenId = validatedData.gardenId;
        if (!finalGardenId && user.role === 'Gardener') {
            const garden = await getGardenerGarden(user.id);
            finalGardenId = garden.id;
        }

        const report = await prisma.report.create({
            data: {
                userId: user.id,
                gardenId: finalGardenId,
                title: validatedData.title,
                content: validatedData.content,
                type: validatedData.type,
                activityType: validatedData.activityType,
                description: validatedData.description,
                hoursWorked: validatedData.hoursWorked || null,
                rating: validatedData.rating || null,
                visitDate: validatedData.visitDate ? new Date(validatedData.visitDate) : null,
                notes: validatedData.notes || null
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

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        await prisma.report.delete({
            where: { id }
        });

        return res.status(200).json(successResponse({ success: true }, 'Report deleted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
