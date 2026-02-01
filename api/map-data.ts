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

        // Get all active gardens with their locations
        const gardens = await prisma.garden.findMany({
            where: {
                status: 'active',
                latitude: { not: null },
                longitude: { not: null }
            },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                zipcode: true,
                owner: {
                    select: {
                        id: true,
                        name: true
                    }
                },
                _count: {
                    select: {
                        gardenGardeners: true,
                        gardenVolunteers: true,
                        volunteerRequests: {
                            where: { status: 'open' }
                        }
                    }
                }
            }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(gardens, undefined, origin));

    } catch (error: any) {
        console.error('Get map data error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
