import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { successResponse, handleError } from '../../lib/response';
import { uploadImage } from '../../lib/cloudinary';
import { geocodeAddress } from '../../lib/geocode';
import { createNotification, getAdminIds } from '../../lib/utils';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password, name, role, address, zipcode, phone, avatarImage } = req.body;

        // Validate required fields
        if (!email || !password || !name || !role) {
            return res.status(400).json(handleError(new Error('Missing required fields')));
        }

        // Validate role
        if (!['Admin', 'Gardener', 'Volunteer'].includes(role)) {
            return res.status(400).json(handleError(new Error('Invalid role')));
        }

        // Gardeners must provide address
        if (role === 'Gardener' && !address) {
            return res.status(400).json(handleError(new Error('Address is required for gardeners')));
        }

        // Check if user already exists
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json(handleError(new Error('User already exists')));
        }

        // For gardeners, check if garden exists at address
        if (role === 'Gardener' && address) {
            const existingGarden = await prisma.garden.findFirst({
                where: { address },
                include: {
                    owner: { select: { id: true, name: true, email: true } },
                    gardenGardeners: {
                        include: {
                            user: { select: { id: true, name: true } }
                        }
                    }
                }
            });

            if (existingGarden) {
                // Return conflict with garden data
                const error: any = new Error('GARDEN_EXISTS_AT_ADDRESS');
                error.data = {
                    existingGarden: {
                        id: existingGarden.id,
                        name: existingGarden.name,
                        address: existingGarden.address,
                        owner: existingGarden.owner,
                        gardenerCount: existingGarden.gardenGardeners.length
                    },
                    requiresUserChoice: true
                };
                return res.status(409).json(handleError(error));
            }
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Upload avatar if provided
        let avatarUrl = null;
        if (avatarImage) {
            avatarUrl = await uploadImage(avatarImage, 'avatars', email.replace('@', '_'));
        }

        // Create user
        const user = await prisma.user.create({
            data: {
                email,
                password: hashedPassword,
                name,
                role,
                address,
                zipcode,
                phone,
                avatarUrl
            }
        });

        // Auto-create garden for gardener
        if (role === 'Gardener' && address) {
            const { latitude, longitude } = await geocodeAddress(address);

            const garden = await prisma.garden.create({
                data: {
                    name: `${name}'s Garden`,
                    address,
                    zipcode,
                    latitude,
                    longitude,
                    ownerId: user.id,
                    status: 'active'
                }
            });

            // Create garden assignment
            await prisma.gardenGardener.create({
                data: {
                    gardenId: garden.id,
                    userId: user.id
                }
            });
        }

        // Notify admins of new signup
        const adminIds = await getAdminIds();
        if (adminIds.length > 0) {
            await createNotification(
                adminIds,
                'New User Signup',
                `${name} (${role}) just signed up`,
                'user_signup'
            );
        }

        // Generate tokens
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        const refreshToken = jwt.sign(
            { id: user.id },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: '30d' }
        );

        // Return user without password
        const { password: _, ...userWithoutPassword } = user;

        return res.status(201).json(successResponse({
            user: userWithoutPassword,
            token,
            refreshToken
        }));

    } catch (error: any) {
        console.error('Signup error:', error);
        return res.status(500).json(handleError(error));
    }
}
