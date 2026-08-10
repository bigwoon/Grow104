import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Debugging /api/users?role=Gardener ---');

        const role = 'Gardener';
        const where: any = { role };

        console.log('Querying with where:', JSON.stringify(where, null, 2));

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    email: true,
                    name: true,
                    role: true,
                    avatarUrl: true,
                    zipcode: true,
                    phone: true,
                    address: true,
                    growing: true,
                    isOnline: true,
                    isActive: true,
                    lastSeen: true,
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count({ where })
        ]);

        console.log(`Success! Found ${users.length} users out of ${total} total for role "${role}".`);
        if (users.length > 0) {
            console.log('Sample user:', JSON.stringify(users[0], null, 2));
        }

    } catch (error: any) {
        console.error('❌ Error during debug:', error);
        if (error.code) console.error('Error Code:', error.code);
        if (error.meta) console.error('Error Meta:', error.meta);
    } finally {
        await prisma.$disconnect();
    }
}

main();
