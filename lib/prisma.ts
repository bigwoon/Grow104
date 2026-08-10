import { PrismaClient } from '@prisma/client';

declare global {
    var prisma: PrismaClient | undefined;
}

// CRITICAL: Configure connection pooling for serverless environments
// This prevents connection exhaustion with Neon DB
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

// Graceful connection handling
prisma.$connect()
    .then(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('✅ Database connected successfully');
        }
    })
    .catch((error) => {
        console.error('❌ Failed to connect to database:', error.message);
        // Don't exit in serverless - let individual requests fail gracefully
    });

// Cleanup on process termination (for local dev)
if (process.env.NODE_ENV !== 'production') {
    process.on('beforeExit', async () => {
        await prisma.$disconnect();
    });
}

export default prisma;
