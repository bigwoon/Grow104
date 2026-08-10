import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('--- Hours Worked Audit ---\n');

        const reports = await prisma.report.findMany({
            select: {
                hoursWorked: true,
                user: { select: { name: true, role: true } },
                createdAt: true
            }
        });

        let totalHours = 0;
        let reportWithHoursCount = 0;

        reports.forEach(report => {
            if (report.hoursWorked) {
                const hours = Number(report.hoursWorked);
                totalHours += hours;
                reportWithHoursCount++;
            }
        });

        console.log(`Total Reports: ${reports.length}`);
        console.log(`Reports with Hours: ${reportWithHoursCount}`);
        console.log(`Total Hours Worked: ${totalHours.toFixed(2)}`);

        if (reports.length > 0) {
            console.log('\n--- Recent Work Items ---');
            const sorted = reports
                .filter(r => r.hoursWorked !== null)
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 5);

            sorted.forEach(r => {
                console.log(`- ${r.user?.name || 'Unknown'} worked ${r.hoursWorked} hours on ${new Date(r.createdAt).toLocaleDateString()}`);
            });
        }

    } catch (error: any) {
        console.error('❌ Error during audit:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

main();
