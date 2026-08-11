import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, validateRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders, safeJsonStringify } from '../lib/response';
import { GardenInvitationCreateSchema } from '../lib/validation';
import prisma from '../lib/prisma';
import { geocodeAddress } from '../lib/geocode';
import { handleCorsPreflightRequest } from '../lib/cors';
import { getPaginationParams, createPaginationMeta } from '../lib/validators';

/**
 * Transform garden data to match frontend expectations
 */
function transformGarden(garden: any) {
    if (!garden) return null;

    // Explicitly convert Prisma Decimal to plain number to prevent JSON serialization errors
    const lat = garden.latitude != null ? Number(garden.latitude) : null;
    const lng = garden.longitude != null ? Number(garden.longitude) : null;

    return {
        ...garden,
        latitude: lat,
        longitude: lng,
        _id: garden.id,
        location: lat && lng ? {
            type: 'Point',
            coordinates: [lng, lat]
        } : undefined,
        assignedGardeners: garden.gardenGardeners?.map((gg: any) => ({
            ...gg.user,
            _id: gg.user.id,
            id: gg.user.id
        })) || [],
        volunteers: garden.gardenVolunteers?.map((gv: any) => ({
            ...gv.user,
            _id: gv.user.id,
            id: gv.user.id
        })) || [],
        gardenGardeners: undefined,
        gardenVolunteers: undefined
    };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    let { id, action } = req.query;
    const origin = req.headers.origin;

    // Normalize query strings to handle malformed concatenations from frontend (e.g. ?action=map?zipcode=...)
    if (typeof action === 'string' && action.includes('?')) {
        action = action.split('?')[0];
    }
    if (typeof id === 'string' && id.includes('?')) {
        id = id.split('?')[0];
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    // Route to invitation logic
    if (action === 'invite' || action === 'accept' || action === 'reject' || (req.method === 'GET' && action === 'invitations')) {
        return handleInvitations(req, res, origin);
    }

    if (req.method === 'GET') {
        if (action === 'map') return handleMapData(req, res, origin);
        if (action === 'members' && id && typeof id === 'string') return handleMembers(req, res, id, origin);
        if (id && typeof id === 'string') return handleGetSingle(req, res, id, origin);
        return handleList(req, res, origin);
    }

    if (req.method === 'POST') {
        if (action === 'gardeners' && id && typeof id === 'string') return handleGardeners(req, res, id, origin);
        if (action === 'volunteers' && id && typeof id === 'string') return handleVolunteers(req, res, id, origin);
        return handleCreateGarden(req, res, origin);
    }

    if (req.method === 'PUT' || req.method === 'PATCH') {
        if (action === 'status' && id && typeof id === 'string') return handleStatus(req, res, id, origin);
        if (id && typeof id === 'string') return handleUpdateGarden(req, res, id, origin);
    }

    if (req.method === 'DELETE') {
        if (action === 'gardeners' && id && typeof id === 'string') return handleGardeners(req, res, id, origin);
        if (action === 'volunteers' && id && typeof id === 'string') return handleVolunteers(req, res, id, origin);
        if (id && typeof id === 'string') return handleDeleteGarden(req, res, id, origin);
    }

    setCorsHeaders(res, origin);
    return res.status(405).json(handleError(new Error('Method not allowed')).payload);
}

// --- Garden Management Logic ---

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { page, limit, skip } = getPaginationParams(req.query);

        const [gardens, total] = await Promise.all([
            prisma.garden.findMany({
                where: { status: 'active' },
                skip,
                take: limit,
                include: {
                    owner: { select: { id: true, name: true, email: true, avatarUrl: true } },
                    gardenGardeners: { include: { user: { select: { id: true, name: true, avatarUrl: true, growing: true } } } },
                    gardenVolunteers: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
                    _count: { select: { events: true, volunteerRequests: true, reports: true } }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.garden.count({ where: { status: 'active' } })
        ]);

        setCorsHeaders(res, origin);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(safeJsonStringify(successResponse({
            gardens: gardens.map(transformGarden),
            pagination: createPaginationMeta(page, limit, total)
        })));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGetSingle(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const garden = await prisma.garden.findUnique({
            where: { id },
            include: {
                owner: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } },
                gardenGardeners: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true, growing: true } } } },
                gardenVolunteers: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } } } },
                events: { where: { date: { gte: new Date() } }, orderBy: { date: 'asc' }, take: 10 },
                volunteerRequests: { where: { status: 'open' }, orderBy: { createdAt: 'desc' }, take: 10 },
                reports: { orderBy: { createdAt: 'desc' }, take: 10, include: { user: { select: { id: true, name: true, avatarUrl: true } } } }
            }
        });

        if (!garden) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Garden not found')).payload);
        }

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(transformGarden(garden)));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleMembers(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const garden = await prisma.garden.findUnique({
            where: { id },
            select: {
                id: true,
                gardenGardeners: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true, growing: true } } } },
                gardenVolunteers: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, phone: true } } } }
            }
        });

        if (!garden) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Garden not found')).payload);
        }

        const transformed = transformGarden(garden);
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            gardenId: id,
            assignedGardeners: transformed.assignedGardeners,
            volunteers: transformed.volunteers
        }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGardeners(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        if ((user.role || '').toLowerCase() !== 'admin') {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        if (req.method === 'POST') {
            const { gardenerId } = req.body;
            if (!gardenerId) throw new Error('Gardener ID is required');

            await prisma.gardenGardener.upsert({
                where: { gardenId_userId: { gardenId: id, userId: gardenerId } },
                update: {},
                create: { gardenId: id, userId: gardenerId }
            });

            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Gardener assigned successfully'));
        }

        if (req.method === 'DELETE') {
            const { gardenerId } = req.query; // Or from body if preferred
            if (!gardenerId || typeof gardenerId !== 'string') throw new Error('gardenerId query parameter is required');

            await prisma.gardenGardener.deleteMany({
                where: { gardenId: id, userId: gardenerId }
            });

            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Gardener removed successfully'));
        }
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleVolunteers(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        if ((user.role || '').toLowerCase() !== 'admin') {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        if (req.method === 'POST') {
            const { volunteerId } = req.body;
            if (!volunteerId) throw new Error('Volunteer ID is required');

            await prisma.gardenVolunteer.upsert({
                where: { gardenId_userId: { gardenId: id, userId: volunteerId } },
                update: {},
                create: { gardenId: id, userId: volunteerId }
            });

            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Volunteer assigned successfully'));
        }

        if (req.method === 'DELETE') {
            const { volunteerId } = req.query;
            if (!volunteerId || typeof volunteerId !== 'string') throw new Error('volunteerId query parameter is required');

            await prisma.gardenVolunteer.deleteMany({
                where: { gardenId: id, userId: volunteerId }
            });

            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Volunteer removed successfully'));
        }
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

// --- Invitations Logic ---

async function handleInvitations(req: VercelRequest, res: VercelResponse, origin?: string) {
    const { id, action } = req.query;

    try {
        const user = authenticate(req as AuthenticatedRequest);

        if (req.method === 'GET') {
            const userRole = (user.role || '').toLowerCase();
            const where: any = userRole === 'admin' ? {} : { userId: user.id };
            if (userRole === 'admin' && req.query.status) where.status = req.query.status;

            const invitations = await prisma.gardenInvitation.findMany({
                where,
                include: {
                    garden: { select: { id: true, name: true, address: true, description: true } },
                    user: { select: { id: true, name: true, email: true, avatarUrl: true } },
                    inviter: { select: { id: true, name: true, email: true, avatarUrl: true } }
                },
                orderBy: { createdAt: 'desc' }
            });

            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse(invitations.map(i => ({ ...i, _id: i.id }))));
        }

        if (req.method === 'POST') {
            const data = validateRequest(GardenInvitationCreateSchema, req.body);
            const garden = await prisma.garden.findUnique({ where: { id: data.gardenId } });
            if (!garden) {
                setCorsHeaders(res, origin);
                return res.status(404).json(handleError(new Error('Garden not found')).payload);
            }
            if ((user.role || '').toLowerCase() !== 'admin' && garden.ownerId !== user.id) {
                setCorsHeaders(res, origin);
                return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
            }

            const invitation = await prisma.gardenInvitation.create({
                data: { gardenId: data.gardenId, userId: data.userId, invitedBy: user.id, status: 'pending' },
                include: {
                    garden: { select: { id: true, name: true, address: true, description: true } },
                    user: { select: { id: true, name: true, email: true, avatarUrl: true } },
                    inviter: { select: { id: true, name: true, email: true, avatarUrl: true } }
                }
            });

            await prisma.notification.create({
                data: { userId: data.userId, title: 'Garden Invitation', message: `You have been invited to join ${garden.name} as a ${data.role}`, type: 'invitation' }
            });

            setCorsHeaders(res, origin);
            return res.status(201).json(successResponse({ ...invitation, _id: invitation.id }, 'Invitation sent successfully'));
        }

        if (req.method === 'PUT' && id && typeof id === 'string') {
            if (action === 'accept') {
                const { role } = req.body;
                if (!role || !['Gardener', 'Volunteer'].includes(role)) {
                    setCorsHeaders(res, origin);
                    return res.status(400).json(handleError(new Error('Invalid role')).payload);
                }

                const invitation = await prisma.gardenInvitation.findUnique({ where: { id }, include: { garden: true } });
                if (!invitation || invitation.userId !== user.id || invitation.status !== 'pending') {
                    setCorsHeaders(res, origin);
                    return res.status(403).json(handleError(new Error('Invalid invitation')).payload);
                }

                await prisma.gardenInvitation.update({ where: { id }, data: { status: 'accepted', respondedAt: new Date() } });
                if (role.toLowerCase() === 'gardener') {
                    await prisma.gardenGardener.create({ data: { gardenId: invitation.gardenId, userId: user.id } });
                } else {
                    await prisma.gardenVolunteer.create({ data: { gardenId: invitation.gardenId, userId: user.id } });
                }

                const u = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
                await prisma.notification.create({
                    data: { userId: invitation.invitedBy, title: 'Invitation Accepted', message: `${u?.name || 'A user'} has accepted the invitation to join ${invitation.garden.name}`, type: 'invitation' }
                });

                setCorsHeaders(res, origin);
                return res.status(200).json(successResponse({ success: true }, 'Invitation accepted successfully'));
            }

            if (action === 'reject') {
                const invitation = await prisma.gardenInvitation.findUnique({ where: { id }, include: { garden: true } });
                if (!invitation || invitation.userId !== user.id || invitation.status !== 'pending') {
                    setCorsHeaders(res, origin);
                    return res.status(403).json(handleError(new Error('Invalid invitation')).payload);
                }

                await prisma.gardenInvitation.update({ where: { id }, data: { status: 'rejected', respondedAt: new Date() } });
                const u = await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } });
                await prisma.notification.create({
                    data: { userId: invitation.invitedBy, title: 'Invitation Rejected', message: `${u?.name || 'A user'} has declined the invitation to join ${invitation.garden.name}`, type: 'invitation' }
                });

                setCorsHeaders(res, origin);
                return res.status(200).json(successResponse({ success: true }, 'Invitation rejected'));
            }
        }

        setCorsHeaders(res, origin);
        return res.status(405).json(handleError(new Error('Method not allowed for invitations')).payload);
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleMapData(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);

        // 1. Fetch ALL active gardens — not just those with coordinates
        const gardens = await prisma.garden.findMany({
            where: { status: 'active' },
            select: {
                id: true,
                name: true,
                address: true,
                latitude: true,
                longitude: true,
                zipcode: true,
                owner: { select: { id: true, name: true } },
                _count: {
                    select: {
                        gardenGardeners: true,
                        gardenVolunteers: true,
                        volunteerRequests: { where: { status: 'open' } }
                    }
                }
            }
        });

        // 2. Geocode any gardens missing coordinates (backfill on first request)
        const geocodePromises = gardens
            .filter(g => g.latitude == null || g.longitude == null)
            .map(async (g) => {
                try {
                    const { latitude, longitude } = await geocodeAddress(g.address);
                    if (latitude && longitude) {
                        await prisma.garden.update({
                            where: { id: g.id },
                            data: { latitude, longitude }
                        });
                        // Mutate in-place so we return the new coords in this response
                        (g as any).latitude = latitude;
                        (g as any).longitude = longitude;
                    }
                } catch (geoErr) {
                    console.warn(`[map] Failed to geocode garden ${g.id} (${g.address}):`, geoErr);
                }
            });

        // Run geocoding in parallel (fire-and-forget style, but await so coords are in this response)
        if (geocodePromises.length > 0) {
            await Promise.allSettled(geocodePromises);
        }

        // 3. Return only gardens that now have valid coordinates
        const withCoords = gardens.filter(g => g.latitude != null && g.longitude != null);

        setCorsHeaders(res, origin);
        res.setHeader('Content-Type', 'application/json');
        return res.status(200).send(safeJsonStringify(successResponse(withCoords.map(transformGarden))));
    } catch (error: any) {
        console.error('[api/gardens] Error in handleMapData:', {
            query: req.query,
            error: error.message,
            stack: error.stack,
            code: error.code
        });
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}


async function handleStatus(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { status } = req.body;
        if (!status) throw new Error('Status is required');

        const garden = await prisma.garden.findUnique({ where: { id } });
        if (!garden) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Garden not found')).payload);
        }

        if ((user.role || '').toLowerCase() !== 'admin' && garden.ownerId !== user.id) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        await prisma.garden.update({
            where: { id },
            data: { status }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Garden status updated successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleCreateGarden(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        if ((user.role || '').toLowerCase() !== 'admin') {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        const { name, description, address, zipcode, capacity, ownerId, rules, features, image } = req.body;
        if (!name || !address) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Name and address are required')).payload);
        }

        let latitude: number | null = null;
        let longitude: number | null = null;
        try {
            const coords = await geocodeAddress(address);
            latitude = coords.latitude;
            longitude = coords.longitude;
        } catch (geoErr) {
            console.warn('[handleCreateGarden] Geocode error:', geoErr);
        }

        const newGarden = await prisma.garden.create({
            data: {
                name,
                description: description || '',
                address,
                zipcode: zipcode || '',
                plotSize: capacity ? String(capacity) : undefined,
                status: 'active',
                ownerId: ownerId || user.id,
                latitude,
                longitude,
            }
        });

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse(transformGarden(newGarden), 'Garden created successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleUpdateGarden(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const garden = await prisma.garden.findUnique({ where: { id } });
        if (!garden) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Garden not found')).payload);
        }

        if ((user.role || '').toLowerCase() !== 'admin' && garden.ownerId !== user.id) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        const { name, description, address, zipcode, capacity, status, ownerId } = req.body;
        const updateData: any = {};
        if (name) updateData.name = name;
        if (description !== undefined) updateData.description = description;
        if (zipcode !== undefined) updateData.zipcode = zipcode;
        if (capacity !== undefined) updateData.plotSize = String(capacity);
        if (status) updateData.status = status;
        if (ownerId) updateData.ownerId = ownerId;

        if (address && address !== garden.address) {
            updateData.address = address;
            try {
                const coords = await geocodeAddress(address);
                if (coords.latitude && coords.longitude) {
                    updateData.latitude = coords.latitude;
                    updateData.longitude = coords.longitude;
                }
            } catch (geoErr) {
                console.warn('[handleUpdateGarden] Geocode error:', geoErr);
            }
        }

        const updatedGarden = await prisma.garden.update({
            where: { id },
            data: updateData
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(transformGarden(updatedGarden), 'Garden updated successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleDeleteGarden(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        if ((user.role || '').toLowerCase() !== 'admin') {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        const garden = await prisma.garden.findUnique({ where: { id } });
        if (!garden) {
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ success: true }, 'Garden already deleted'));
        }

        await prisma.$transaction([
            prisma.gardenGardener.deleteMany({ where: { gardenId: id } }),
            prisma.gardenVolunteer.deleteMany({ where: { gardenId: id } }),
            prisma.gardenInvitation.deleteMany({ where: { gardenId: id } }),
            prisma.report.deleteMany({ where: { gardenId: id } }),
            prisma.volunteerRequest.deleteMany({ where: { gardenId: id } }),
            prisma.event.deleteMany({ where: { gardenId: id } }),
            prisma.garden.delete({ where: { id } })
        ]);

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Garden deleted successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}
