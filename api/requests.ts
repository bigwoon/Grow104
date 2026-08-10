import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, requireGardenerOrAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders } from '../lib/response';
import {
    GardenerRequestCreateSchema,
    GardenerRequestUpdateSchema,
    VolunteerRequestCreateSchema,
    VolunteerRequestUpdateSchema,
    TaskCreateSchema,
    TaskUpdateSchema
} from '../lib/validation';
import { getGardenerGarden } from '../lib/utils';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    let { type, id, action } = req.query;
    const origin = req.headers.origin;

    // Normalize type to handle malformed query strings from frontend (e.g. ?type=volunteer?status=open)
    if (typeof type === 'string' && type.includes('?')) {
        type = type.split('?')[0];
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    // Route to gardener or volunteer request handlers based on type
    if (type === 'gardener') {
        if (req.method === 'GET') return handleGardenerList(req, res, origin);
        if (req.method === 'POST') {
            if (action === 'food-utility') return handleGardenerFoodUtility(req, res, origin);
            if (action === 'seedlings') return handleGardenerSeedlings(req, res, origin);
            return handleGardenerCreate(req, res, origin);
        }
        if ((req.method === 'PUT' || req.method === 'PATCH') && id && typeof id === 'string') return handleGardenerUpdate(req, res, id, origin);
        if (req.method === 'DELETE' && id && typeof id === 'string') return handleGardenerDelete(req, res, id, origin);
    }

    if (type === 'volunteer') {
        if (req.method === 'GET') return handleVolunteerList(req, res, origin);
        if (req.method === 'POST') {
            if (action === 'join' && id && typeof id === 'string') return handleVolunteerJoin(req, res, id, origin);
            if (action === 'leave' && id && typeof id === 'string') return handleVolunteerLeave(req, res, id, origin);
            return handleVolunteerCreate(req, res, origin);
        }
        if ((req.method === 'PUT' || req.method === 'PATCH') && id && typeof id === 'string') return handleVolunteerUpdate(req, res, id, origin);
        if (req.method === 'DELETE' && id && typeof id === 'string') return handleVolunteerDelete(req, res, id, origin);
    }

    if (type === 'task') {
        if (req.method === 'GET') return handleTaskList(req, res, origin);
        if (req.method === 'POST') return handleTaskCreate(req, res, origin);
        if ((req.method === 'PUT' || req.method === 'PATCH') && id && typeof id === 'string') return handleTaskUpdate(req, res, id, origin);
        if (req.method === 'DELETE' && id && typeof id === 'string') return handleTaskDelete(req, res, id, origin);
    }

    setCorsHeaders(res, origin);
    return res.status(400).json(handleError(new Error('Invalid type. Use ?type=gardener, volunteer, or task')).payload);
}

// ============================================
// GARDENER REQUEST HANDLERS
// ============================================

