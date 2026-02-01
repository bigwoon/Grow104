import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../../lib/middleware';
import { successResponse, handleError } from '../../../lib/response';
import { getGardenerGarden } from '../../../lib/utils';
import prisma from '../../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method === 'GET') {
        return handleGet(req, res);
    } else if (req.method === 'POST') {
        return handlePost(req, res);
    } else {
        return res.status(405).json({ error: 'Method not allowed' });
    }
}

async function handleGet(req: VercelRequest, res: VercelResponse) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { gardenId, status } = req.query;

        // Build filter
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

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(requests, undefined, origin));

    } catch (error: any) {
        console.error('List volunteer requests error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { gardenId, title, description, date } = req.body;

        if (!title || !description || !date) {
            return res.status(400).json(handleError(new Error('Missing required fields')));
        }

        // Auto-detect garden for gardeners if not provided
        let finalGardenId = gardenId;
        if (!finalGardenId && user.role === 'Gardener') {
            const garden = await getGardenerGarden(user.id);
            finalGardenId = garden.id;
        }

        if (!finalGardenId) {
            return res.status(400).json(handleError(new Error('Garden ID is required')));
        }

        // Create volunteer request
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

        const origin = req.headers.origin;
        return res.status(201).json(successResponse(request, 'Volunteer request created successfully', origin));

    } catch (error: any) {
        console.error('Create volunteer request error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
