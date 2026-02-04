import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, validateRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import {
    GardenerRequestCreateSchema,
    GardenerRequestUpdateSchema,
    VolunteerRequestCreateSchema,
    VolunteerRequestUpdateSchema
} from '../lib/validation';
import { getGardenerGarden } from '../lib/utils';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { type, id, action } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    // Route to gardener or volunteer request handlers based on type
    if (type === 'gardener') {
        if (req.method === 'GET') return handleGardenerList(req, res, origin);
        if (req.method === 'POST') return handleGardenerCreate(req, res, origin);
        if (req.method === 'PUT' && id && typeof id === 'string') return handleGardenerUpdate(req, res, id, origin);
        if (req.method === 'DELETE' && id && typeof id === 'string') return handleGardenerDelete(req, res, id, origin);
    }

    if (type === 'volunteer') {
        if (req.method === 'GET') return handleVolunteerList(req, res, origin);
        if (req.method === 'POST') {
            if (action === 'join' && id && typeof id === 'string') return handleVolunteerJoin(req, res, id, origin);
            return handleVolunteerCreate(req, res, origin);
        }
        if (req.method === 'PUT' && id && typeof id === 'string') return handleVolunteerUpdate(req, res, id, origin);
        if (req.method === 'DELETE' && id && typeof id === 'string') return handleVolunteerDelete(req, res, id, origin);
    }

    return res.status(400).json(handleError(new Error('Invalid request type. Use ?type=gardener or ?type=volunteer'), origin));
}

// ============================================
// GARDENER REQUEST HANDLERS
// ============================================

async function handleGardenerList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { requestType, status } = req.query;

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

        return res.status(200).json(successResponse(requests, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleGardenerCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const validatedData = validateRequest(GardenerRequestCreateSchema, req.body);

        const request = await prisma.gardenerRequest.create({
            data: {
                requesterId: user.id,
                ...validatedData,
                supplyIds: validatedData.supplyIds || [],
                seedlingIds: validatedData.seedlingIds || [],
                quantity: validatedData.quantity || null,
                householdSize: validatedData.householdSize || null,
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

        return res.status(201).json(successResponse(request, 'Request submitted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleGardenerUpdate(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const existingRequest = await prisma.gardenerRequest.findUnique({
            where: { id }
        });

        if (!existingRequest) {
            return res.status(404).json(handleError(new Error('Request not found'), origin));
        }

        // Only admin or request creator can update
        if (user.role !== 'Admin' && existingRequest.requesterId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        const validatedData = validateRequest(GardenerRequestUpdateSchema, req.body);

        const request = await prisma.gardenerRequest.update({
            where: { id },
            data: {
                ...validatedData,
                supplyIds: validatedData.supplyIds !== undefined ? validatedData.supplyIds : undefined,
                seedlingIds: validatedData.seedlingIds !== undefined ? validatedData.seedlingIds : undefined,
                quantity: validatedData.quantity !== undefined ? validatedData.quantity : undefined,
                householdSize: validatedData.householdSize !== undefined ? validatedData.householdSize : undefined
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

        return res.status(200).json(successResponse(request, 'Request updated successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleGardenerDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const existingRequest = await prisma.gardenerRequest.findUnique({
            where: { id }
        });

        if (!existingRequest) {
            return res.status(404).json(handleError(new Error('Request not found'), origin));
        }

        // Only admin or request creator can delete
        if (user.role !== 'Admin' && existingRequest.requesterId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        await prisma.gardenerRequest.delete({
            where: { id }
        });

        return res.status(200).json(successResponse({ success: true }, 'Request deleted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

// ============================================
// VOLUNTEER REQUEST HANDLERS
// ============================================

async function handleVolunteerList(req: VercelRequest, res: VercelResponse, origin?: string) {
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

async function handleVolunteerCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const validatedData = validateRequest(VolunteerRequestCreateSchema, req.body);

        let finalGardenId = validatedData.gardenId;
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
                title: validatedData.title,
                description: validatedData.description,
                date: new Date(validatedData.date),
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

async function handleVolunteerJoin(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
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

async function handleVolunteerUpdate(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const existingRequest = await prisma.volunteerRequest.findUnique({
            where: { id }
        });

        if (!existingRequest) {
            return res.status(404).json(handleError(new Error('Request not found'), origin));
        }

        // Only admin or request creator can update
        if (user.role !== 'Admin' && existingRequest.requesterId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        const validatedData = validateRequest(VolunteerRequestUpdateSchema, req.body);

        const request = await prisma.volunteerRequest.update({
            where: { id },
            data: {
                ...validatedData,
                date: validatedData.date ? new Date(validatedData.date) : undefined
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

        return res.status(200).json(successResponse(request, 'Volunteer request updated successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleVolunteerDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const existingRequest = await prisma.volunteerRequest.findUnique({
            where: { id }
        });

        if (!existingRequest) {
            return res.status(404).json(handleError(new Error('Request not found'), origin));
        }

        // Only admin or request creator can delete
        if (user.role !== 'Admin' && existingRequest.requesterId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        await prisma.volunteerRequest.delete({
            where: { id }
        });

        return res.status(200).json(successResponse({ success: true }, 'Volunteer request deleted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
