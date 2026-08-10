import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findAllAdmins() {
    try {
        const users = await prisma.user.findMany({
            where: {
                role: {
                    in: ['Admin', 'admin', 'ADMIN']
                }
            },
            select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true }
        });

        console.log(`\nTotal admin accounts found: ${users.length}\n`);
        users.forEach(u => {
            console.log(`Name:      ${u.name}`);
            console.log(`Email:     ${u.email}`);
            console.log(`Role:      ${u.role}`);
            console.log(`Active:    ${u.isActive}`);
            console.log(`Created:   ${u.createdAt}`);
            console.log(`ID:        ${u.id}`);
            console.log('---');
        });
    } catch (error: any) {
        console.error('Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

findAllAdmins();
