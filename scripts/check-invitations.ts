
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkInvitations() {
    try {
        const invitations = await prisma.invitation.findMany({
            where: {
                OR: [
                    { email: { contains: 'sowande', mode: 'insensitive' } },
                    { email: { contains: 'sowandec', mode: 'insensitive' } }
                ]
            }
        });

        if (invitations.length > 0) {
            console.log(`Found ${invitations.length} invitations:`);
            invitations.forEach(i => {
                console.log(`- Email: ${i.email} | Token: ${i.token} | Status: ${i.status} | Role: ${i.role}`);
            });
        } else {
            console.log('No invitations found for this email.');
        }
    } catch (error: any) {
        console.error('Error checking invitations:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

checkInvitations();
