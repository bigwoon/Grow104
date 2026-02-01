import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import { uploadImage } from '../../lib/cloudinary';
import prisma from '../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { avatarImage } = req.body;

        if (!avatarImage) {
            return res.status(400).json(handleError(new Error('Avatar image is required')));
        }

        // Upload to Cloudinary
        const avatarUrl = await uploadImage(avatarImage, 'avatars', user.email.replace('@', '_'));

        // Update user
        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl },
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
        return res.status(200).json(successResponse(updatedUser, 'Avatar uploaded successfully', origin));

    } catch (error: any) {
        console.error('Upload avatar error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
