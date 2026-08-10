import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
    console.log('🚀 Starting Database Reset...');

    try {
        // 1. Delete transactional/referential data first to avoid constraint errors
        console.log('🗑️  Deleting transactional data...');

        // Many-to-many and leaf nodes
        await prisma.eventRegistration.deleteMany();
        await prisma.volunteerAssignment.deleteMany();
        await prisma.gardenGardener.deleteMany();
        await prisma.gardenVolunteer.deleteMany();
        await prisma.gardenInventory.deleteMany();

        // Core records
        await prisma.message.deleteMany();
        await prisma.notification.deleteMany();
        await prisma.report.deleteMany();
        await prisma.task.deleteMany();
        await prisma.gardenerRequest.deleteMany();
        await prisma.volunteerRequest.deleteMany();

        // Records referencing gardens/events
        await prisma.event.deleteMany();
        await prisma.gardenInvitation.deleteMany();
        await prisma.invitation.deleteMany();

        // Gardens (referenced by many)
        await prisma.garden.deleteMany();

        // Items
        await prisma.supplyItem.deleteMany();
        await prisma.seedlingItem.deleteMany();
        await prisma.vegetable.deleteMany();

        // Finally, delete all users
        console.log('🗑️  Deleting all users...');
        await prisma.user.deleteMany();

        console.log('✅ Database cleared successfully.');

        // 2. Create new Admin user
        console.log('👤 Creating new Admin user...');

        const email = 'admin@grow104.org';
        const password = 'Grow104Admin2026!';
        const name = 'System Admin';
        const role = 'Admin';

        const hashedPassword = await bcrypt.hash(password, 10);

        const admin = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
                isActive: true,
            },
        });

        console.log('✅ Admin user created:');
        console.log(`   Email: ${admin.email}`);
        console.log(`   Password: ${password}`);
        console.log(`   Role: ${admin.role}`);
        console.log('\n🚀 Reset process complete!');

    } catch (error) {
        console.error('❌ Error during database reset:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
