import { VercelRequest } from '@vercel/node';
import jwt from 'jsonwebtoken';

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
