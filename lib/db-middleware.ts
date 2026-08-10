import prisma from './prisma';

/**
 * Retry wrapper for database operations
 * Handles transient connection failures in serverless environments
 */
export async function withRetry<T>(
    operation: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
): Promise<T> {
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;

            // Don't retry on these errors (they're permanent)
            const nonRetryableErrors = [
                'P2002', // Unique constraint violation
                'P2003', // Foreign key constraint violation
                'P2025', // Record not found
                'VALIDATION_ERROR',
                'INSUFFICIENT_PERMISSIONS'
            ];

            if (nonRetryableErrors.some(code => error.code === code || error.message?.includes(code))) {
                throw error;
            }

            // Retry on connection errors
            const isConnectionError =
                error.code === 'P1001' || // Can't reach database
                error.code === 'P1002' || // Connection timeout
                error.code === 'P1008' || // Operations timed out
                error.message?.toLowerCase().includes('connection') ||
                error.message?.toLowerCase().includes('timeout') ||
                error.message?.toLowerCase().includes('econnrefused');

            if (!isConnectionError || attempt === maxRetries) {
                throw error;
            }

            // Exponential backoff with jitter
            const delay = baseDelay * Math.pow(2, attempt - 1) + Math.random() * 100;
            console.warn(`[DB Retry] Attempt ${attempt}/${maxRetries} failed, retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    throw lastError;
}

/**
 * Health check for database connectivity
 */
export async function checkDatabaseHealth(): Promise<{
    healthy: boolean;
    latency?: number;
    error?: string;
}> {
    const startTime = Date.now();

    try {
        await prisma.$queryRaw`SELECT 1`;
        const latency = Date.now() - startTime;

        return {
            healthy: true,
            latency
        };
    } catch (error: any) {
        return {
            healthy: false,
            error: error.message
        };
    }
}

/**
 * Execute a database operation with automatic retry logic
 * Use this wrapper for all critical database operations
 */
export async function executeWithRetry<T>(
    operation: () => Promise<T>,
    operationName?: string
): Promise<T> {
    try {
        return await withRetry(operation);
    } catch (error: any) {
        console.error(`[DB Error] ${operationName || 'Database operation'} failed:`, error.message);
        throw error;
    }
}
