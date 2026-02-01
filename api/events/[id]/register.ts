import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../../lib/middleware';
import { successResponse, handleError } from '../../../lib/response';
import prisma from '../../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json(handleError(new Error('Event ID is required')));
        }

        // Check if event exists and has capacity
        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { registrations: true }
                }
            }
        });

        if (!event) {
            return res.status(404).json(handleError(new Error('Event not found')));
        }

        if (event.maxParticipants && event._count.registrations >= event.maxParticipants) {
            return res.status(400).json(handleError(new Error('Event is full')));
        }

        // Check if already registered
        const existing = await prisma.eventRegistration.findUnique({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId: user.id
                }
            }
        });

        if (existing) {
            return res.status(400).json(handleError(new Error('Already registered for this event')));
        }

        // Register user
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

        const origin = req.headers.origin;
        return res.status(201).json(successResponse(registration, 'Successfully registered for event', origin));

    } catch (error: any) {
        console.error('Register for event error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
