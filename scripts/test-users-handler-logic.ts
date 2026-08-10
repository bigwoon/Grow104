import { createPaginationMeta } from '../lib/validators';
import { safeJsonStringify, successResponse } from '../lib/response';

// Mock data similar to what Prisma returns
const mockUsers = [
    {
        id: 'user-1',
        email: 'gardener@example.com',
        name: 'John Gardener',
        role: 'Gardener',
        createdAt: new Date(),
        // Prisma sometimes returns Decimal objects for Decimal fields
        // though User doesn't have them, let's test with a mock Decimal
        // if it were present in a generic response
        _decimal: { toJSON: () => '1.50' }
    }
];

function testSerialization() {
    console.log('--- Testing Serialization Logic ---');

    const transformedUsers = mockUsers.map(u => ({ ...u, _id: u.id }));
    const total = 1;
    const page = 1;
    const limit = 20;

    const payload = successResponse({
        users: transformedUsers,
        pagination: createPaginationMeta(page, limit, total)
    });

    try {
        const json = safeJsonStringify(payload);
        console.log('✅ safeJsonStringify success');

        // Simulate what happens in Express/Vercel's res.json()
        const standardJson = JSON.stringify(payload);
        console.log('✅ JSON.stringify success');

        const parsed = JSON.parse(json);
        console.log('Sample output users count:', parsed.data.users.length);
        console.log('Sample output _id:', parsed.data.users[0]._id);

    } catch (error: any) {
        console.error('❌ Serialization failed:', error.message);
    }
}

testSerialization();
