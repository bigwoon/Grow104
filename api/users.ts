import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders, safeJsonStringify } from '../lib/response';
import { uploadImage } from '../lib/cloudinary';
import { MessageCreateSchema, InvitationCreateSchema } from '../lib/validation';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';
import { validateEnvironment, validateBase64ImageSize, getPaginationParams, createPaginationMeta } from '../lib/validators';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { action, format, userId, id } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }


    // Route to notification logic
    if (action === 'notifications' || action === 'read' || action === 'read-all' || (req.method === 'GET' && action === undefined && req.url?.includes('notifications'))) {
        return handleNotifications(req, res, origin);
    }

    // Route to message logic
    if (action === 'messages' || action === 'unread-count' || format === 'conversations' || (userId && typeof userId === 'string' && req.method === 'GET')) {
        return handleMessages(req, res, origin);
    }

    if (req.method === 'GET') {
        if (id && typeof id === 'string') return handleGetSingle(req, res, id, origin);
        return handleList(req, res, origin);
    }
    if (req.method === 'PUT') {
        if (action === 'change-password') return handleChangePassword(req, res, origin);
        return handleUpdateProfile(req, res, origin);
    }
    if (req.method === 'PATCH') return handleAdminUpdateUser(req, res, origin);
    if (req.method === 'DELETE') return handleAdminDeleteUser(req, res, origin);
    if (req.method === 'POST' && action === 'avatar') return handleUploadAvatar(req, res, origin);

    setCorsHeaders(res, origin);
    return res.status(405).json(handleError(new Error('Method not allowed')).payload);
}

// --- User Management Logic ---

