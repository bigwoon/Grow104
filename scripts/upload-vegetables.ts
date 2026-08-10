import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface VegetableCSVRow {
    name: string;
    category?: string;
    description?: string;
}

/**
 * Parse CSV file
 */
function parseCSV(filePath: string): VegetableCSVRow[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const rows: VegetableCSVRow[] = [];

    for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
        const row: any = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        rows.push(row as VegetableCSVRow);
    }

    return rows;
}

/**
 * Upload vegetables/seedlings from CSV
 */
async function uploadVegetables(csvPath: string) {
    console.log('🥬 Starting vegetable/seedling CSV upload...\n');

    try {
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }

        console.log('📄 Parsing CSV file...');
        const vegetables = parseCSV(csvPath);
        console.log(`✅ Found ${vegetables.length} vegetables/seedlings in CSV\n`);

        console.log('📤 Uploading to database...');
        let successCount = 0;
        let skipCount = 0;

        for (let i = 0; i < vegetables.length; i++) {
            const veg = vegetables[i];
            const lineNumber = i + 2;

            try {
                // Check if vegetable already exists
                const existing = await prisma.vegetable.findFirst({
                    where: { name: veg.name }
                });

                if (existing) {
                    console.log(`⏭️  Line ${lineNumber}: "${veg.name}" already exists, skipping...`);
                    skipCount++;
                    continue;
                }

                // Create vegetable
                await prisma.vegetable.create({
                    data: {
                        name: veg.name,
                        category: veg.category || 'General',
                        description: veg.description || `Fresh ${veg.name} seedlings and seeds`
                    }
                });

                successCount++;
                console.log(`✅ Line ${lineNumber}: Created "${veg.name}"`);

            } catch (error: any) {
                console.error(`❌ Line ${lineNumber}: Failed to create "${veg.name}" - ${error.message}`);
            }
        }

        console.log('\n📊 Upload Summary:');
        console.log(`  ✅ Created: ${successCount}`);
        console.log(`  ⏭️  Skipped: ${skipCount}`);
        console.log(`  📝 Total: ${vegetables.length}`);

    } catch (error: any) {
        console.error('\n❌ Upload failed:', error.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

// Run script
const csvPath = process.argv[2];

if (!csvPath) {
    console.error('Usage: npx ts-node scripts/upload-vegetables.ts <path-to-csv>');
    console.error('Example: npx ts-node scripts/upload-vegetables.ts vegetables.csv');
    process.exit(1);
}

uploadVegetables(csvPath);
