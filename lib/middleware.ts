import { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from './prisma';

export interface AuthenticatedRequest extends VercelRequest {
    user?: {
        id: string;
        email: string;
        role: string;
    };
}

/**
 * Authenticate user from JWT token in Authorization header
 * @throws Error if no token or invalid token
 */
export const authenticate = (req: AuthenticatedRequest) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        throw new Error('NO_TOKEN');
    }

    const token = authHeader.replace('Bearer ', '');

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role
        };
        return req.user;
    } catch (error) {
        throw new Error('INVALID_TOKEN');
    }
};

/**
 * Check if user has required role
 * @throws Error if user doesn't have required role
 */
export const requireRole = (user: { role: string }, allowedRoles: string[]) => {
    if (!allowedRoles.includes(user.role)) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
    }
};

/**
 * Check if user is admin
 * @throws Error if user is not admin
 */
export const requireAdmin = (user: { role: string }) => {
    requireRole(user, ['Admin']);
};

/**
 * Check if user is admin or gardener
 * @throws Error if user is neither admin nor gardener
 */
export const requireGardenerOrAdmin = (user: { role: string }) => {
    requireRole(user, ['Admin', 'Gardener']);
};

/**
 * Validate request body against Zod schema
 * @throws ZodError if validation fails
 */
export const validateRequest = <T>(schema: z.ZodSchema<T>, data: any): T => {
    return schema.parse(data);
};

/**
 * Check if user owns or is assigned to a garden
 * @throws Error if user doesn't have access to the garden
 */
export const requireGardenAccess = async (userId: string, gardenId: string, role: string) => {
    // Admins have access to all gardens
    if (role === 'Admin') {
        return;
    }

    const garden = await prisma.garden.findUnique({
        where: { id: gardenId },
        include: {
            gardenGardeners: {
                where: { userId }
            },
            gardenVolunteers: {
                where: { userId }
            }
        }
    });

    if (!garden) {
        throw new Error('GARDEN_NOT_FOUND');
    }

    // Check if user is owner, gardener, or volunteer
    const hasAccess =
        garden.ownerId === userId ||
        garden.gardenGardeners.length > 0 ||
        garden.gardenVolunteers.length > 0;

    if (!hasAccess) {
        throw new Error('INSUFFICIENT_PERMISSIONS');
    }
};
