import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

interface GardenerCSVRow {
    status?: string;
    name: string;
    year?: string;
    phone?: string;
    address?: string;
    callInProgress?: string;
    email?: string;
    gardenNeeds?: string;
    ableToAttend?: string;
    inPerson?: string;
    needsMet?: string;
    screenings?: string;
    householdSize?: string;
    [key: string]: string | undefined; // For additional columns
}

/**
 * Parse CSV file handling the malformed SCG header
 */
function parseCSV(filePath: string): GardenerCSVRow[] {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split(/\r?\n/).filter(line => line.trim());

    if (lines.length === 0) {
        throw new Error('CSV file is empty');
    }

    // Skip malformed header rows (lines 1-4) and use row 5 as actual header
    let headerLineIndex = 0;

    // Find the first line that looks like actual data (has comma-separated values)
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i];
        // Look for a line with multiple commas and typical header names
        if (line.includes(',') && (
            line.toLowerCase().includes('gardener') ||
            line.toLowerCase().includes('name') ||
            line.toLowerCase().includes('address')
        )) {
            // Check if next line looks like data (not another header)
            if (i + 1 < lines.length) {
                const nextLine = lines[i + 1];
                // If next line has actual data (starts with status or name), this is the header
                if (!nextLine.toLowerCase().startsWith('2024') &&
                    !nextLine.toLowerCase().includes('revitalization')) {
                    headerLineIndex = i;
                    break;
                }
            }
        }
    }

    // Parse header - handle the complex multi-line header by taking the last header row
    const headerLine = lines[headerLineIndex];
    const headers = parseCSVLine(headerLine).map(h =>
        h.trim()
            .replace(/^"|"$/g, '')
            .replace(/\n/g, ' ')
            .trim()
    );

    // Map headers to standardized field names
    const fieldMap: { [key: string]: string } = {
        '2024 Revitalizations': 'status',
        'Home Gardener': 'name',
        'Year': 'year',
        'Phone Number': 'phone',
        'Address': 'address',
        'Call in Progress': 'callInProgress',
        'Email address': 'email',
        'Garden Needs': 'gardenNeeds',
        'Able to Attend Revitalization Days ?': 'ableToAttend',
        'in Person': 'inPerson',
        'Needs Met': 'needsMet',
        'Black Heart Screenings': 'screenings',
        'Number in Household': 'householdSize'
    };

    // Parse data rows
    const rows: GardenerCSVRow[] = [];
    for (let i = headerLineIndex + 1; i < lines.length; i++) {
        const values = parseCSVLine(lines[i]);
        const row: any = {};

        headers.forEach((header, index) => {
            const fieldName = fieldMap[header] || header;
            row[fieldName] = values[index]?.trim() || '';
        });

        // Only add rows that have a name
        if (row.name && row.name.length > 0) {
            rows.push(row as GardenerCSVRow);
        }
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
 * Normalize phone number to consistent format
 */
function normalizePhone(phone: string): string {
    if (!phone) return '';
    // Remove all non-digit characters
    const digits = phone.replace(/\D/g, '');
    // Format as XXX-XXX-XXXX if 10 digits
    if (digits.length === 10) {
        return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone; // Return original if not standard format
}

/**
 * Extract garden needs as array
 */
function parseGardenNeeds(needsString: string): string[] {
    if (!needsString || needsString.trim() === '') return [];

    return needsString
        .split(',')
        .map(item => item.trim())
        .filter(item => item.length > 0);
}

/**
 * Generate a secure random password
 */
function generatePassword(): string {
    return crypto.randomBytes(16).toString('hex');
}

/**
 * Determine if gardener prefers Spanish based on notes
 */
function detectLanguagePreference(callNotes: string): string {
    if (!callNotes) return 'English';
    const lower = callNotes.toLowerCase();
    if (lower.includes('spanish') || lower.includes('español')) {
        return 'Spanish';
    }
    return 'English';
}

/**
 * Upload gardeners from CSV to database
 */
async function uploadGardeners(csvPath: string) {
    console.log('👥 Starting gardener CSV upload...\n');

    try {
        // Check if file exists
        if (!fs.existsSync(csvPath)) {
            throw new Error(`CSV file not found: ${csvPath}`);
        }

        // Parse CSV
        console.log('📄 Parsing CSV file...');
        const gardeners = parseCSV(csvPath);
        console.log(`✅ Found ${gardeners.length} gardeners in CSV\n`);

        // Upload to database
        console.log('📤 Uploading to database...');
        let successCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let needsInvitationCount = 0;
        const gardenersNeedingInvitation: Array<{ name: string, phone: string, address: string }> = [];

        for (let i = 0; i < gardeners.length; i++) {
            const gardener = gardeners[i];
            const lineNumber = i + 2; // Approximate line number

            try {
                // Skip if no name
                if (!gardener.name || gardener.name.length < 2) {
                    console.warn(`⏭️  Line ${lineNumber}: Skipping - no name`);
                    skippedCount++;
                    continue;
                }

                // Check for valid email
                const phone = normalizePhone(gardener.phone || '');
                const email = gardener.email?.trim().toLowerCase();
                const hasValidEmail = email && email.includes('@') && email.includes('.');

                // Skip users without email - they'll need an invitation
                if (!hasValidEmail) {
                    console.log(`📧 Line ${lineNumber}: "${gardener.name}" - No email, needs invitation`);
                    gardenersNeedingInvitation.push({
                        name: gardener.name,
                        phone: phone || 'No phone',
                        address: gardener.address || 'No address'
                    });
                    needsInvitationCount++;
                    continue;
                }

                // Check for duplicate by email
                let existingUser = await prisma.user.findUnique({
                    where: { email }
                });

                if (existingUser) {
                    console.log(`⏭️  Line ${lineNumber}: "${gardener.name}" already exists (${email}), skipping...`);
                    skippedCount++;
                    continue;
                }

                // Create user account
                const userData: any = {
                    name: gardener.name.trim(),
                    email: email,
                    password: generatePassword(), // Random password - they'll use signup link
                    role: 'Gardener',
                    phone: phone || null,
                    address: gardener.address?.trim() || null,
                    isActive: !['no longer gardening', 'relocated', 'no longer at address'].some(
                        term => gardener.status?.toLowerCase().includes(term)
                    ),
                    growing: parseGardenNeeds(gardener.gardenNeeds || '')
                };

                const user = await prisma.user.create({
                    data: userData
                });

                // Create garden requests if needs exist
                const needs = parseGardenNeeds(gardener.gardenNeeds || '');
                if (needs.length > 0) {
                    // Define vegetable lists
                    const fallVegetables = [
                        'cabbage', 'greens', 'kale', 'cilantro', 'lettuce', 'potatoes',
                        'garlic', 'onions', 'spinach', 'broccoli', 'brussels sprouts', 'parsley'
                    ];

                    const springVegetables = [
                        'broccoli', 'cabbage', 'kale', 'greens', 'lettuce', 'tomatoes',
                        'potatoes', 'swiss chard', 'peppers', 'cucumbers', 'squash',
                        'green beans', 'corn', 'okra', 'melons', 'basil', 'cilantro',
                        'parsley', 'mint', 'zucchini'
                    ];

                    // Define supplies list
                    const supplyItems = [
                        'organic soil', 'soil', 'mulch', 'organic pest control',
                        'pest control', 'shade cloth', 'freeze cloth', 'fertilizer', 'compost'
                    ];

                    // Separate needs into supplies and vegetables
                    const supplies = needs.filter(need =>
                        supplyItems.some(item => need.toLowerCase().includes(item.toLowerCase()))
                    );

                    const vegetables = needs.filter(need =>
                        !supplyItems.some(item => need.toLowerCase().includes(item.toLowerCase()))
                    );

                    // Determine season for vegetables
                    let season = 'spring'; // Default to spring
                    const needsLower = vegetables.map(v => v.toLowerCase());

                    // Check if primarily fall vegetables
                    const fallCount = needsLower.filter(need =>
                        fallVegetables.some(veg => need.includes(veg))
                    ).length;

                    const springCount = needsLower.filter(need =>
                        springVegetables.some(veg => need.includes(veg))
                    ).length;

                    if (fallCount > springCount) {
                        season = 'fall';
                    } else if (fallCount > 0 && springCount > 0) {
                        season = 'both';
                    }

                    // Create supply request if applicable
                    if (supplies.length > 0) {
                        await prisma.gardenerRequest.create({
                            data: {
                                requesterId: user.id,
                                title: 'Supplies Request',
                                description: supplies.join(', '),
                                requestType: 'supplies',
                                status: gardener.needsMet ? 'fulfilled' : 'pending',
                                notes: `Imported from SCG CSV - Status: ${gardener.status || 'Unknown'}`
                            }
                        });
                    }

                    // Create seedling request if applicable
                    if (vegetables.length > 0) {
                        await prisma.gardenerRequest.create({
                            data: {
                                requesterId: user.id,
                                title: 'Seedlings Request',
                                description: vegetables.join(', '),
                                requestType: 'seedlings',
                                status: gardener.needsMet ? 'fulfilled' : 'pending',
                                season: season,
                                quantity: vegetables.length,
                                notes: `Imported from SCG CSV - Status: ${gardener.status || 'Unknown'} - Season: ${season}`
                            }
                        });
                    }
                }

                const statusEmoji = gardener.status?.toLowerCase().includes('revitalized') ? '🌱' :
                    gardener.status?.toLowerCase().includes('growing') ? '🌿' : '👤';

                console.log(`${statusEmoji} Line ${lineNumber}: Created "${gardener.name}"${needs.length > 0 ? ` with ${needs.length} needs` : ''}`);
                successCount++;

            } catch (error: any) {
                errorCount++;
                console.error(`❌ Line ${lineNumber}: Failed to create "${gardener.name}" - ${error.message}`);
            }
        }

        console.log('\n📊 Upload Summary:');
        console.log(`  ✅ Created: ${successCount}`);
        console.log(`  📧 Needs Invitation: ${needsInvitationCount}`);
        console.log(`  ⏭️  Skipped (duplicates): ${skippedCount}`);
        console.log(`  ❌ Errors: ${errorCount}`);
        console.log(`  📝 Total: ${gardeners.length}`);

        // Show gardeners needing invitations
        if (gardenersNeedingInvitation.length > 0) {
            console.log('\n📧 Gardeners Needing Signup Invitations:');
            console.log('─'.repeat(80));
            gardenersNeedingInvitation.forEach((g, idx) => {
                console.log(`${idx + 1}. ${g.name}`);
                console.log(`   Phone: ${g.phone}`);
                console.log(`   Address: ${g.address}`);
                console.log('');
            });
            console.log('💡 Tip: Send signup invitations to these gardeners via phone/mail');
        }

        console.log('\n💡 Important Notes:');
        console.log('  - Users created with random passwords (will use signup link to set password)');
        console.log('  - Gardeners without emails were NOT created (need invitation first)');
        console.log('  - Garden needs converted to GardenerRequest records');

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
    console.error('Usage: npx ts-node scripts/upload-gardeners.ts <path-to-csv>');
    console.error('Example: npx ts-node scripts/upload-gardeners.ts "C:\\Users\\User\\Downloads\\SCG Home Gardeners.csv"');
    process.exit(1);
}

uploadGardeners(csvPath);
