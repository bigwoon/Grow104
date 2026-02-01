import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../../lib/middleware';
import { successResponse, handleError } from '../../../lib/response';
import prisma from '../../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json(handleError(new Error('Garden ID is required')));
        }

        const garden = await prisma.garden.findUnique({
            where: { id },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                        phone: true
                    }
                },
                gardenGardeners: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                                phone: true,
                                growing: true
                            }
                        }
                    }
                },
                gardenVolunteers: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                email: true,
                                avatarUrl: true,
                                phone: true
                            }
                        }
                    }
                },
                events: {
                    where: {
                        date: {
                            gte: new Date()
                        }
                    },
                    orderBy: { date: 'asc' },
                    take: 10
                },
                volunteerRequests: {
                    where: { status: 'open' },
                    orderBy: { createdAt: 'desc' },
                    take: 10
                },
                reports: {
                    orderBy: { createdAt: 'desc' },
                    take: 10,
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                avatarUrl: true
                            }
                        }
                    }
                }
            }
        });

        if (!garden) {
            return res.status(404).json(handleError(new Error('Garden not found')));
        }

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(garden, undefined, origin));

    } catch (error: any) {
        console.error('Get garden error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
