import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as bcrypt from 'bcryptjs';
import { geocodeAddress } from '../lib/geocode';

// Attempt to use a direct connection to bypass pooler issues if needed
// By default, it will use DATABASE_URL from .env
const prisma = new PrismaClient();

const DEFAULT_PASSWORD = 'Grow104!';
const CITY_STATE_ZIP = 'Fort Worth, TX 76104';

interface GardenerRow {
    name: string;
    address: string;
    phone: string;
    email: string;
}

// Recovered data for the 13 gardeners from 2024 records
const RECOVERED_DATA: Record<string, { address?: string, email?: string }> = {
    'Aiden Roman': { address: '716 E Mulkey St' },
    'Suzette G Spears': { address: '721 Marion Ave' },
    'Henry Scott': { address: '1008 E Tucker St' },
    'Cecilia Olvera': { address: '926 E Tucker' },
    'Jose Ibarra': { address: '937 E Tucker' },
    'Adylene Gonzales': { address: '1313 E Maddox' },
    'Jessica Renteria': { address: '1275 E Maddox' },
    'Annie Rico': { address: '1220 E Maddox' },
    'Deja Jackson': { address: '1015 E Maddox' },
};

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

function normalizePhone(phone: string): string {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
}

async function uploadGardeners2025() {
    const csvPath = path.join(__dirname, 'home-gardeners-2025.csv');

    console.log('🌱 Starting Targeted 13 Gardeners Upload...\n');

    if (!fs.existsSync(csvPath)) {
        console.error(`❌ CSV file not found: ${csvPath}`);
        process.exit(1);
    }

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    // Skip header row and take exactly 13 rows
    const dataRows = lines.slice(1, 14);

    const gardeners: GardenerRow[] = dataRows
        .map(line => {
            const cols = parseCSVLine(line);
            const rawName = (cols[0] || '').trim().replace(/\s*\(.*?\)\s*/g, ''); // Strip notes from name
            const rawEmail = (cols[3] || '').trim().toLowerCase();
            const recovered = RECOVERED_DATA[rawName];

            // Use recovered address or email if available
            const email = rawEmail || recovered?.email || `${rawName.toLowerCase().replace(/\s+/g, '.') || 'user'}@placeholder.grow104.org`;
            const address = (cols[1] || '').trim() || recovered?.address || '';

            return {
                name: rawName,
                address: address,
                phone: cols[2] || '',
                email: email,
            };
        });

    console.log(`📋 Processing ${gardeners.length} gardeners...\n`);

    let created = 0;
    let skipped = 0;
    let errors = 0;

    for (const g of gardeners) {
        console.log(`--- ${g.name} (${g.email}) ---`);

        try {
            // Check if user already exists
            const existing = await prisma.user.findUnique({ where: { email: g.email } });
            if (existing) {
                console.log(`  ⏭️  Already exists, skipping.\n`);
                skipped++;
                continue;
            }

            // 1. Create User
            const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);
            const user = await prisma.user.create({
                data: {
                    email: g.email,
                    name: g.name,
                    password: hashedPassword,
                    role: 'Gardener',
                    phone: normalizePhone(g.phone) || null,
                    address: g.address || null,
                    isActive: true,
                },
            });
            console.log(`  ✅ User created: ${user.id}`);

            // 2. Create a personal Garden (if they have an address)
            if (g.address && g.address.length > 3) {
                const fullAddress = g.address.includes('Fort Worth') ? g.address : `${g.address}, ${CITY_STATE_ZIP}`;
                console.log(`  🔍 Geocoding: ${fullAddress}`);

                // Rate limit: Nominatim asks for 1 req/sec
                await new Promise(r => setTimeout(r, 1100));
                
                try {
                    const coords = await geocodeAddress(fullAddress);
                    const garden = await prisma.garden.create({
                        data: {
                            name: `${g.name}'s Garden`,
                            address: g.address,
                            ownerId: user.id,
                            latitude: coords.latitude,
                            longitude: coords.longitude,
                            status: 'active',
                        },
                    });
                    console.log(`  🏡 Garden created: ${garden.id} (${coords.latitude}, ${coords.longitude})`);

                    // Link gardener to their own garden
                    await prisma.gardenGardener.create({
                        data: { gardenId: garden.id, userId: user.id },
                    });
                    console.log(`  🔗 Linked to garden.`);
                } catch (geoErr) {
                    console.warn(`  ⚠️  Geocoding failed for ${fullAddress}: ${geoErr instanceof Error ? geoErr.message : 'Unknown error'}`);
                    // Still create garden without coords if geocoding fails? 
                    // No, user specifically wants them on the map.
                }
            } else {
                console.log(`  ⚠️  No address — garden not created.`);
            }

            created++;
            console.log('');
        } catch (err: any) {
            errors++;
            console.error(`  ❌ Error processing ${g.name}: ${err.message}\n`);
            // If it's a connectivity error, we should probably stop the script
            if (err.message.includes('Can\'t reach database server')) {
                console.error('CRITICAL: Database connection failed. Stopping.');
                break;
            }
        }
    }

    console.log('\n=============================');
    console.log('📊 Targeted Upload Summary');
    console.log('=============================');
    console.log(`  ✅ Created/Processed: ${created}`);
    console.log(`  ⏭️  Skipped (existing): ${skipped}`);
    console.log(`  ❌ Errors:            ${errors}`);
    console.log(`  📝 Target Total:      ${gardeners.length}`);
    console.log('\n💡 Default password for all new users: Grow104!');
    console.log('   Users can now be searched and mapped by their names.\n');

    await prisma.$disconnect();
}

uploadGardeners2025();
