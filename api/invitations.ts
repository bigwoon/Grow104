import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders } from '../lib/response';
import { InvitationCreateSchema } from '../lib/validation';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';
import crypto from 'crypto';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action, token } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    // Public endpoints for token validation/acceptance
    if (action === 'token' && req.method === 'GET' && typeof token === 'string') {
        return handleGetInvitationByToken(req, res, token, origin);
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        // Admin-only management endpoints
        if (req.method === 'GET') {
            return handleListInvitations(req, res, origin);
        }

        if (req.method === 'POST') {
            return handleCreateInvitation(req, res, user.id, origin);
        }

        if (req.method === 'DELETE') {
            return handleDeleteInvitation(req, res, origin);
        }

        setCorsHeaders(res, origin);
        return res.status(405).json(handleError(new Error('Method not allowed')).payload);
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGetInvitationByToken(req: VercelRequest, res: VercelResponse, token: string, origin?: string) {
    try {
        const invitation = await prisma.invitation.findUnique({
            where: { token }
        });

        if (!invitation) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Invalid invitation token')).payload);
        }

        if (invitation.acceptedAt) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Invitation already accepted')).payload);
        }

        if (invitation.expiresAt < new Date()) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Invitation expired')).payload);
        }

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ invitation: { ...invitation, _id: invitation.id } }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleListInvitations(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const invitations = await prisma.invitation.findMany({
            include: { sender: { select: { id: true, name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(invitations.map(i => ({ ...i, _id: i.id }))));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleCreateInvitation(req: VercelRequest, res: VercelResponse, userId: string, origin?: string) {
    try {
        let { email, role, message } = validateRequest(InvitationCreateSchema, req.body);
        email = email.toLowerCase();

        // Check for existing pending invitation
        const existingInvite = await prisma.invitation.findFirst({
            where: {
                email,
                acceptedAt: null,
                expiresAt: { gt: new Date() }
            }
        });

        if (existingInvite) {
            setCorsHeaders(res, origin);
            return res.status(409).json(handleError(new Error('An active invitation already exists for this email')).payload);
        }

        const token = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

        const invitation = await prisma.invitation.create({
            data: {
                email,
                role,
                message,
                token,
                sentBy: userId,
                expiresAt
            }
        });

        // Construct the invitation link
        const baseUrl = process.env.VITE_App_Url || origin || 'https://grow104.org';
        const invitationLink = `${baseUrl}/signup?token=${token}`;

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({
            ...invitation,
            _id: invitation.id,
            invitationLink
        }, 'Invitation created successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleDeleteInvitation(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const { id } = req.query;
        if (!id || typeof id !== 'string') {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Invitation ID is required')).payload);
        }

        await prisma.invitation.delete({ where: { id } });
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Invitation revoked successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}
