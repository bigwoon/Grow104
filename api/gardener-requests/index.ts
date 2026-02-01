import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import prisma from '../../lib/prisma';

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
        const { requestType, status } = req.query;

        // Build filter
        const where: any = {};
        if (requestType && typeof requestType === 'string') {
            where.requestType = requestType;
        }
        if (status && typeof status === 'string') {
            where.status = status;
        }

        const requests = await prisma.gardenerRequest.findMany({
            where,
            include: {
                requester: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        address: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(requests, undefined, origin));

    } catch (error: any) {
        console.error('List gardener requests error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const {
            title,
            description,
            requestType,
            supplyIds,
            seedlingIds,
            season,
            quantity,
            assistanceType,
            householdSize,
            task,
            notes
        } = req.body;

        if (!title || !description || !requestType) {
            return res.status(400).json(handleError(new Error('Missing required fields')));
        }

        // Validate request type
        if (!['supplies', 'seedlings', 'food-utility', 'volunteer-help'].includes(requestType)) {
            return res.status(400).json(handleError(new Error('Invalid request type')));
        }

        // Create gardener request
        const request = await prisma.gardenerRequest.create({
            data: {
                requesterId: user.id,
                title,
                description,
                requestType,
                supplyIds: supplyIds || [],
                seedlingIds: seedlingIds || [],
                season,
                quantity: quantity ? parseInt(quantity) : null,
                assistanceType,
                householdSize: householdSize ? parseInt(householdSize) : null,
                task,
                notes,
                status: 'pending'
            },
            include: {
                requester: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        address: true
                    }
                }
            }
        });

        const origin = req.headers.origin;
        return res.status(201).json(successResponse(request, 'Request submitted successfully', origin));

    } catch (error: any) {
        console.error('Create gardener request error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
