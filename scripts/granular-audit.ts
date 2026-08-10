import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkTable(name: string, model: any) {
    try {
        const count = await model.count();
        console.log(`✅ ${name}: ${count} records`);
    } catch (error: any) {
        console.log(`❌ ${name}: Error - ${error.message.split('\n')[0]}`);
    }
}

async function main() {
    console.log('--- Granular Database Audit ---\n');

    await checkTable('User', prisma.user);
    await checkTable('Garden', prisma.garden);
    await checkTable('VolunteerRequest', prisma.volunteerRequest);
    await checkTable('GardenerRequest', prisma.gardenerRequest);
    await checkTable('SupplyItem', prisma.supplyItem);
    await checkTable('SeedlingItem', prisma.seedlingItem);
    await checkTable('Vegetable', prisma.vegetable);
    await checkTable('GardenInventory', prisma.gardenInventory);
    await checkTable('Event', prisma.event);
    await checkTable('Message', prisma.message);
    await checkTable('Notification', prisma.notification);

    await prisma.$disconnect();
}

main();
