import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { GardenInvitationCreateSchema } from '../lib/validation';
import prisma from '../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    const origin = req.headers.origin;

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'POST') return handleCreate(req, res, origin);
    if (req.method === 'PUT' && id && typeof id === 'string') {
        if (action === 'accept') return handleAccept(req, res, origin, id);
        if (action === 'reject') return handleReject(req, res, origin, id);
    }

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const where: any = {};

        // Admins see all invitations, others see only their own
        if (user.role === 'Admin') {
            // Admins can filter by status
            const { status } = req.query;
            if (status && typeof status === 'string') {
                where.status = status;
            }
        } else {
            // Users see invitations sent to them
            where.userId = user.id;
        }

        const invitations = await prisma.gardenInvitation.findMany({
            where,
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        description: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                },
                inviter: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        return res.status(200).json(successResponse(invitations, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const validatedData = validateRequest(GardenInvitationCreateSchema, req.body);

        // Check if user has permission to invite to this garden
        const garden = await prisma.garden.findUnique({
            where: { id: validatedData.gardenId }
        });

        if (!garden) {
            return res.status(404).json(handleError(new Error('Garden not found'), origin));
        }

        // Only admins and garden owners can send invitations
        if (user.role !== 'Admin' && garden.ownerId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        // Check if invitation already exists
        const existing = await prisma.gardenInvitation.findFirst({
            where: {
                gardenId: validatedData.gardenId,
                userId: validatedData.userId,
                status: 'pending'
            }
        });

        if (existing) {
            return res.status(400).json(handleError(new Error('Invitation already exists'), origin));
        }

        // Check if user is already assigned to garden
        const isGardener = await prisma.gardenGardener.findFirst({
            where: {
                gardenId: validatedData.gardenId,
                userId: validatedData.userId
            }
        });

        const isVolunteer = await prisma.gardenVolunteer.findFirst({
            where: {
                gardenId: validatedData.gardenId,
                userId: validatedData.userId
            }
        });

        if (isGardener || isVolunteer) {
            return res.status(400).json(handleError(new Error('User is already assigned to this garden'), origin));
        }

        const invitation = await prisma.gardenInvitation.create({
            data: {
                gardenId: validatedData.gardenId,
                userId: validatedData.userId,
                invitedBy: user.id,
                status: 'pending'
            },
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true,
                        description: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                },
                inviter: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            }
        });

        // Create notification for invited user
        await prisma.notification.create({
            data: {
                userId: validatedData.userId,
                title: 'Garden Invitation',
                message: `You have been invited to join ${garden.name} as a ${validatedData.role}`,
                type: 'invitation'
            }
        });

        return res.status(201).json(successResponse(invitation, 'Invitation sent successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleAccept(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const invitation = await prisma.gardenInvitation.findUnique({
            where: { id },
            include: { garden: true }
        });

        if (!invitation) {
            return res.status(404).json(handleError(new Error('Invitation not found'), origin));
        }

        if (invitation.userId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json(handleError(new Error('Invitation already processed'), origin));
        }

        // Determine role from request body
        const { role } = req.body;
        if (!role || !['Gardener', 'Volunteer'].includes(role)) {
            return res.status(400).json(handleError(new Error('Invalid role'), origin));
        }

        // Update invitation status
        await prisma.gardenInvitation.update({
            where: { id },
            data: {
                status: 'accepted',
                respondedAt: new Date()
            }
        });

        // Create garden assignment based on role
        if (role === 'Gardener') {
            await prisma.gardenGardener.create({
                data: {
                    gardenId: invitation.gardenId,
                    userId: user.id
                }
            });
        } else {
            await prisma.gardenVolunteer.create({
                data: {
                    gardenId: invitation.gardenId,
                    userId: user.id
                }
            });
        }

        // Fetch user data for notification
        const userRecord = await prisma.user.findUnique({
            where: { id: user.id },
            select: { name: true }
        });

        // Notify the inviter
        await prisma.notification.create({
            data: {
                userId: invitation.invitedBy,
                title: 'Invitation Accepted',
                message: `${userRecord?.name || 'A user'} has accepted the invitation to join ${invitation.garden.name}`,
                type: 'invitation'
            }
        });

        return res.status(200).json(successResponse({ success: true }, 'Invitation accepted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleReject(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const invitation = await prisma.gardenInvitation.findUnique({
            where: { id },
            include: { garden: true }
        });

        if (!invitation) {
            return res.status(404).json(handleError(new Error('Invitation not found'), origin));
        }

        if (invitation.userId !== user.id) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        if (invitation.status !== 'pending') {
            return res.status(400).json(handleError(new Error('Invitation already processed'), origin));
        }

        await prisma.gardenInvitation.update({
            where: { id },
            data: {
                status: 'rejected',
                respondedAt: new Date()
            }
        });

        // Fetch user data for notification
        const userRecord = await prisma.user.findUnique({
            where: { id: user.id },
            select: { name: true }
        });

        // Notify the inviter
        await prisma.notification.create({
            data: {
                userId: invitation.invitedBy,
                title: 'Invitation Rejected',
                message: `${userRecord?.name || 'A user'} has declined the invitation to join ${invitation.garden.name}`,
                type: 'invitation'
            }
        });

        return res.status(200).json(successResponse({ success: true }, 'Invitation rejected', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
