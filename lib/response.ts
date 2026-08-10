/**
 * Get CORS origin based on request
 * Allows production domain and localhost for development
 */
/**
 * Get CORS origin based on request
 * Allows production domain and localhost for development
 */
export const getAllowedOrigin = (origin?: string | string[]): string => {
    // Prefer explicit env var, fall back to canonical www form
    const defaultOrigin = process.env.FRONTEND_URL || 'https://www.grow104.org';

    // If multiple origins are provided (though rare in headers), take the first one
    const checkOrigin = Array.isArray(origin) ? origin[0] : origin;

    if (!checkOrigin) return defaultOrigin;

    // Normalize: remove trailing slash and convert to lowercase
    const normalizedOrigin = checkOrigin.replace(/\/$/, '').toLowerCase();

    const allowedOrigins = [
        'https://www.grow104.org',   // canonical production (with www)
        'https://grow104.org',        // production (without www)
        'https://grow104-snowy.vercel.app', // current backend deployment
        'https://sc-garden-app.vercel.app', // legacy backend fallback
        'http://localhost:3000',
        'https://localhost:3000',
        'http://localhost:5173',
        'https://localhost:5173',
        'http://localhost:5174',
        'https://localhost:5174',
        'http://127.0.0.1:3000',
        'https://127.0.0.1:3000'
    ].map(o => o.toLowerCase());

    if (allowedOrigins.includes(normalizedOrigin)) {
        return checkOrigin; // Echo back the exact origin the browser sent
    }

    // Allow any localhost origin in development
    if (normalizedOrigin.includes('localhost') || normalizedOrigin.includes('127.0.0.1')) {
        return checkOrigin;
    }

    // Allow Vercel preview deployments
    if (normalizedOrigin.endsWith('.vercel.app')) {
        return checkOrigin;
    }

    return defaultOrigin;
};

/**
 * Set standardized CORS headers for Vercel response
 */
export const setCorsHeaders = (res: any, origin?: string | string[]) => {
    res.setHeader('Access-Control-Allow-Origin', getAllowedOrigin(origin));
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.setHeader('Vary', 'Origin');
};

/**
 * Standardized success response payload
 */
export const successResponse = (data: any, message?: string) => {
    return {
        success: true,
        data,
        ...(message && { message })
    };
};

/**
 * Standardized error response payload
 */
export const errorResponse = (error: string, statusCode: number = 500) => {
    return {
        success: false,
        error,
        statusCode
    };
};

/**
 * Map common errors to appropriate status codes and messages
 */
export const handleError = (error: any) => {
    // Zod validation errors
    if (error.name === 'ZodError' || error.constructor?.name === 'ZodError') {
        const validationErrors = error.errors?.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
        })) || [];
        return {
            status: 400,
            payload: {
                success: false,
                error: 'Validation failed',
                validationErrors,
                statusCode: 400
            }
        };
    }

    const message = error.message || '';

    // Authentication & Authorization errors
    if (message === 'NO_TOKEN') {
        return { status: 401, payload: errorResponse('No authentication token provided', 401) };
    }
    if (message === 'INVALID_TOKEN' || message.includes('jwt expired')) {
        return { status: 401, payload: errorResponse('Invalid or expired token', 401) };
    }
    if (message === 'INSUFFICIENT_PERMISSIONS' || message === 'Unauthorized') {
        return { status: 403, payload: errorResponse('Insufficient permissions', 403) };
    }

    // Business logic errors (404s)
    if (message === 'GARDEN_NOT_FOUND' || message === 'User not found' || message === 'NO_GARDEN_ASSIGNMENT' || message === 'Notification not found' || message === 'Request not found') {
        return { status: 404, payload: errorResponse(message, 404) };
    }

    // Conflict errors
    if (message === 'GARDEN_EXISTS_AT_ADDRESS') {
        return {
            status: 409,
            payload: {
                success: false,
                error: 'GARDEN_EXISTS_AT_ADDRESS',
                data: error.data
            }
        };
    }

    // Prisma errors
    if (error.code === 'P2002') {
        return { status: 409, payload: errorResponse('A record with this value already exists', 409) };
    }
    if (error.code === 'P2025' || message.includes('Record to delete does not exist')) {
        return { status: 404, payload: errorResponse('Record not found', 404) };
    }

    // Default error
    console.error('--- UNHANDLED ERROR ---');
    console.error('Message:', message);
    console.error('Code:', error.code);
    console.error('Stack:', error.stack);
    console.error('-----------------------');

    return { status: 500, payload: errorResponse(message || 'Internal server error', 500) };
};

/**
 * Enhanced JSON stringify that handles BigInt AND Prisma Decimal
 */
export const safeJsonStringify = (obj: any) => {
    return JSON.stringify(obj, (key, value) => {
        // Handle BigInt
        if (typeof value === 'bigint') {
            return value.toString();
        }

        // Handle Prisma/Decimal.js objects (they have a toJSON or d/s properties)
        if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || value._isDecimal)) {
            return Number(value);
        }

        return value;
    });
};

/**
 * Validation error response for Zod errors
 */
export const validationErrorResponse = (errors: { field: string; message: string }[]) => {
    return {
        success: false,
        error: 'Validation failed',
        validationErrors: errors,
        statusCode: 400
    };
};

