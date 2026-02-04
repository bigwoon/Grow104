import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method === 'GET') {
        // Handle map data request
        if (action === 'map') return handleMapData(req, res, origin);

        // Handle single garden or list
        if (id && typeof id === 'string') {
            return handleGetSingle(req, res, id, origin);
        }
        return handleList(req, res, origin);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);

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

        return res.status(200).json(successResponse(gardens, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleGetSingle(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);

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
            return res.status(404).json(handleError(new Error('Garden not found'), origin));
        }

        return res.status(200).json(successResponse(garden, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleMapData(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);

        // Get all active gardens with their locations for map display
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

        return res.status(200).json(successResponse(gardens, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
