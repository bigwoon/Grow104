
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function auditOthers() {
    try {
        const notifications = await prisma.notification.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true, email: true } } }
        });

        console.log(`Last ${notifications.length} notifications:`);
        notifications.forEach(n => {
            console.log(`- To: ${n.user.name} | Title: ${n.title} | Msg: ${n.message}`);
        });

        const reports = await prisma.report.findMany({
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: { user: { select: { name: true, email: true } } }
        });

        console.log(`\nLast ${reports.length} reports:`);
        reports.forEach(r => {
            console.log(`- From: ${r.user.name} | Title: ${r.title} | Type: ${r.type}`);
        });
    } catch (error: any) {
        console.error('Error auditing:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

auditOthers();
