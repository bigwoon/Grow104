
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function findUser() {
    try {
        const user = await prisma.user.findFirst({
            where: {
                OR: [
                    { email: { contains: 'sowande', mode: 'insensitive' } },
                    { email: { contains: 'sowandec', mode: 'insensitive' } }
                ]
            }
        });

        if (user) {
            console.log('User found:');
            console.log('Email:', user.email);
            console.log('Password Hash:', user.password);
            console.log('Name:', user.name);
            console.log('Role:', user.role);
        } else {
            console.log('User not found.');
        }
    } catch (error: any) {
        console.error('Error finding user:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

findUser();