async function handleChangePassword(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { id, password } = req.body;

        if (!id || !password) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('User ID and password are required')).payload);
        }

        // Only Admin or the user themselves can change password
        if ((user.role || '').toLowerCase() !== 'admin' && user.id !== id) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        // Verify current password if provided (required for non-admins)
        if ((user.role || '').toLowerCase() !== 'admin') {
            const { currentPassword } = req.body;
            if (!currentPassword) {
                setCorsHeaders(res, origin);
                return res.status(400).json(handleError(new Error('Current password is required')).payload);
            }

            const currentUser = await prisma.user.findUnique({ where: { id } });
            if (!currentUser) {
                setCorsHeaders(res, origin);
                return res.status(404).json(handleError(new Error('User not found')).payload);
            }

            const validPassword = await bcrypt.compare(currentPassword, currentUser.password);
            if (!validPassword) {
                setCorsHeaders(res, origin);
                return res.status(401).json(handleError(new Error('Invalid current password')).payload);
            }
        }

        if (password.length < 8) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Password must be at least 8 characters')).payload);
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        await prisma.user.update({
            where: { id },
            data: { password: hashedPassword }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Password updated successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGetSingle(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const targetUser = await prisma.user.findUnique({
            where: { id },
            select: {
                id: true, email: true, name: true, role: true, avatarUrl: true,
                zipcode: true, phone: true, address: true, growing: true,
                isOnline: true, isActive: true, lastSeen: true,
                createdAt: true, updatedAt: true,
                gardenGardeners: { include: { garden: { select: { id: true, name: true, address: true } } } },
                gardenVolunteers: { include: { garden: { select: { id: true, name: true, address: true } } } }
            }
        });

        if (!targetUser) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('User not found')).payload);
        }

        // Only admin, the user themselves, or Volunteers viewing Gardeners can see details
        const isSelf = user.id === targetUser.id;
        const userRole = (user.role || '').toLowerCase();
        const targetUserRole = (targetUser.role || '').toLowerCase();

        const isAdmin = userRole === 'admin';
        // Allow Volunteers to view Gardener profiles (for assignment/reports)
        const isVolunteerViewingGardener = userRole === 'volunteer' && targetUserRole === 'gardener';

        if (!isAdmin && !isSelf && !isVolunteerViewingGardener) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            user: {
                ...targetUser,
                _id: targetUser.id,
                gardens: [
                    ...(targetUser.gardenGardeners?.map(g => ({ ...g.garden, role: 'Gardener', _id: g.garden.id })) || []),
                    ...(targetUser.gardenVolunteers?.map(g => ({ ...g.garden, role: 'Volunteer', _id: g.garden.id })) || [])
                ],
                gardenGardeners: undefined,
                gardenVolunteers: undefined
            }
        }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const { role, search, status } = req.query;
        const { page, limit, skip } = getPaginationParams(req.query);

        const where: any = {};

        // Role-based visibility logic
        const currentUserRole = (user.role || '').toLowerCase();

        if (currentUserRole === 'volunteer') {
            // Volunteers can only see Admins and the Gardeners they are assigned to
            const volunteerAssignments = await prisma.gardenVolunteer.findMany({
                where: { userId: user.id },
                include: { garden: true }
            });
            const assignedGardenerIds = volunteerAssignments.map(v => v.garden.ownerId);

            where.OR = [
                { role: 'Admin' },
                { role: 'admin' },
                { id: { in: assignedGardenerIds } }
            ];
        } else if (currentUserRole === 'gardener') {
            // Gardeners can see everyone (Admins, Gardeners, Volunteers)
            // No base 'where' restriction needed
        } else if (currentUserRole !== 'admin') {
            // Fallback for any other unknown role
            throw new Error('INSUFFICIENT_PERMISSIONS');
        }

        if (role && typeof role === 'string') {
            // If they are a volunteer and they requested a specific role, we need to AND it with their allowed list
            if (currentUserRole === 'volunteer') {
                where.AND = [{ role }];
            } else {
                where.role = role;
            }
        }

        if (status === 'active') {
            where.isActive = true;
        } else if (status === 'inactive') {
            where.isActive = false;
        }

        if (search && typeof search === 'string') {
            const searchClause = {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } }
                ]
            };

            // If where.OR already exists (from Volunteer logic), we need to wrap everything in an AND
            if (where.OR && where.OR.length > 0) {
                if (where.AND) {
                    where.AND.push(searchClause);
                } else {
                    where.AND = [searchClause];
                }
            } else {
                where.OR = searchClause.OR;
            }
        }

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
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
                    createdAt: true
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.user.count({ where })
        ]);

        const transformedUsers = users.map(u => ({ ...u, _id: u.id }));

        setCorsHeaders(res, origin);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(safeJsonStringify(successResponse({
            users: transformedUsers,
            pagination: createPaginationMeta(page, limit, total)
        })));
    } catch (error: any) {
        console.error('[handleList] Error:', error.message);
        console.error('[handleList] Query:', JSON.stringify(req.query));
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
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
                id: true, email: true, name: true, role: true, avatarUrl: true,
                zipcode: true, phone: true, address: true, growing: true,
                isOnline: true, isActive: true, lastSeen: true,
                createdAt: true, updatedAt: true
            }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            user: { ...updatedUser, _id: updatedUser.id }
        }, 'Profile updated successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleAdminUpdateUser(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const adminUser = authenticate(req as AuthenticatedRequest);
        requireAdmin(adminUser);

        const { id, name, email, role, isActive, phone, zipcode, address } = req.body;

        if (!id) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('User ID is required')).payload);
        }

        const updateData: any = {};
        if (name) updateData.name = name;
        if (email) updateData.email = email.toLowerCase();
        if (role) updateData.role = role;
        if (isActive !== undefined) updateData.isActive = isActive;
        if (phone !== undefined) updateData.phone = phone;
        if (zipcode !== undefined) updateData.zipcode = zipcode;
        if (address !== undefined) updateData.address = address;

        // Allow admin to set a new password
        if (req.body.password && typeof req.body.password === 'string' && req.body.password.trim().length >= 8) {
            updateData.password = await bcrypt.hash(req.body.password, 10);
        }

        const updatedUser = await prisma.user.update({
            where: { id },
            data: updateData,
            select: {
                id: true, email: true, name: true, role: true, avatarUrl: true,
                zipcode: true, phone: true, address: true, growing: true,
                isOnline: true, isActive: true, lastSeen: true,
                createdAt: true, updatedAt: true
            }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            ...updatedUser,
            _id: updatedUser.id
        }, 'User updated successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleAdminDeleteUser(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const adminUser = authenticate(req as AuthenticatedRequest);
        requireAdmin(adminUser);

        const { id } = req.query;
        const targetId = id || req.body?.id;

        if (!targetId || typeof targetId !== 'string') {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('User ID is required')).payload);
        }

        if (targetId === adminUser.id) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Administrators cannot delete themselves')).payload);
        }

        // Verify user exists before attempting deletion
        const targetUser = await prisma.user.findUnique({ where: { id: targetId } });
        if (!targetUser) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('User not found')).payload);
        }

        // Cascade-delete all related records in a transaction to avoid FK constraint violations
        await prisma.$transaction([
            prisma.notification.deleteMany({ where: { userId: targetId } }),
            prisma.message.deleteMany({ where: { OR: [{ fromUserId: targetId }, { toUserId: targetId }] } }),
            prisma.report.deleteMany({ where: { userId: targetId } }),
            prisma.task.deleteMany({ where: { assignedTo: targetId } }),                // Task.assignedTo → User
            prisma.eventRegistration.deleteMany({ where: { userId: targetId } }),
            prisma.gardenGardener.deleteMany({ where: { userId: targetId } }),
            prisma.gardenVolunteer.deleteMany({ where: { userId: targetId } }),
            prisma.volunteerAssignment.deleteMany({ where: { userId: targetId } }),
            prisma.volunteerRequest.deleteMany({ where: { requesterId: targetId } }),   // VolunteerRequest.requesterId → User
            prisma.gardenerRequest.deleteMany({ where: { requesterId: targetId } }),
            prisma.invitation.deleteMany({ where: { OR: [{ sentBy: targetId }, { email: targetUser.email }] } }),         // Invitation.sentBy → User
            prisma.gardenInvitation.deleteMany({ where: { OR: [{ invitedBy: targetId }, { userId: targetId }] } }),      // GardenInvitation.invitedBy → User
            prisma.seedlingItem.deleteMany({ where: { createdBy: targetId } }),         // SeedlingItem.createdBy → User
            prisma.supplyItem.deleteMany({ where: { createdBy: targetId } }),           // SupplyItem.createdBy → User
            // Transfer owned gardens to admin rather than deleting them
            prisma.garden.updateMany({ where: { ownerId: targetId }, data: { ownerId: adminUser.id } }),
            // Finally delete the user
            prisma.user.delete({ where: { id: targetId } }),
        ]);


        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(null, 'User deleted successfully'));
    } catch (error: any) {
        console.error('[handleAdminDeleteUser] Error:', error.message, error.code);
        setCorsHeaders(res, origin);
        if (error.code === 'P2025') {
            return res.status(404).json(handleError(new Error('User not found')).payload);
        }
        if (error.code === 'P2003') {
            return res.status(409).json(handleError(new Error('Cannot delete user: related records still exist')).payload);
        }
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}


