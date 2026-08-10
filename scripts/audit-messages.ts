
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditMessages() {
    try {
        const messages = await prisma.message.findMany({
            include: {
                fromUser: { select: { name: true, email: true, role: true } },
                toUser: { select: { name: true, email: true, role: true } }
            },
            orderBy: { createdAt: 'desc' },
            take: 10
        });

        console.log(`Last ${messages.length} messages:`);
        messages.forEach(m => {
            console.log(`- From: ${m.fromUser.name} (${m.fromUser.role}) -> To: ${m.toUser.name} (${m.toUser.role})`);
            console.log(`  Subject: ${m.subject}`);
            console.log(`  Content: ${m.content}`);
            console.log(`  Sent at: ${m.createdAt}`);
            console.log(`  Read: ${m.read}`);
            console.log('---');
        });
    } catch (error: any) {
        console.error('Error auditing messages:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

auditMessages();
