import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    const origin = req.headers.origin;

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'POST') {
        if (action === 'register' && id && typeof id === 'string') return handleRegister(req, res, origin, id);
        if (action === 'unregister' && id && typeof id === 'string') return handleUnregister(req, res, origin, id);
        return handleCreate(req, res, origin);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { gardenId, type } = req.query;

        const where: any = {
            date: { gte: new Date() }
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

        return res.status(200).json(successResponse(events, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { title, type, description, gardenId, date, startTime, endTime, location, maxParticipants } = req.body;

        if (!title || !type || !description || !gardenId || !date || !startTime || !endTime) {
            return res.status(400).json(handleError(new Error('Missing required fields'), origin));
        }

        if (!['harvest', 'planting', 'community'].includes(type)) {
            return res.status(400).json(handleError(new Error('Invalid event type'), origin));
        }

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

        return res.status(201).json(successResponse(event, 'Event created successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleRegister(req: VercelRequest, res: VercelResponse, origin?: string, id: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { registrations: true }
                }
            }
        });

        if (!event) {
            return res.status(404).json(handleError(new Error('Event not found'), origin));
        }

        if (event.maxParticipants && event._count.registrations >= event.maxParticipants) {
            return res.status(400).json(handleError(new Error('Event is full'), origin));
        }

        const existing = await prisma.eventRegistration.findUnique({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId: user.id
                }
            }
        });

        if (existing) {
            return res.status(400).json(handleError(new Error('Already registered for this event'), origin));
        }

        const registration = await prisma.eventRegistration.create({
            data: {
                eventId: id,
                userId: user.id,
                status: 'registered'
            },
            include: {
                event: {
                    include: {
                        garden: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            }
        });

        return res.status(201).json(successResponse(registration, 'Successfully registered for event', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleUnregister(req: VercelRequest, res: VercelResponse, origin?: string, id: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        await prisma.eventRegistration.delete({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId: user.id
                }
            }
        });

        return res.status(200).json(successResponse({ success: true }, 'Registration cancelled successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