async function handleUploadAvatar(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { avatarImage } = req.body;

        if (!avatarImage) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Avatar image is required')).payload);
        }

        if (!validateBase64ImageSize(avatarImage, 5)) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Avatar image must be less than 5MB')).payload);
        }

        const avatarUrl = await uploadImage(avatarImage, 'avatars', `user-${user.id}`);

        const updatedUser = await prisma.user.update({
            where: { id: user.id },
            data: { avatarUrl },
            select: {
                id: true, email: true, name: true, role: true, avatarUrl: true,
                zipcode: true, phone: true, address: true, growing: true,
                isOnline: true, isActive: true, lastSeen: true,
                createdAt: true, updatedAt: true
            }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            ...updatedUser,
            _id: updatedUser.id
        }, 'Avatar uploaded successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

// --- Notifications Logic ---

async function handleNotifications(req: VercelRequest, res: VercelResponse, origin?: string) {
    const { id, action } = req.query;

    try {
        const user = authenticate(req as AuthenticatedRequest);

        if (req.method === 'GET') {
            const { limit = '20', offset = '0' } = req.query;
            const [notifications, total] = await Promise.all([
                prisma.notification.findMany({
                    where: { userId: user.id },
                    orderBy: { createdAt: 'desc' },
                    take: parseInt(limit as string),
                    skip: parseInt(offset as string)
                }),
                prisma.notification.count({ where: { userId: user.id } })
            ]);

            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({
                notifications: notifications.map(n => ({ ...n, _id: n.id })),
                total,
                limit: parseInt(limit as string),
                offset: parseInt(offset as string)
            }));
        }

        if (req.method === 'PUT' && id && typeof id === 'string' && action === 'read') {
            const updated = await prisma.notification.update({
                where: { id, userId: user.id },
                data: { isRead: true }
            });
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ ...updated, _id: updated.id }, 'Notification marked as read'));
        }

        if (req.method === 'DELETE' && id && typeof id === 'string') {
            await prisma.notification.delete({ where: { id, userId: user.id } });
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Notification deleted successfully'));
        }

        if (req.method === 'POST' && action === 'read-all') {
            const result = await prisma.notification.updateMany({
                where: { userId: user.id, isRead: false },
                data: { isRead: true }
            });
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ count: result.count }, `Marked ${result.count} notifications as read`));
        }

        setCorsHeaders(res, origin);
        return res.status(405).json(handleError(new Error('Method not allowed for notifications')).payload);
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

// --- Messages Logic ---

