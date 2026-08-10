import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { authenticate, AuthenticatedRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders } from '../lib/response';
import prisma from '../lib/prisma';
import { uploadImage } from '../lib/cloudinary';
import { geocodeAddress } from '../lib/geocode';
import { createNotification, getAdminIds } from '../lib/utils';
import { handleCorsPreflightRequest } from '../lib/cors';
import { checkRateLimit } from '../lib/rate-limit';
import { validateBase64ImageSize } from '../lib/validators';

// Validation schema for signup
const signupSchema = z.object({
    email: z.string().email('Invalid email format').transform(v => v.toLowerCase()),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    name: z.string().min(2, 'Name must be at least 2 characters'),
    role: z.enum(['Admin', 'Gardener', 'Volunteer']),
    address: z.string().optional(),
    zipcode: z.string().regex(/^\d{5}$/, 'Invalid zipcode format').optional(),
    phone: z.string().optional(),
    avatarImage: z.string().optional(),
    invitationToken: z.string().optional(),
    plotSize: z.string().optional(),
    sunlight: z.enum(['full', 'partial', 'shade']).optional()
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action } = req.query;
    const origin = req.headers.origin;

    // Immediately attach CORS headers to ensure all responses (including errors) contain CORS headers
    setCorsHeaders(res, origin);

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'POST') {
        if (action === 'signup') return handleSignup(req, res, origin);
        if (action === 'login') return handleLogin(req, res, origin);
        if (action === 'refresh') return handleRefresh(req, res, origin);
        if (action === 'logout') return handleLogout(req, res, origin);
        if (action === 'heartbeat') return handleHeartbeat(req, res, origin);
        setCorsHeaders(res, origin);
        return res.status(400).json(handleError(new Error('Invalid action')).payload);
    }

    if (req.method === 'GET') {
        if (action === 'me') return handleGetMe(req, res, origin);
        if (action === 'validate-invitation') return handleValidateInvitation(req, res, origin);
    }

    setCorsHeaders(res, origin);
    return res.status(405).json(handleError(new Error('Method not allowed')).payload);
}

