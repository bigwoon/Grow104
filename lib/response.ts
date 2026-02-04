/**
 * Get CORS origin based on request
 * Allows production domain and localhost for development
 */
const getAllowedOrigin = (origin?: string): string => {
    // Use FRONTEND_URL from environment variables
    const productionUrl = process.env.FRONTEND_URL || 'https://www.grow104.org';

    const allowedOrigins = [
        productionUrl,                      // Primary production URL (with www)
        'https://www.grow104.org',          // Production with www
        'https://grow104.org',              // Production without www
        'http://localhost:3000',            // Local dev (React default)
        'https://localhost:3000',
        'http://localhost:5173',            // Local dev (Vite default)
        'https://localhost:5173',
        'http://localhost:5174',            // Local dev (Vite alternate)
        'https://localhost:5174',
        'http://127.0.0.1:3000',            // Local dev (IP)
        'https://127.0.0.1:3000'
    ];

    if (origin && allowedOrigins.includes(origin)) {
        return origin;
    }

    // Allow any localhost origin in development
    if (origin && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return origin;
    }

    // Default to production domain
    return productionUrl;
};

/**
 * Standardized success response
 */
export const successResponse = (data: any, message?: string, origin?: string) => {
    return {
        statusCode: 200,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': getAllowedOrigin(origin),
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
            success: true,
            data,
            ...(message && { message })
        })
    };
};

/**
 * Standardized error response
 */
export const errorResponse = (error: string, statusCode: number = 500, origin?: string) => {
    return {
        statusCode,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': getAllowedOrigin(origin),
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
            success: false,
            error,
            statusCode
        })
    };
};

/**
 * Map common errors to appropriate status codes and messages
 */
export const handleError = (error: any, origin?: string) => {
    // Zod validation errors
    if (error.name === 'ZodError') {
        const validationErrors = error.errors.map((err: any) => ({
            field: err.path.join('.'),
            message: err.message,
        }));
        return {
            statusCode: 400,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': getAllowedOrigin(origin),
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'true'
            },
            body: JSON.stringify({
                success: false,
                error: 'Validation failed',
                validationErrors,
                statusCode: 400
            })
        };
    }

    // Authentication errors
    if (error.message === 'NO_TOKEN') {
        return errorResponse('No authentication token provided', 401, origin);
    }
    if (error.message === 'INVALID_TOKEN') {
        return errorResponse('Invalid or expired token', 401, origin);
    }
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
        return errorResponse('Insufficient permissions', 403, origin);
    }

    // Business logic errors
    if (error.message === 'GARDEN_EXISTS_AT_ADDRESS') {
        return {
            statusCode: 409,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': getAllowedOrigin(origin),
                'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                'Access-Control-Allow-Credentials': 'true'
            },
            body: JSON.stringify({
                success: false,
                error: 'GARDEN_EXISTS_AT_ADDRESS',
                data: error.data
            })
        };
    }

    // Validation errors
    if (error.code === 'P2002') {
        return errorResponse('A record with this value already exists', 409, origin);
    }
    if (error.code === 'P2025') {
        return errorResponse('Record not found', 404, origin);
    }

    // Default error
    console.error('Unhandled error:', error);
    return errorResponse(error.message || 'Internal server error', 500, origin);
};

/**
 * Validation error response for Zod errors
 */
export const validationErrorResponse = (errors: { field: string; message: string }[], origin?: string) => {
    return {
        statusCode: 400,
        headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': getAllowedOrigin(origin),
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Credentials': 'true'
        },
        body: JSON.stringify({
            success: false,
            error: 'Validation failed',
            validationErrors: errors,
            statusCode: 400
        })
    };
};

