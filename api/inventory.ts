import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { SupplyCreateSchema, SupplyUpdateSchema, SeedlingCreateSchema, SeedlingUpdateSchema } from '../lib/validation';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { type, id } = req.query;
    const origin = req.headers.origin;

    if (!type || (type !== 'supplies' && type !== 'seedlings')) {
        return res.status(400).json(handleError(new Error('Type parameter required (supplies or seedlings)'), origin));
    }

    if (req.method === 'GET') return handleList(req, res, origin, type as string);
    if (req.method === 'POST') return handleCreate(req, res, origin, type as string);
    if (req.method === 'PUT' && id && typeof id === 'string') return handleUpdate(req, res, origin, type as string, id);
    if (req.method === 'DELETE' && id && typeof id === 'string') return handleDelete(req, res, origin, type as string, id);

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, type: string, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);

        if (type === 'supplies') {
            const { category, available } = req.query;
            const where: any = {};

            if (category && typeof category === 'string') {
                where.category = category;
            }

            if (available !== undefined) {
                where.available = available === 'true';
            }

            const supplies = await prisma.supplyItem.findMany({
                where,
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: [
                    { available: 'desc' },
                    { name: 'asc' }
                ]
            });

            return res.status(200).json(successResponse(supplies, undefined, origin));
        } else {
            const { season, available } = req.query;
            const where: any = {};

            if (season && typeof season === 'string') {
                where.OR = [
                    { season: season },
                    { season: 'both' }
                ];
            }

            if (available !== undefined) {
                where.available = available === 'true';
            }

            const seedlings = await prisma.seedlingItem.findMany({
                where,
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                },
                orderBy: [
                    { available: 'desc' },
                    { name: 'asc' }
                ]
            });

            return res.status(200).json(successResponse(seedlings, undefined, origin));
        }
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, type: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        if (type === 'supplies') {
            const validatedData = validateRequest(SupplyCreateSchema, req.body);

            const supply = await prisma.supplyItem.create({
                data: {
                    ...validatedData,
                    createdBy: user.id
                },
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return res.status(201).json(successResponse(supply, 'Supply item created successfully', origin));
        } else {
            const validatedData = validateRequest(SeedlingCreateSchema, req.body);

            const seedling = await prisma.seedlingItem.create({
                data: {
                    ...validatedData,
                    createdBy: user.id
                },
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return res.status(201).json(successResponse(seedling, 'Seedling item created successfully', origin));
        }
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleUpdate(req: VercelRequest, res: VercelResponse, type: string, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        if (type === 'supplies') {
            const validatedData = validateRequest(SupplyUpdateSchema, req.body);

            const supply = await prisma.supplyItem.update({
                where: { id },
                data: validatedData,
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return res.status(200).json(successResponse(supply, 'Supply item updated successfully', origin));
        } else {
            const validatedData = validateRequest(SeedlingUpdateSchema, req.body);

            const seedling = await prisma.seedlingItem.update({
                where: { id },
                data: validatedData,
                include: {
                    creator: {
                        select: {
                            id: true,
                            name: true
                        }
                    }
                }
            });

            return res.status(200).json(successResponse(seedling, 'Seedling item updated successfully', origin));
        }
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, type: string, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        if (type === 'supplies') {
            await prisma.supplyItem.delete({
                where: { id }
            });

            return res.status(200).json(successResponse({ success: true }, 'Supply item deleted successfully', origin));
        } else {
            await prisma.seedlingItem.delete({
                where: { id }
            });

            return res.status(200).json(successResponse({ success: true }, 'Seedling item deleted successfully', origin));
        }
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
