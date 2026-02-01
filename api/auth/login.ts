import { VercelRequest, VercelResponse } from '@vercel/node';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../../lib/prisma';
import { successResponse, handleError } from '../../lib/response';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json(handleError(new Error('Email and password are required')));
        }

        // Find user
        const user = await prisma.user.findUnique({
            where: { email }
        });

        if (!user) {
            return res.status(401).json(handleError(new Error('Invalid credentials')));
        }

        // Check if user is active
        if (!user.isActive) {
            return res.status(403).json(handleError(new Error('Account is inactive')));
        }

        // Verify password
        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            return res.status(401).json(handleError(new Error('Invalid credentials')));
        }

        // Update online status and last seen
        await prisma.user.update({
            where: { id: user.id },
            data: {
                isOnline: true,
                lastSeen: new Date()
            }
        });

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

        return res.status(200).json(successResponse({
            user: userWithoutPassword,
            token,
            refreshToken
        }));

    } catch (error: any) {
        console.error('Login error:', error);
        return res.status(500).json(handleError(error));
    }
}
