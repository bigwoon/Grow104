/**
 * Get CORS origin based on request
 * Allows production domain and localhost for development
 */
const getAllowedOrigin = (origin?: string): string => {
    const allowedOrigins = [
        'https://grow104.org',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174'
    ];

    if (origin && allowedOrigins.includes(origin)) {
        return origin;
    }

    // Default to production domain
    return 'https://grow104.org';
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
export const handleError = (error: any) => {
    // Authentication errors
    if (error.message === 'NO_TOKEN') {
        return errorResponse('No authentication token provided', 401);
    }
    if (error.message === 'INVALID_TOKEN') {
        return errorResponse('Invalid or expired token', 401);
    }
    if (error.message === 'INSUFFICIENT_PERMISSIONS') {
        return errorResponse('Insufficient permissions', 403);
    }

    // Business logic errors
    if (error.message === 'GARDEN_EXISTS_AT_ADDRESS') {
        return {
            statusCode: 409,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': getAllowedOrigin(),
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
        return errorResponse('A record with this value already exists', 409);
    }
    if (error.code === 'P2025') {
        return errorResponse('Record not found', 404);
    }

    // Default error
    console.error('Unhandled error:', error);
    return errorResponse(error.message || 'Internal server error', 500);
};
