import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { uploadImage } from '../lib/cloudinary';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'PUT') return handleUpdateProfile(req, res, origin);
    if (req.method === 'POST' && action === 'avatar') return handleUploadAvatar(req, res, origin);

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        const { role } = req.query;
        const where: any = { isActive: true };
        if (role && typeof role === 'string') {
            where.role = role;
        }

        const users = await prisma.user.findMany({
            where,
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
                createdAt: true
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json(successResponse(users, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleUpdateProfile(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { name, phone, zipcode, address, growing } = req.body;

        const updateData: any = {};
        if (name) updateData.name = name;
        if (phone !== undefined) updateData.phone = phone;
        if (zipcode !== undefined) updateData.zipcode = zipcode;
        if (address !== undefined) updateData.address = address;
        if (growing !== undefined) updateData.growing = growing;

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

        return res.status(200).json(successResponse(updatedUser, 'Profile updated successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleUploadAvatar(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { avatarImage } = req.body;

        if (!avatarImage) {
            return res.status(400).json(handleError(new Error('Avatar image is required'), origin));
        }

        const avatarUrl = await uploadImage(avatarImage, 'avatars', user.email.replace('@', '_'));

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

        return res.status(200).json(successResponse(updatedUser, 'Avatar uploaded successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
