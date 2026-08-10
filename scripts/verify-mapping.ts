import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMapping() {
    const names = [
        'James Smith', 'Connie Snow', 'Aiden Roman', 'Suzette G Spears', 
        'Russell Jack', 'Henry Scott', 'Porsha Harvey', 'Cecilia Olvera', 
        'Jose Ibarra', 'Adylene Gonzales', 'Jessica Renteria', 'Annie Rico', 
        'Deja Jackson'
    ];

    console.log('🔍 Verifying 13 Gardeners on Database...\n');

    try {
        const gardens = await prisma.garden.findMany({
            where: {
                owner: {
                    name: { in: names }
                }
            },
            select: {
                name: true,
                latitude: true,
                longitude: true,
                status: true,
                owner: { select: { name: true } }
            }
        });

        console.log(`📊 Found ${gardens.length} gardens in database:`);
        console.log('----------------------------------------------------');
        
        gardens.forEach(g => {
            const hasCoords = g.latitude !== null && g.longitude !== null;
            console.log(`${hasCoords ? '✅' : '❌'} ${g.owner.name.padEnd(20)} | Status: ${g.status.padEnd(8)} | Coords: ${g.latitude}, ${g.longitude}`);
        });

        if (gardens.length < 13) {
            console.warn(`\n⚠️  Missing ${13 - gardens.length} gardens from the list.`);
        }
    } catch (error) {
        console.error('❌ Verification failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

verifyMapping();