async function handleGardenerList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { requestType, status } = req.query;

        const where: any = {};
        if (requestType && typeof requestType === 'string') where.requestType = requestType;
        if (status && typeof status === 'string') where.status = status;

        const requests = await prisma.gardenerRequest.findMany({
            where,
            include: { requester: { select: { id: true, name: true, avatarUrl: true, address: true } } },
            orderBy: { createdAt: 'desc' }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(requests.map((r: any) => ({
            ...r,
            _id: r.id,
            status: r.status ? r.status.toLowerCase().replace(' ', '_') : r.status,
            // Map DB fields to frontend expected fields
            seedlings: r.seedlingIds || [],
            supplies: r.supplyIds || [],
            items: r.supplyIds || [], // Alias for "Inventory" requests view
            // Map requester relation to frontend expected fields
            user: {
                ...r.requester,
                name: r.requester?.name || r.requester?.email // Fallback to email if name is empty
            },
            gardener: {
                ...r.requester,
                name: r.requester?.name || r.requester?.email
            },
            requesterName: r.requester?.name || r.requester?.email,
            requesterEmail: r.requester?.email || r.requester?.id
        }))));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGardenerCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        // Pre-process body to handle frontend aliases before validation
        const body = req.body || {};

        // Infer requestType if missing
        let requestType = body.requestType;
        if (!requestType) {
            if (body.items || body.supplyIds) requestType = 'supplies';
            else if (body.vegetables || body.seedlings || body.season) requestType = 'seedlings';
            else if (body.assistanceType || body.householdSize) requestType = 'food-utility';
            else if (body.task) requestType = 'volunteer-help';
            else requestType = 'supplies'; // Default fallback
        }

        // Map frontend fields (items) to backend fields (supplyIds)
        const supplyIds = body.items || body.supplyIds;

        const data = validateRequest(GardenerRequestCreateSchema, {
            ...body,
            requestType
        });

        // Construct data object for Prisma, ensuring we map aliases to DB columns
        // and remove non-DB fields (like 'items' or 'vegetables') provided by schema aliases
        // description is a required non-null String in Prisma — always provide a fallback
        const descriptionValue =
            (data.description && data.description.trim())
            || (data.notes && (data.notes as string).trim())
            || (body.description && (body.description as string).trim())
            || (body.details && (body.details as string).trim())
            || (data.task && (data.task as string).trim())   // volunteer-help: task IS the description
            || (body.task && (body.task as string).trim())
            || `${requestType} request`;

        const createData: any = {
            requesterId: user.id,
            title: data.title || `${requestType} request`,
            description: descriptionValue,
            requestType: (data.requestType || requestType) as string,
            status: 'pending',

            // Map specific fields based on type
            ...(requestType === 'supplies' && { supplyIds: supplyIds }),
            ...(requestType === 'seedlings' && {
                seedlingIds: data.vegetables || data.seedlingIds,
                season: data.season,
                quantity: data.quantity
            }),
            ...(requestType === 'food-utility' && {
                assistanceType: data.assistanceType,
                householdSize: data.householdSize
            }),
            ...(requestType === 'volunteer-help' && { task: data.task }),

            notes: data.notes
        };

        const request = await prisma.gardenerRequest.create({
            data: createData,
            include: { requester: { select: { id: true, name: true, avatarUrl: true, address: true } } }
        });

        const responseData = {
            ...request,
            _id: request.id,
            // Map back for immediate frontend display
            seedlings: request.seedlingIds || [],
            supplies: request.supplyIds || [],
            items: request.supplyIds || []
        };

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse(responseData, 'Request submitted successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGardenerSeedlings(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        // Use loose validation for now to debug payload structure
        const body = req.body || {};

        // Map frontend fields (vegetables) to backend fields (seedlingIds)
        // Frontend sends: { season: 'spring', vegetables: ['Carrots'], quantity: 1, notes: '...' }
        const payload = {
            title: 'Seedling Request',
            description: body.notes || 'Request for seedlings',
            requestType: 'seedlings' as const,
            status: 'pending' as const,
            season: body.season,
            quantity: body.quantity ? Number(body.quantity) : undefined,
            notes: body.notes,
            // Store vegetable names in seedlingIds (we relaxed validation to allow this)
            seedlingIds: body.vegetables || body.seedlings || []
        };

        // Validate using our updated schema
        const data = validateRequest(GardenerRequestCreateSchema, payload);

        const { title: _st, description: _sd, ...restData } = data;
        const request = await prisma.gardenerRequest.create({
            data: {
                requesterId: user.id,
                ...restData,
                title: _st || 'Seedling Request',
                description: (_st && _st.trim()) || (restData.notes as string | undefined) || 'Seedling request',
                requestType: 'seedlings',
                seedlingIds: payload.seedlingIds
            },
            include: { requester: { select: { id: true, name: true, avatarUrl: true, address: true } } }
        });

        const responseData = {
            ...request,
            _id: request.id,
            seedlings: request.seedlingIds || [] // Map back for frontend immediate display
        };

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse(responseData, 'Seedling request submitted successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        // Log detailed error for debugging
        console.error('Seedling Request Error:', error);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGardenerFoodUtility(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const body = req.body || {};

        // Frontend sends: { assistanceType: 'food', householdSize: 2, details: '...', notes: '...' }
        const payload = {
            title: `Assistance Request: ${body.assistanceType || 'General'}`,
            description: body.details || body.notes || 'Request for assistance',
            requestType: 'food-utility' as const,
            status: 'pending' as const,
            assistanceType: body.assistanceType,
            householdSize: body.householdSize ? Number(body.householdSize) : undefined,
            notes: body.notes || body.details
        };

        const data = validateRequest(GardenerRequestCreateSchema, payload);

        const { title: _ft, description: _fd, ...restFuData } = data;
        const request = await prisma.gardenerRequest.create({
            data: {
                requesterId: user.id,
                ...restFuData,
                title: _ft || 'Food & Utility Request',
                description: (_fd && _fd.trim()) || (body.notes as string | undefined) || (body.details as string | undefined) || 'Food & utility assistance request',
                requestType: 'food-utility'
            },
            include: { requester: { select: { id: true, name: true, avatarUrl: true, address: true } } }
        });

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({ ...request, _id: request.id }, 'Assistance request submitted successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        console.error('Food/Utility Request Error:', error);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGardenerUpdate(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const userRole = (user.role || '').toLowerCase();
        const existing = await prisma.gardenerRequest.findUnique({ where: { id } });
        if (!existing || (userRole !== 'admin' && existing.requesterId !== user.id)) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        const data = validateRequest(GardenerRequestUpdateSchema, req.body);
        const request = await prisma.gardenerRequest.update({
            where: { id },
            data,
            include: { requester: { select: { id: true, name: true, avatarUrl: true, address: true } } }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ ...request, _id: request.id }, 'Request updated successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGardenerDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const userRole = (user.role || '').toLowerCase();
        const existing = await prisma.gardenerRequest.findUnique({ where: { id } });
        if (!existing || (userRole !== 'admin' && existing.requesterId !== user.id)) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }
        await prisma.gardenerRequest.delete({ where: { id } });
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Request deleted successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

// ============================================
// VOLUNTEER REQUEST HANDLERS
// ============================================

async function handleVolunteerList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { gardenId, status } = req.query;
        const where: any = {};
        if (gardenId && typeof gardenId === 'string') where.gardenId = gardenId;
        if (status && typeof status === 'string') where.status = status;

        const requests = await prisma.volunteerRequest.findMany({
            where,
            include: {
                garden: { select: { id: true, name: true, address: true } },
                requester: { select: { id: true, name: true, avatarUrl: true } },
                _count: { select: { assignments: true } },
                assignments: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } }
            },
            orderBy: { createdAt: 'desc' }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(requests.map((r: any) => ({
            ...r, _id: r.id, status: r.status ? r.status.toLowerCase().replace(' ', '_') : r.status,
            currentVolunteers: r._count?.assignments || 0,
            assignedVolunteers: r.assignments?.map((a: any) => ({ ...a.user, _id: a.user.id })),
            // Map requester for frontend consistency
            user: {
                ...r.requester,
                name: r.requester?.name || r.requester?.email
            },
            requesterName: r.requester?.name || r.requester?.email
        }))));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleVolunteerCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const data = validateRequest(VolunteerRequestCreateSchema, req.body);
        let gId = data.gardenId || ((user.role || '').toLowerCase() === 'gardener' ? (await getGardenerGarden(user.id)).id : null);
        if (!gId) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Garden ID required')).payload);
        }

        const request = await prisma.volunteerRequest.create({
            data: { ...data, gardenId: gId, requesterId: user.id, date: new Date(data.date), status: 'open' },
            include: { garden: { select: { id: true, name: true, address: true } }, requester: { select: { id: true, name: true, avatarUrl: true } } }
        });

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({ ...request, _id: request.id, currentVolunteers: 0, assignedVolunteers: [] }, 'Created'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleVolunteerJoin(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const request = await prisma.volunteerRequest.findUnique({ where: { id }, include: { _count: { select: { assignments: true } } } });
        if (!request || request.status !== 'open' || request._count.assignments >= request.maxVolunteers) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Cannot join')).payload);
        }
        await prisma.volunteerAssignment.create({ data: { requestId: id, userId: user.id } });
        if (request._count.assignments + 1 >= request.maxVolunteers) {
            await prisma.volunteerRequest.update({ where: { id }, data: { status: 'in_progress' } });
        }
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleVolunteerLeave(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        await prisma.volunteerAssignment.delete({ where: { requestId_userId: { requestId: id, userId: user.id } } });
        const request = await prisma.volunteerRequest.findUnique({ where: { id }, include: { _count: { select: { assignments: true } } } });
        if (request && request.status === 'in_progress' && request._count.assignments < request.maxVolunteers) {
            await prisma.volunteerRequest.update({ where: { id }, data: { status: 'open' } });
        }
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleVolunteerUpdate(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const existing = await prisma.volunteerRequest.findUnique({ where: { id } });
        if (!existing || ((user.role || '').toLowerCase() !== 'admin' && existing.requesterId !== user.id)) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }
        const data = validateRequest(VolunteerRequestUpdateSchema, req.body);
        const request = await prisma.volunteerRequest.update({
            where: { id },
            data: { ...data, date: data.date ? new Date(data.date) : undefined },
            include: {
                garden: { select: { id: true, name: true, address: true } },
                requester: { select: { id: true, name: true, avatarUrl: true } },
                _count: { select: { assignments: true } },
                assignments: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } }
            }
        });
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            ...request, _id: request.id, currentVolunteers: request._count?.assignments || 0,
            assignedVolunteers: request.assignments?.map((a: any) => ({ ...a.user, _id: a.user.id }))
        }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleVolunteerDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const existing = await prisma.volunteerRequest.findUnique({ where: { id } });
        if (!existing || ((user.role || '').toLowerCase() !== 'admin' && existing.requesterId !== user.id)) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }
        await prisma.volunteerRequest.delete({ where: { id } });
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

// ============================================
// TASK HANDLERS
// ============================================

async function handleTaskList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { userId, gardenId, status } = req.query;
        const userRole = (user.role || '').toLowerCase();
        const where: any = userRole !== 'admin' ? { assignedTo: user.id } : (userId ? { assignedTo: userId } : {});
        if (gardenId) where.gardenId = gardenId;
        if (status) where.status = status;

        const tasks = await prisma.task.findMany({
            where,
            include: { garden: { select: { id: true, name: true, address: true } }, user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
            orderBy: [{ status: 'asc' }, { dueDate: 'asc' }]
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(tasks.map(t => ({ ...t, _id: t.id }))));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleTaskCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireGardenerOrAdmin(user);
        const data = validateRequest(TaskCreateSchema, req.body);
        const userRole = (user.role || '').toLowerCase();

        if (userRole === 'gardener') {
            const garden = await prisma.garden.findFirst({
                where: { id: data.gardenId, OR: [{ ownerId: user.id }, { gardenGardeners: { some: { userId: user.id } } }] }
            });
            if (!garden) {
                setCorsHeaders(res, origin);
                return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
            }
        }

        const task = await prisma.task.create({
            data: { ...data, dueDate: data.dueDate ? new Date(data.dueDate) : null },
            include: { garden: { select: { id: true, name: true, address: true } }, user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
        });

        if (task.assignedTo !== user.id) {
            await prisma.notification.create({
                data: { userId: task.assignedTo, title: 'New Task Assigned', message: `You have been assigned: ${task.title}`, type: 'task' }
            });
        }

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({ ...task, _id: task.id }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleTaskUpdate(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const existing = await prisma.task.findUnique({ where: { id }, include: { garden: true } });
        if (!existing) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Task not found')).payload);
        }

        const userRole = (user.role || '').toLowerCase();
        const canUpdate = userRole === 'admin' || existing.assignedTo === user.id || (userRole === 'gardener' && existing.garden.ownerId === user.id);
        if (!canUpdate) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        const data = validateRequest(TaskUpdateSchema, req.body);
        const task = await prisma.task.update({
            where: { id },
            data: { ...data, dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined },
            include: { garden: { select: { id: true, name: true, address: true } }, user: { select: { id: true, name: true, email: true, avatarUrl: true } } }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ ...task, _id: task.id }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleTaskDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);
        await prisma.task.delete({ where: { id } });
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}
