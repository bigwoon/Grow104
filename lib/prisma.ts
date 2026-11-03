import { PrismaClient } from '@prisma/client';

declare global {
    var prisma: PrismaClient | undefined;
}

// CRITICAL: Configure connection pooling for serverless environments.
// Prisma connects lazily on the first query — do NOT call $connect() at
// module level in serverless environments. Doing so causes unnecessary
// cold-start latency and can trigger unhandled promise rejections when the
// lambda boots before the NeonDB network pool is ready.
const prisma = global.prisma || new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
        db: {
            url: process.env.DATABASE_URL
        }
    }
});

// Cache Prisma Client in development to avoid creating new instances on hot reload
if (process.env.NODE_ENV !== 'production') {
    global.prisma = prisma;
}

// Graceful disconnect on process exit (local dev only — not needed in serverless)
if (process.env.NODE_ENV !== 'production') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect();
    });
}

export default prisma;
