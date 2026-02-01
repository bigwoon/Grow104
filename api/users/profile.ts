import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import prisma from '../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'PUT') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { name, phone, zipcode, address, growing } = req.body;

        // Build update data
        const updateData: any = {};
        if (name) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (zipcode !== undefined) updateData.zipcode = zipcode;
        if (address !== undefined) updateData.address = address;
        if (growing !== undefined) updateData.growing = growing;

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: updateData,
            select: {
                id: true,
                email: true,
                name: true,
                role: true,
                avatarUrl: true,
                zipcode: true,
                phone: true,
                address: true,
                growing: true,
                isOnline: true,
                lastSeen: true,
                createdAt: true,
                updatedAt: true
            }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse(updatedUser, 'Profile updated successfully', origin));

    } catch (error: any) {
        console.error('Update profile error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
