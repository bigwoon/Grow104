import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    console.log('--- Database Stats ---');
    const userCount = await prisma.user.count();
    const gardenCount = await prisma.garden.count();
    const gardenGardenerCount = await prisma.gardenGardener.count();
    const gardenVolunteerCount = await prisma.gardenVolunteer.count();
    const activeGardens = await prisma.garden.count({ where: { status: 'active' } });

    console.log(`Users: ${userCount}`);
    console.log(`Gardens: ${gardenCount} (Active: ${activeGardens})`);
    console.log(`GardenGardener links: ${gardenGardenerCount}`);
    console.log(`GardenVolunteer links: ${gardenVolunteerCount}`);

    if (gardenCount > 0) {
        const firstGarden = await prisma.garden.findFirst({
            include: {
                gardenGardeners: true,
                gardenVolunteers: true
            }
        });
        console.log('\nSample Garden ID:', firstGarden?.id);
        console.log('Sample Garden Status:', firstGarden?.status);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
