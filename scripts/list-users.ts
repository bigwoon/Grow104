
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listAllUsers() {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, name: true, email: true, role: true }
        });

        console.log(`Total users: ${users.length}`);
        users.forEach(u => {
            console.log(`- ${u.name} (${u.email}) | Role: ${u.role} | ID: ${u.id}`);
        });
    } catch (error: any) {
        console.error('Error listing users:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

listAllUsers();
