const REQUIRED_ENV_VARS = [
    'DATABASE_URL',
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'CLOUDINARY_CLOUD_NAME',
    'CLOUDINARY_API_KEY',
    'CLOUDINARY_API_SECRET',
    'FRONTEND_URL'
    // UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN are optional — Redis is used for
    // caching and rate limiting only, and the app degrades gracefully without it.
];

let validationChecked = false;
let validationResult: { valid: boolean; missing: string[] } | null = null;

/**
 * Validate that all required environment variables are set
 * Only runs once per cold start (cached)
 */
export function validateEnvironment(): { valid: boolean; missing: string[] } {
    if (validationChecked) {
        return validationResult!;
    }

    const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);

    validationResult = {
        valid: missing.length === 0,
        missing
    };

    validationChecked = true;

    if (!validationResult.valid) {
        console.error('[ENV] Missing required environment variables:', missing);
    }

    return validationResult;
}

/**
 * Validate base64 image size
 * @param dataUri Base64 data URI or raw base64 string
 * @param maxSizeMB Maximum size in megabytes
 */
export function validateBase64ImageSize(dataUri: string, maxSizeMB: number = 5): boolean {
    try {
        // Remove data URI prefix if present
        const base64 = dataUri.includes(',') ? dataUri.split(',')[1] : dataUri;

        // Calculate size in bytes (base64 is ~33% larger than original)
        const sizeInBytes = (base64.length * 3) / 4;
        const sizeInMB = sizeInBytes / (1024 * 1024);

        return sizeInMB <= maxSizeMB;
    } catch (error) {
        console.error('[Validation] Error validating image size:', error);
        return false;
    }
}

/**
 * Get pagination parameters from request
 */
export function getPaginationParams(query: any) {
    const page = Math.max(1, parseInt(query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(query.limit as string) || 20), 100);
    const skip = (page - 1) * limit;

    return { page, limit, skip };
}

/**
 * Create pagination metadata for response
 */
export function createPaginationMeta(page: number, limit: number, total: number) {
    return {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1
    };
}
