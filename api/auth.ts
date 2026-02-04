import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import prisma from '../lib/prisma';
import { uploadImage } from '../lib/cloudinary';
import { geocodeAddress } from '../lib/geocode';
import { createNotification, getAdminIds } from '../lib/utils';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method === 'POST') {
        if (action === 'signup') return handleSignup(req, res, origin);
        if (action === 'login') return handleLogin(req, res, origin);
        if (action === 'refresh') return handleRefresh(req, res, origin);
        if (action === 'heartbeat') return handleHeartbeat(req, res, origin);
        return res.status(400).json(handleError(new Error('Invalid action'), origin));
    }

    if (req.method === 'GET' && action === 'me') {
        return handleGetMe(req, res, origin);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleSignup(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const { email, password, name, role, address, zipcode, phone, avatarImage } = req.body;

        if (!email || !password || !name || !role) {
            return res.status(400).json(handleError(new Error('Missing required fields'), origin));
        }

        if (!['Admin', 'Gardener', 'Volunteer'].includes(role)) {
            return res.status(400).json(handleError(new Error('Invalid role'), origin));
        }

        if (role === 'Gardener' && !address) {
            return res.status(400).json(handleError(new Error('Address is required for gardeners'), origin));
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
            return res.status(409).json(handleError(new Error('User already exists'), origin));
        }

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
                return res.status(409).json(handleError(error, origin));
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        let avatarUrl = null;
        if (avatarImage) {
            avatarUrl = await uploadImage(avatarImage, 'avatars', email.replace('@', '_'));
        }

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

            await prisma.gardenGardener.create({
                data: {
                    gardenId: garden.id,
                    userId: user.id
                }
            });
        }

        const adminIds = await getAdminIds();
        if (adminIds.length > 0) {
            await createNotification(
                adminIds,
                'New User Signup',
                `${name} (${role}) just signed up`,
                'user_signup'
            );
        }

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

        const { password: _, ...userWithoutPassword } = user;
        return res.status(201).json(successResponse({
            user: userWithoutPassword,
            token,
            refreshToken
        }, undefined, origin));

    } catch (error: any) {
        console.error('Signup error:', error);
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleLogin(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json(handleError(new Error('Missing email or password'), origin));
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json(handleError(new Error('Invalid credentials'), origin));
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json(handleError(new Error('Invalid credentials'), origin));
        }

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isOnline: true,
                lastSeen: new Date()
            }
        });

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

        const { password: _, ...userWithoutPassword } = user;
        return res.status(200).json(successResponse({
            user: userWithoutPassword,
            token,
            refreshToken
        }, undefined, origin));

    } catch (error: any) {
        console.error('Login error:', error);
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleRefresh(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            return res.status(400).json(handleError(new Error('Refresh token is required'), origin));
        }

        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as any;

        const newToken = jwt.sign(
            { id: decoded.id, email: decoded.email, role: decoded.role },
            process.env.JWT_SECRET!,
            { expiresIn: '7d' }
        );

        const newRefreshToken = jwt.sign(
            { id: decoded.id },
            process.env.JWT_REFRESH_SECRET!,
            { expiresIn: '30d' }
        );

        return res.status(200).json(successResponse({
            token: newToken,
            refreshToken: newRefreshToken
        }, undefined, origin));

    } catch (error: any) {
        console.error('Refresh token error:', error);
        return res.status(401).json(handleError(new Error('INVALID_TOKEN'), origin));
    }
}

async function handleGetMe(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const fullUser = await prisma.user.findUnique({
            where: { id: user.id },
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
                isActive: true,
                lastSeen: true,
                createdAt: true,
                updatedAt: true
            }
        });

        if (!fullUser) {
            throw new Error('User not found');
        }

        return res.status(200).json(successResponse(fullUser, undefined, origin));

    } catch (error: any) {
        console.error('Get current user error:', error);
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleHeartbeat(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                isOnline: true,
                lastSeen: new Date()
            }
        });

        return res.status(200).json(successResponse({
            success: true,
            message: 'Heartbeat received'
        }, undefined, origin));

    } catch (error: any) {
        console.error('Heartbeat error:', error);
        return res.status(500).json(handleError(error, origin));
    }
}
