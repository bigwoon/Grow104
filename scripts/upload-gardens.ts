import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

interface GardenCSVRow {
    name: string;
    address: string;
    zipcode: string;
    ownerEmail: string;
    description?: string;
    latitude?: string;
    longitude?: string;
    vegetables?: string; // Comma-separated list of vegetable names
}

/**
 * Parse CSV file into array of objects
 */
function parseCSV(filePath: string): GardenCSVRow[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }

    // Parse header
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    // Parse rows
    const rows: GardenCSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: any = {};

        headers.forEach((header, index) => {
            row[header] = values[index] || '';
        });

        rows.push(row as GardenCSVRow);
    }

    return rows;
}

/**
 * Parse a CSV line handling quoted values
 */
function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    values.push(current.trim());

    return values;
}

/**
 * Validate garden data
 */
function validateGarden(garden: GardenCSVRow, lineNumber: number): string[] {
    const errors: string[] = [];

    if (!garden.name || garden.name.length < 2) {
        errors.push(`Line ${lineNumber}: Name is required (min 2 characters)`);
    }

    if (!garden.address || garden.address.length < 5) {
        errors.push(`Line ${lineNumber}: Address is required (min 5 characters)`);
    }

    if (!garden.zipcode || !/^\d{5}$/.test(garden.zipcode)) {
        errors.push(`Line ${lineNumber}: Zipcode must be 5 digits`);
    }

    if (!garden.ownerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(garden.ownerEmail)) {
        errors.push(`Line ${lineNumber}: Valid owner email is required`);
    }

    return errors;
}

/**
 * Upload gardens from CSV to database
 */
async function uploadGardens(csvPath: string) {
    console.log('🌱 Starting garden CSV upload...\n');

    try {
        // Check if file exists
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }

        // Parse CSV
        console.log('📄 Parsing CSV file...');
        const gardens = parseCSV(csvPath);
        console.log(`✅ Found ${gardens.length} gardens in CSV\n`);

        // Validate all rows
        console.log('🔍 Validating data...');
        const allErrors: string[] = [];
        gardens.forEach((garden, index) => {
            const errors = validateGarden(garden, index + 2);
            allErrors.push(...errors);
        });

        if (allErrors.length > 0) {
            console.error('❌ Validation errors found:\n');
            allErrors.forEach(error => console.error(`  ${error}`));
            throw new Error('CSV validation failed');
        }
        console.log('✅ All data validated\n');

        // Upload to database
        console.log('📤 Uploading to database...');
        let successCount = 0;
        let errorCount = 0;

        for (let i = 0; i < gardens.length; i++) {
            const garden = gardens[i];
            const lineNumber = i + 2;

            try {
                // Find owner by email
                const owner = await prisma.user.findUnique({
                    where: { email: garden.ownerEmail }
                });

                if (!owner) {
                    console.warn(`⚠️  Line ${lineNumber}: Owner not found (${garden.ownerEmail}), skipping...`);
                    errorCount++;
                    continue;
                }

                // Create garden
                const createdGarden = await prisma.garden.create({
                    data: {
                        name: garden.name,
                        address: garden.address,
                        zipcode: garden.zipcode,
                        description: garden.description || '',
                        latitude: garden.latitude ? parseFloat(garden.latitude) : null,
                        longitude: garden.longitude ? parseFloat(garden.longitude) : null,
                        ownerId: owner.id,
                        status: 'active'
                    }
                });

                // Add vegetables if provided
                if (garden.vegetables && garden.vegetables.trim()) {
                    const vegetableNames = garden.vegetables.split(',').map(v => v.trim()).filter(v => v);

                    for (const vegName of vegetableNames) {
                        // Find or create vegetable
                        let vegetable = await prisma.vegetable.findFirst({
                            where: { name: vegName }
                        });

                        if (!vegetable) {
                            vegetable = await prisma.vegetable.create({
                                data: { name: vegName }
                            });
                        }

                        // Add to garden inventory
                        await prisma.gardenInventory.create({
                            data: {
                                gardenId: createdGarden.id,
                                vegetableId: vegetable.id,
                                quantity: 1,
                                status: 'growing'
                            }
                        });
                    }

                    console.log(`✅ Line ${lineNumber}: Created "${garden.name}" with ${vegetableNames.length} vegetables`);
                } else {
                    console.log(`✅ Line ${lineNumber}: Created "${garden.name}"`);
                }

                successCount++;

            } catch (error: any) {
                errorCount++;
                console.error(`❌ Line ${lineNumber}: Failed to create "${garden.name}" - ${error.message}`);
            }
        }

        console.log('\n📊 Upload Summary:');
        console.log(`  ✅ Success: ${successCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log(`  📝 Total: ${gardens.length}`);

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
    console.error('Usage: npx ts-node scripts/upload-gardens.ts <path-to-csv>');
    console.error('Example: npx ts-node scripts/upload-gardens.ts gardens.csv');
    process.exit(1);
}

uploadGardens(csvPath);