async function handleValidateInvitation(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        let { token } = req.query;
        if (!token || typeof token !== 'string') {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Token is required')).payload);
        }

        const invitation = await prisma.invitation.findUnique({
            where: { token },
            include: { sender: { select: { name: true } } }
        });

        if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Invalid or expired invitation token')).payload);
        }

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            email: invitation.email,
            role: invitation.role,
            sender: invitation.sender.name
        }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleSignup(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        // Rate limit: 5 signup attempts per hour per IP
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
        const { allowed, remaining } = await checkRateLimit(
            `signup:${ip}`,
            5,
            60 * 60 // 1 hour
        );

        if (!allowed) {
            setCorsHeaders(res, origin);
            return res.status(429).json(handleError(
                new Error('Too many signup attempts. Please try again in an hour.')
            ).payload);
        }

        // Validate input with Zod schema
        const validatedData = signupSchema.parse(req.body);
        const {
            email, password, name, role, address, zipcode, phone,
            avatarImage, invitationToken, plotSize, sunlight
        } = validatedData;

        // If a token is provided, validate it first
        let invitation = null;
        if (invitationToken) {
            invitation = await prisma.invitation.findUnique({ where: { token: invitationToken } });
            if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
                setCorsHeaders(res, origin);
                return res.status(400).json(handleError(new Error('Invalid or expired invitation token')).payload);
            }
            if (invitation.email !== email) {
                setCorsHeaders(res, origin);
                return res.status(400).json(handleError(new Error('Invitation was sent to a different email address')).payload);
            }
        }

        if (!email || !password || !name || !role) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Missing required fields')).payload);
        }

        if (!['admin', 'gardener', 'volunteer'].includes(role.toLowerCase())) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Invalid role')).payload);
        }

        // Admin accounts can only be created via an invitation link — block direct self-signup
        if (role.toLowerCase() === 'admin' && !invitationToken) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('Admin accounts must be created via an invitation link. Contact your administrator.')).payload);
        }

        if (role.toLowerCase() === 'gardener' && !address) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Address is required for gardeners')).payload);
        }

        const existingUser = await prisma.user.findUnique({ where: { email } });
        // Only block if user exists AND NO invitation token is provided
        if (existingUser && !invitationToken) {
            setCorsHeaders(res, origin);
            return res.status(409).json(handleError(new Error('User already exists')).payload);
        }

        if (role.toLowerCase() === 'gardener' && address) {
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
                setCorsHeaders(res, origin);
                const { status, payload } = handleError(error);
                return res.status(status).json(payload);
            }
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        // Upsert user (update if stub exists, else create)
        const user = await prisma.user.upsert({
            where: { email },
            update: {
                password: hashedPassword,
                name,
                role,
                address,
                zipcode,
                phone,
                isActive: true
            },
            create: {
                email,
                password: hashedPassword,
                name,
                role,
                address,
                zipcode,
                phone,
                isActive: true
            }
        });

        // Upload avatar with user ID, then update
        if (avatarImage) {
            // Validate file size (5MB limit)
            if (!validateBase64ImageSize(avatarImage, 5)) {
                setCorsHeaders(res, origin);
                return res.status(400).json(handleError(
                    new Error('Avatar image must be less than 5MB')
                ).payload);
            }

            const avatarUrl = await uploadImage(avatarImage, 'avatars', `user-${user.id}`);
            await prisma.user.update({
                where: { id: user.id },
                data: { avatarUrl }
            });
        }

        if (role.toLowerCase() === 'gardener' && address) {
            const { latitude, longitude } = await geocodeAddress(address);
            const garden = await prisma.garden.create({
                data: {
                    name: `${name}'s Garden`,
                    address,
                    zipcode,
                    latitude,
                    longitude,
                    plotSize,
                    sunlight,
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

        // Mark invitation as accepted if used
        if (invitationToken) {
            await prisma.invitation.update({
                where: { token: invitationToken },
                data: { status: 'accepted', acceptedAt: new Date() }
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
        const finalUser = { ...userWithoutPassword, _id: user.id };
        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({
            user: finalUser,
            accessToken: token,
            token: token, // Backward compatibility
            refreshToken
        }, undefined));

    } catch (error: any) {
        console.error('Signup error:', error);

        // Handle Zod validation errors
        if (error instanceof z.ZodError) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(
                new Error(error.issues[0].message)
            ).payload);
        }

        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleLogin(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        let { email, password } = req.body;
        if (email) email = email.toLowerCase();

        if (!email || !password) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Missing email or password')).payload);
        }

        // Rate limit: 5 login attempts per 15 minutes per email
        const { allowed, remaining } = await checkRateLimit(
            `login:${email}`,
            5,
            15 * 60 // 15 minutes in seconds
        );

        if (!allowed) {
            setCorsHeaders(res, origin);
            return res.status(429).json(handleError(
                new Error('Too many login attempts. Please try again in 15 minutes.')
            ).payload);
        }

        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                gardenGardeners: { include: { garden: { select: { id: true, name: true, address: true, latitude: true, longitude: true } } } },
                gardenVolunteers: { include: { garden: { select: { id: true, name: true, address: true, latitude: true, longitude: true } } } }
            }
        });
        if (!user) {
            setCorsHeaders(res, origin);
            return res.status(401).json(handleError(new Error('Invalid credentials')).payload);
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            setCorsHeaders(res, origin);
            return res.status(401).json(handleError(new Error('Invalid credentials')).payload);
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

        const { password: _, gardenGardeners, gardenVolunteers, ...userWithoutPassword } = user;
        const finalUser = {
            ...userWithoutPassword,
            _id: user.id,
            gardens: [
                ...(gardenGardeners?.map((g: any) => ({ ...g.garden, role: 'Gardener', _id: g.garden.id })) || []),
                ...(gardenVolunteers?.map((g: any) => ({ ...g.garden, role: 'Volunteer', _id: g.garden.id })) || [])
            ]
        };
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            user: finalUser,
            accessToken: token,
            token: token, // Backward compatibility
            refreshToken
        }, undefined));

    } catch (error: any) {
        console.error('Login error:', error);
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleRefresh(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Refresh token is required')).payload);
        }

        // Rate limit: 30 refresh attempts per hour per IP
        const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
        const { allowed } = await checkRateLimit(
            `refresh:${ip}`,
            30,
            60 * 60 // 1 hour
        );

        if (!allowed) {
            setCorsHeaders(res, origin);
            return res.status(429).json(handleError(
                new Error('Too many refresh attempts. Please try again later.')
            ).payload);
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

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            accessToken: newToken,
            token: newToken,
            refreshToken: newRefreshToken
        }, undefined));

    } catch (error: any) {
        console.error('Refresh token error:', error);
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
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
                updatedAt: true,
                gardenGardeners: { include: { garden: { select: { id: true, name: true, address: true, latitude: true, longitude: true } } } },
                gardenVolunteers: { include: { garden: { select: { id: true, name: true, address: true, latitude: true, longitude: true } } } }
            }
        });

        if (!fullUser) {
            throw new Error('User not found');
        }

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            user: {
                ...fullUser,
                _id: fullUser.id,
                gardens: [
                    ...(fullUser.gardenGardeners?.map((g: any) => ({ ...g.garden, role: 'Gardener', _id: g.garden.id })) || []),
                    ...(fullUser.gardenVolunteers?.map((g: any) => ({ ...g.garden, role: 'Volunteer', _id: g.garden.id })) || [])
                ],
                gardenGardeners: undefined,
                gardenVolunteers: undefined
            }
        }, undefined));

    } catch (error: any) {
        console.error('Get current user error:', error);
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
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

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            success: true,
            message: 'Heartbeat received'
        }, undefined));

    } catch (error: any) {
        console.error('Heartbeat error:', error);
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleLogout(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        if (user) {
            await prisma.user.update({
                where: { id: user.id },
                data: { isOnline: false }
            });
        }
    } catch (error) {
        // Continue even if auth fails
    } finally {
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Logged out'));
    }
}