async function handleMessages(req: VercelRequest, res: VercelResponse, origin?: string) {
    const { userId, action, id, format } = req.query;

    try {
        const user = authenticate(req as AuthenticatedRequest);

        if (req.method === 'GET') {
            if (action === 'unread-count') {
                const count = await prisma.message.count({ where: { toUserId: user.id, read: false } });
                setCorsHeaders(res, origin);
                return res.status(200).json(successResponse({ count }));
            }

            if (format === 'conversations') {
                const messages = await prisma.message.findMany({
                    where: { OR: [{ fromUserId: user.id }, { toUserId: user.id }] },
                    include: {
                        fromUser: { select: { id: true, name: true, avatarUrl: true, role: true } },
                        toUser: { select: { id: true, name: true, avatarUrl: true, role: true } }
                    },
                    orderBy: { createdAt: 'desc' }
                });

                const conversationsMap = new Map();
                for (const message of messages) {
                    const otherUser = message.fromUserId === user.id ? message.toUser : message.fromUser;
                    if (!conversationsMap.has(otherUser.id)) {
                        conversationsMap.set(otherUser.id, { user: otherUser, lastMessage: message, unreadCount: 0 });
                    }
                    if (message.toUserId === user.id && !message.read) {
                        conversationsMap.get(otherUser.id).unreadCount++;
                    }
                }

                const conversations = Array.from(conversationsMap.values())
                    .sort((a, b: any) => b.lastMessage.createdAt.getTime() - a.lastMessage.createdAt.getTime());

                setCorsHeaders(res, origin);
                return res.status(200).json(successResponse(conversations.map((c: any) => ({
                    ...c, lastMessage: { ...c.lastMessage, _id: c.lastMessage.id }
                }))));
            }

            if (userId && typeof userId === 'string') {
                const messages = await prisma.message.findMany({
                    where: { OR: [{ fromUserId: user.id, toUserId: userId }, { fromUserId: userId, toUserId: user.id }] },
                    include: {
                        fromUser: { select: { id: true, name: true, avatarUrl: true } },
                        toUser: { select: { id: true, name: true, avatarUrl: true } }
                    },
                    orderBy: { createdAt: 'asc' }
                });

                await prisma.message.updateMany({
                    where: { fromUserId: userId, toUserId: user.id, read: false },
                    data: { read: true, readAt: new Date() }
                });

                setCorsHeaders(res, origin);
                return res.status(200).json(successResponse(messages.map(m => ({ ...m, _id: m.id }))));
            }
        }

        if (req.method === 'POST') {
            const validatedData = validateRequest(MessageCreateSchema, req.body);
            const { subject = '', ...rest } = validatedData;
            const message = await prisma.message.create({
                data: { fromUserId: user.id, subject, ...rest },
                include: {
                    fromUser: { select: { id: true, name: true, avatarUrl: true } },
                    toUser: { select: { id: true, name: true, avatarUrl: true } }
                }
            });
            setCorsHeaders(res, origin);
            return res.status(201).json(successResponse({ ...message, _id: message.id }, 'Message sent successfully'));
        }

        if (req.method === 'DELETE' && id && typeof id === 'string') {
            const message = await prisma.message.findUnique({ where: { id } });
            if (!message || (message.fromUserId !== user.id && message.toUserId !== user.id)) {
                setCorsHeaders(res, origin);
                return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
            }
            await prisma.message.delete({ where: { id } });
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Message deleted successfully'));
        }

        setCorsHeaders(res, origin);
        return res.status(405).json(handleError(new Error('Method not allowed for messages')).payload);
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleSystemInvitations(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        if (req.method === 'GET') {
            const invitations = await prisma.invitation.findMany({
                include: { sender: { select: { id: true, name: true } } },
                orderBy: { createdAt: 'desc' }
            });

            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse(invitations.map(i => ({ ...i, _id: i.id }))));
        }

        if (req.method === 'POST') {
            let { email, role, message } = validateRequest(InvitationCreateSchema, req.body);
            email = email.toLowerCase();
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days expiry

            const invitation = await prisma.invitation.create({
                data: {
                    email,
                    role,
                    message,
                    token,
                    sentBy: user.id,
                    expiresAt
                }
            });

            setCorsHeaders(res, origin);
            return res.status(201).json(successResponse({ ...invitation, _id: invitation.id }, 'Invitation sent successfully'));
        }

        if (req.method === 'DELETE') {
            const { id } = req.query;
            if (!id || typeof id !== 'string') {
                setCorsHeaders(res, origin);
                return res.status(400).json(handleError(new Error('Invitation ID is required')).payload);
            }

            await prisma.invitation.delete({ where: { id } });
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Invitation revoked successfully'));
        }

        setCorsHeaders(res, origin);
        return res.status(405).json(handleError(new Error('Method not allowed')).payload);
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}
