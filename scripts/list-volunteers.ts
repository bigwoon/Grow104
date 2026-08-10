
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listVolunteers() {
    try {
        const volunteers = await prisma.user.findMany({
            where: { role: 'Volunteer' }
        });

        console.log(`Found ${volunteers.length} volunteers:`);
        volunteers.forEach(v => {
            console.log(`- ${v.name} (${v.email}) | ID: ${v.id}`);
        });
    } catch (error: any) {
        console.error('Error listing volunteers:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

listVolunteers();
