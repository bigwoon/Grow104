import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function testMessageCreation() {
    try {
        console.log('Testing message creation...');

        // Get two users to test with
        const users = await prisma.user.findMany({ take: 2 });

        if (users.length < 2) {
            console.error('Need at least 2 users in database');
            return;
        }

        console.log(`From: ${users[0].name} (${users[0].id})`);
        console.log(`To: ${users[1].name} (${users[1].id})`);

        // Try to create a message
        const message = await prisma.message.create({
            data: {
                fromUserId: users[0].id,
                toUserId: users[1].id,
                subject: 'Test Message',
                content: 'This is a test message to verify message creation works'
            },
            include: {
                fromUser: { select: { id: true, name: true, email: true } },
                toUser: { select: { id: true, name: true, email: true } }
            }
        });

        console.log('\n✅ Message created successfully:');
        console.log(JSON.stringify(message, null, 2));

        // Verify it's in the database
        const count = await prisma.message.count();
        console.log(`\nTotal messages in database: ${count}`);

    } catch (error: any) {
        console.error('❌ Error creating message:', error.message);
        console.error('Full error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

testMessageCreation();
