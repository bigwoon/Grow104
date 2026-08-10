import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { geocodeAddress } from '../lib/geocode';

const prisma = new PrismaClient();

async function uploadHomeGardeners(csvPath: string) {
    console.log('🚀 Starting Home Gardener 2024 Import...\n');

    try {
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }

        const content = fs.readFileSync(csvPath, 'utf-8');
        const lines = content.split('\n');

        // Skip header
        const rows = lines.slice(1).filter(line => line.trim());

        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;

        for (let i = 0; i < rows.length; i++) {
            const line = rows[i];
            const columns = parseCSVLine(line);

            // Expected indices based on manual inspection:
            // 1: Name
            // 3: Phone
            // 6: Email
            // 27: Full Address (at the end)

            const name = columns[1]?.trim();
            const phone = columns[3]?.trim();
            const email = columns[6]?.trim().toLowerCase();
            const rawAddress = columns[columns.length - 1]?.trim() || columns[4]?.trim();
            const notes = columns[5]?.trim();

            // Skip rows that obviously aren't gardeners or marked as "no longer gardening"
            if (!name || name === ',' || name.includes('no longer gardening') || notes?.includes('no longer lives')) {
                skippedCount++;
                continue;
            }

            console.log(`\n--- Processing [${i + 1}/${rows.length}]: ${name} ---`);

            try {
                // Ensure we have a valid email or generate one if missing (using phone or name slug)
                let finalEmail = email;
                if (!finalEmail || !finalEmail.includes('@')) {
                    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    finalEmail = `${slug}${i}@placeholder.grow104.org`;
                    console.log(`  ⚠️  No email found. Using placeholder: ${finalEmail}`);
                }

                // 1. Upsert User
                const hashedPassword = await bcrypt.hash('Grow104!', 10);
                const user = await prisma.user.upsert({
                    where: { email: finalEmail },
                    update: {
                        name: name,
                        phone: phone,
                        address: rawAddress,
                    },
                    create: {
                        email: finalEmail,
                        name: name,
                        password: hashedPassword,
                        role: 'GARDENER',
                        phone: phone,
                        address: rawAddress,
                        isActive: true
                    }
                });

                // 2. Geocode Address
                let latitude = null;
                let longitude = null;
                if (rawAddress && rawAddress.length > 5) {
                    const fullAddress = `${rawAddress}, Fort Worth, TX, 76104`;
                    console.log(`  🔍 Geocoding: ${fullAddress}`);
                    const coords = await geocodeAddress(fullAddress);
                    latitude = coords.latitude;
                    longitude = coords.longitude;
                    console.log(`  📍 Found: ${latitude}, ${longitude}`);
                }

                // 3. Create/Update Garden
                // Each home gardener gets a garden named after them
                const gardenName = `${name}'s Garden`;

                // Check if garden already exists for this user
                const existingGarden = await prisma.garden.findFirst({
                    where: { ownerId: user.id }
                });

                if (existingGarden) {
                    await prisma.garden.update({
                        where: { id: existingGarden.id },
                        data: {
                            name: gardenName,
                            address: rawAddress,
                            latitude,
                            longitude,
                            status: 'active'
                        }
                    });
                    console.log(`  ✅ Updated existing garden: ${existingGarden.id}`);
                } else {
                    const garden = await prisma.garden.create({
                        data: {
                            name: gardenName,
                            address: rawAddress,
                            latitude,
                            longitude,
                            ownerId: user.id,
                            status: 'active'
                        }
                    });
                    console.log(`  ✅ Created new garden: ${garden.id}`);

                    // Link user to their own garden in garden_gardeners for access control
                    await prisma.gardenGardener.create({
                        data: {
                            gardenId: garden.id,
                            userId: user.id
                        }
                    });
                }

                successCount++;
            } catch (err: any) {
                errorCount++;
                console.error(`  ❌ Error processing row ${i + 1}: ${err.message}`);
            }
        }

        console.log('\n--- Import Complete ---');
        console.log(`✅ Success: ${successCount}`);
        console.log(`⏭️  Skipped: ${skippedCount}`);
        console.log(`❌ Errors: ${errorCount}`);

    } catch (error: any) {
        console.error('Fatal Error:', error.message);
    } finally {
        await prisma.$disconnect();
    }
}

function parseCSVLine(line: string): string[] {
    const values: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
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

const csvPath = path.join(__dirname, 'home-gardeners-2024.csv');
uploadHomeGardeners(csvPath);
