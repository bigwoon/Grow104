import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Database Record Count Audit ---\n');

        const gardenCount = await prisma.garden.count();
        const userCount = await prisma.user.count();
        const volunteerRequestCount = await prisma.volunteerRequest.count();
        const gardenerRequestCount = await prisma.gardenerRequest.count();
        const supplyItemCount = await prisma.supplyItem.count();
        const seedlingItemCount = await prisma.seedlingItem.count();
        const vegetableCount = await prisma.vegetable.count();
        const inventoryCount = await prisma.gardenInventory.count();

        console.log(`🏠 Gardens: ${gardenCount}`);
        console.log(`👤 Users: ${userCount}`);
        console.log(`🙋 Volunteer Requests: ${volunteerRequestCount}`);
        console.log(`🌱 Gardener Requests: ${gardenerRequestCount}`);
        console.log(`🛠️ Supply Items: ${supplyItemCount}`);
        console.log(`🥦 Seedling Items: ${seedlingItemCount}`);
        console.log(`🥬 Vegetables (Global): ${vegetableCount}`);
        console.log(`📦 Garden Inventory items: ${inventoryCount}`);

        console.log('\n--- End Audit ---');
    } catch (error: any) {
        console.error('❌ Error during audit:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
