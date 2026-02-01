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
        const { gardenId, type } = req.query;

        // Build filter
        const where: any = {
            date: { gte: new Date() } // Only future events
        };
        if (gardenId && typeof gardenId === 'string') {
            where.gardenId = gardenId;
        }
        if (type && typeof type === 'string') {
            where.type = type;
        }

        const events = await prisma.event.findMany({
            where,
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                },
                registrations: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                avatarUrl: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        registrations: true
                    }
                }
            },
            orderBy: { date: 'asc' }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(events, undefined, origin));

    } catch (error: any) {
        console.error('List events error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}

async function handlePost(req: VercelRequest, res: VercelResponse) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { title, type, description, gardenId, date, startTime, endTime, location, maxParticipants } = req.body;

        if (!title || !type || !description || !gardenId || !date || !startTime || !endTime) {
            return res.status(400).json(handleError(new Error('Missing required fields')));
        }

        // Validate event type
        if (!['harvest', 'planting', 'community'].includes(type)) {
            return res.status(400).json(handleError(new Error('Invalid event type')));
        }

        // Create event
        const event = await prisma.event.create({
            data: {
                title,
                type,
                description,
                gardenId,
                date: new Date(date),
                startTime,
                endTime,
                location,
                maxParticipants: maxParticipants ? parseInt(maxParticipants) : null,
                createdBy: user.id
            },
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            }
        });

        const origin = req.headers.origin;
        return res.status(201).json(successResponse(event, 'Event created successfully', origin));

    } catch (error: any) {
        console.error('Create event error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
