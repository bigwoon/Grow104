import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Report Data Diagnostic ---\n');

        const reports = await prisma.report.findMany({
            include: {
                user: { select: { id: true, name: true, role: true } },
                garden: { select: { id: true, name: true } }
            },
            take: 10,
            orderBy: { createdAt: 'desc' }
        });

        if (reports.length === 0) {
            console.log('No reports found.');
        }

        reports.forEach((report, index) => {
            console.log(`Report #${index + 1}:`);
            console.log(`- ID: ${report.id}`);
            console.log(`- Title: ${report.title}`);
            console.log(`- User ID: ${report.userId}`);
            console.log(`- User Name: ${report.user?.name || 'NULL'}`);
            console.log(`- User Role: ${report.user?.role || 'NULL'}`);
            console.log(`- Garden ID: ${report.gardenId || 'NULL'}`);
            console.log(`- Garden Name: ${report.garden?.name || 'NULL'}`);
            console.log(`- Created At: ${report.createdAt}`);
            console.log('-------------------\n');
        });

    } catch (error: any) {
        console.error('❌ Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
