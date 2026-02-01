import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import prisma from '../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);

        const gardens = await prisma.garden.findMany({
            where: { status: 'active' },
            include: {
                owner: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                },
                gardenGardeners: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                avatarUrl: true,
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
                                avatarUrl: true
                            }
                        }
                    }
                },
                _count: {
                    select: {
                        events: true,
                        volunteerRequests: true,
                        reports: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(gardens, undefined, origin));

    } catch (error: any) {
        console.error('List gardens error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
