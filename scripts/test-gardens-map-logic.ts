import { Decimal } from '@prisma/client/runtime/library';

// Mock the successResponse function
const successResponse = (data: any, message?: string) => ({
    success: true,
    data,
    message: message || 'Success'
});

// Mock the transformGarden function from api/gardens.ts
function transformGarden(garden: any) {
    if (!garden) return null;
    return {
        ...garden,
        _id: garden.id,
        location: garden.latitude && garden.longitude ? {
            type: 'Point',
            coordinates: [Number(garden.longitude), Number(garden.latitude)]
        } : undefined,
    };
}

// Mock the safeJsonStringify function from lib/response.ts (the version I just proposed)
const safeJsonStringify = (obj: any) => {
    return JSON.stringify(obj, (key, value) => {
        // Handle BigInt
        if (typeof value === 'bigint') {
            return value.toString();
        }

        // Handle Prisma/Decimal.js objects
        // We simulate Decimal behavior here
        if (value && typeof value === 'object' && (value.constructor?.name === 'Decimal' || value._isDecimal)) {
            return Number(value);
        }

        return value;
    });
};

// Test Data
const mockGardens = [
    {
        id: '1',
        name: 'Southside Garden',
        address: '123 South St',
        latitude: new Decimal(32.730),
        longitude: new Decimal(-97.330),
        zipcode: '76104',
        _count: { gardenGardeners: 5, gardenVolunteers: 2, volunteerRequests: 1 }
    }
];

// Execution
console.log('Testing handleMapData serialization logic...');

try {
    const transformed = mockGardens.map(transformGarden);
    const payload = successResponse(transformed);
    const jsonOutput = safeJsonStringify(payload);

    console.log('JSON Output successful:');
    console.log(JSON.stringify(JSON.parse(jsonOutput), null, 2));

    const parsed = JSON.parse(jsonOutput);
    const coord0 = parsed.data[0].location.coordinates[0];
    const coord1 = parsed.data[0].location.coordinates[1];

    if (typeof coord0 === 'number' && typeof coord1 === 'number') {
        console.log('✅ Coordinates are numbers');
    } else {
        console.log('❌ Coordinates are NOT numbers:', typeof coord0, typeof coord1);
    }
} catch (error: any) {
    console.error('❌ Serialization failed:', error);
}
