import { VercelRequest, VercelResponse } from '@vercel/node';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from './prisma';
import { handleError, setCorsHeaders } from './response';
import { handleCorsPreflightRequest } from './cors';

export interface AuthenticatedRequest extends VercelRequest {
    user?: {
        id: string;
        email: string;
        role: string;
        name?: string;
    };
}

/** JWT payload shape signed by this backend */
interface JwtPayload {
    id: string;
    email: string;
    role: string;
    name?: string;
    iat?: number;
    exp?: number;
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
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload; // Bug #9: typed, not any
        req.user = {
            id: decoded.id,
            email: decoded.email,
            role: decoded.role,
            name: decoded.name
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
    const userRole = (user.role || '').toLowerCase();
    const allowed = allowedRoles.map(r => r.toLowerCase());
    if (!allowed.includes(userRole)) {
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
    if (role.toLowerCase() === 'admin') {
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

/**
 * Declarative authentication and authorization wrapper for Vercel Serverless Functions.
 * Handles CORS preflight, JWT validation, database fallback for roles, and automated error handling.
 */
export function withAuth(allowedRoles?: string[]) {
    return (handler: (req: AuthenticatedRequest, res: VercelResponse, user: { id: string; email: string; role: string }) => Promise<any>) => {
        return async (req: VercelRequest, res: VercelResponse) => {
            const origin = req.headers.origin;
            if (req.method === 'OPTIONS') {
                return handleCorsPreflightRequest(req, res, origin);
            }
            try {
                const user = authenticate(req as AuthenticatedRequest);

                // Centralized DB fallback if role is missing in legacy tokens
                if (!user.role && user.id) {
                    const dbUser = await prisma.user.findUnique({
                        where: { id: user.id },
                        select: { role: true }
                    });
                    if (dbUser) {
                        user.role = dbUser.role;
                    }
                }

                if (allowedRoles && allowedRoles.length > 0) {
                    requireRole(user, allowedRoles);
                }

                return await handler(req as AuthenticatedRequest, res, user);
            } catch (error: any) {
                setCorsHeaders(res, origin);
                const { status, payload } = handleError(error);
                return res.status(status).json(payload);
            }
        };
    };
}
