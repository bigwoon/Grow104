import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { getGardenerGarden } from '../lib/utils';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    const origin = req.headers.origin;

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'POST') {
        if (action === 'join' && id && typeof id === 'string') return handleJoin(req, res, origin, id);
        return handleCreate(req, res, origin);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { gardenId, status } = req.query;

        const where: any = {};
        if (gardenId && typeof gardenId === 'string') {
            where.gardenId = gardenId;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }

        const requests = await prisma.volunteerRequest.findMany({
            where,
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                requester: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json(successResponse(requests, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { gardenId, title, description, date } = req.body;

        if (!title || !description || !date) {
            return res.status(400).json(handleError(new Error('Missing required fields'), origin));
        }

        let finalGardenId = gardenId;
        if (!finalGardenId && user.role === 'Gardener') {
            const garden = await getGardenerGarden(user.id);
            finalGardenId = garden.id;
        }

        if (!finalGardenId) {
            return res.status(400).json(handleError(new Error('Garden ID is required'), origin));
        }

        const request = await prisma.volunteerRequest.create({
            data: {
                gardenId: finalGardenId,
                requesterId: user.id,
                title,
                description,
                date: new Date(date),
                status: 'open'
            },
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                requester: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            }
        });

        return res.status(201).json(successResponse(request, 'Volunteer request created successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleJoin(req: VercelRequest, res: VercelResponse, origin?: string, id: string) {
    try {
        authenticate(req as AuthenticatedRequest);

        const request = await prisma.volunteerRequest.findUnique({
            where: { id },
            include: {
                garden: true,
                requester: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!request) {
            return res.status(404).json(handleError(new Error('Request not found'), origin));
        }

        return res.status(200).json(successResponse({
            success: true,
            request
        }, 'Successfully joined volunteer request', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
