
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createAdmin() {
    const name = process.argv[2] || 'Super Admin';
    const email = process.argv[3] || 'admin@grow104.org';
    const password = process.argv[4] || 'Admin123!';

    try {
        const hashedPassword = await bcrypt.hash(password, 10);

        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                role: 'Admin',
                isActive: true
            },
            create: {
                name,
                email,
                password: hashedPassword,
                role: 'Admin',
                isActive: true
            }
        });

        console.log(`✅ Admin user created/updated: ${user.email}`);
        console.log(`🔑 Password: ${password}`);
    } catch (error) {
        console.error('❌ Error creating admin user:', error);
    } finally {
        await prisma.$disconnect();
    }
}

createAdmin();
