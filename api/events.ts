import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders } from '../lib/response';
import { EventCreateSchema, EventUpdateSchema } from '../lib/validation';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id, action } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'POST') {
        if (action === 'register' && id && typeof id === 'string') return handleRegister(req, res, id, origin);
        if (action === 'unregister' && id && typeof id === 'string') return handleUnregister(req, res, id, origin);
        if (action === 'task-status') return handleTaskStatus(req, res, origin);
        return handleCreate(req, res, origin);
    }
    if ((req.method === 'PUT' || req.method === 'PATCH') && id && typeof id === 'string') {
        if (action === 'task-status') return handleTaskStatus(req, res, origin);
        return handleUpdate(req, res, id, origin);
    }
    if (req.method === 'DELETE' && id && typeof id === 'string') return handleDelete(req, res, id, origin);

    setCorsHeaders(res, origin);
    return res.status(405).json(handleError(new Error('Method not allowed')).payload);
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { gardenId, type, all } = req.query;

        // Admins can pass ?all=true to see past events too (for management purposes)
        const isAdmin = (user.role || '').toLowerCase() === 'admin';
        const showAll = isAdmin && all === 'true';

        const where: any = showAll
            ? {} // no date filter — return all events
            : { date: { gte: new Date() } }; // default: future only

        if (gardenId && typeof gardenId === 'string') {
            where.gardenId = gardenId;
        }
        if (type && typeof type === 'string') {
            where.type = type;
        }

        const events = await prisma.event.findMany({
            where,
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                },
                registrations: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                                avatarUrl: true
                            }
                        }
                    }
                },
                tasks: {
                    include: {
                        assignedUser: {
                            select: {
                                id: true,
                                name: true,
                                avatarUrl: true
                            }
                        }
                    },
                    orderBy: { createdAt: 'asc' }
                },
                _count: {
                    select: {
                        registrations: true
                    }
                }
            },
            orderBy: { date: showAll ? 'desc' : 'asc' }
        });

        const transformedEvents = events.map(e => ({
            ...e,
            _id: e.id,
            time: e.startTime || undefined,
            garden: e.garden ? { ...e.garden, _id: e.garden.id } : null,
            registrations: e.registrations?.map(r => ({ ...r, _id: r.id })),
            tasks: e.tasks?.map(t => ({ ...t, _id: t.id }))
        }));

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(transformedEvents));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        if ((user.role || '').toLowerCase() === 'volunteer') {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }
        const validatedData = validateRequest(EventCreateSchema, req.body);

        // Map frontend `time` → startTime if not explicitly provided
        const startTime = validatedData.startTime || (validatedData as any).time || '00:00';
        const endTime = validatedData.endTime || startTime;
        const description = validatedData.description || '';

        const event = await prisma.event.create({
            data: {
                title: validatedData.title,
                type: validatedData.type,
                description,
                gardenId: validatedData.gardenId,
                date: new Date(validatedData.date || Date.now()),
                startTime,
                endTime,
                location: validatedData.location || null,
                maxParticipants: validatedData.maxParticipants || null,
                createdBy: user.id,
                requestId: validatedData.requestId || null,
                ...(validatedData.tasks && validatedData.tasks.length > 0 ? {
                    tasks: {
                        create: validatedData.tasks.map(t => ({
                            title: t.title,
                            description: t.description || null,
                            assignedTo: t.assignedTo || null,
                            status: t.status || 'pending'
                        }))
                    }
                } : {})
            },
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                creator: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                },
                tasks: {
                    include: {
                        assignedUser: {
                            select: {
                                id: true,
                                name: true,
                                avatarUrl: true
                            }
                        }
                    }
                }
            }
        });

        const gardenUsers = await prisma.$transaction([
            prisma.gardenGardener.findMany({ where: { gardenId: event.gardenId }, select: { userId: true } }),
            prisma.gardenVolunteer.findMany({ where: { gardenId: event.gardenId }, select: { userId: true } })
        ]);

        const notifyIds = [...new Set([
            ...gardenUsers[0].map(g => g.userId),
            ...gardenUsers[1].map(v => v.userId)
        ])].filter(id => id !== user.id);

        if (notifyIds.length > 0) {
            await prisma.notification.createMany({
                data: notifyIds.map(id => ({
                    userId: id,
                    title: 'New Garden Event',
                    message: `A new ${event.type} event "${event.title}" has been created for ${event.garden.name}`,
                    type: 'event'
                }))
            });
        }

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({
            ...event,
            _id: event.id,
            time: event.startTime || undefined
        }, 'Event created successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleRegister(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const event = await prisma.event.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { registrations: true }
                }
            }
        });

        if (!event) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Event not found')).payload);
        }

        if (event.maxParticipants && event._count.registrations >= event.maxParticipants) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Event is full')).payload);
        }

        const existing = await prisma.eventRegistration.findUnique({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId: user.id
                }
            }
        });

        if (existing) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Already registered for this event')).payload);
        }

        const registration = await prisma.eventRegistration.create({
            data: {
                eventId: id,
                userId: user.id,
                status: 'registered'
            },
            include: {
                event: {
                    include: {
                        garden: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true
                    }
                }
            }
        });

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({
            ...registration,
            _id: registration.id
        }, 'Successfully registered for event'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleUnregister(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        await prisma.eventRegistration.delete({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId: user.id
                }
            }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Registration cancelled successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleUpdate(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const existingEvent = await prisma.event.findUnique({
            where: { id }
        });

        if (!existingEvent) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Event not found')).payload);
        }

        // Only admin or event creator can update
        if ((user.role || '').toLowerCase() !== 'admin' && existingEvent.createdBy !== user.id) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        const validatedData = validateRequest(EventUpdateSchema, req.body);

        // Map frontend `time` → startTime if provided
        const updateStartTime = validatedData.startTime || (validatedData as any).time;
        const { startTime: _s, endTime: _e, time: _t, ...restUpdate } = validatedData as any;

        const event = await prisma.event.update({
            where: { id },
            data: {
                ...restUpdate,
                date: validatedData.date ? new Date(validatedData.date) : undefined,
                maxParticipants: validatedData.maxParticipants !== undefined ? validatedData.maxParticipants : undefined,
                ...(updateStartTime ? { startTime: updateStartTime } : {}),
                ...(validatedData.endTime ? { endTime: validatedData.endTime } : {}),
                ...(validatedData.requestId !== undefined ? { requestId: validatedData.requestId } : {}),
            },
            include: {
                garden: { select: { id: true, name: true, address: true } },
                creator: { select: { id: true, name: true, avatarUrl: true } },
                registrations: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
                tasks: { include: { assignedUser: { select: { id: true, name: true, avatarUrl: true } } } }
            }
        });

        // If tasks array was supplied on update, sync tasks
        if (validatedData.tasks) {
            await prisma.eventTask.deleteMany({ where: { eventId: id } });
            if (validatedData.tasks.length > 0) {
                await prisma.eventTask.createMany({
                    data: validatedData.tasks.map(t => ({
                        eventId: id,
                        title: t.title,
                        description: t.description || null,
                        assignedTo: t.assignedTo || null,
                        status: t.status || 'pending'
                    }))
                });
            }
        }

        const updatedEventWithTasks = await prisma.event.findUnique({
            where: { id },
            include: {
                garden: { select: { id: true, name: true, address: true } },
                creator: { select: { id: true, name: true, avatarUrl: true } },
                registrations: { include: { user: { select: { id: true, name: true, avatarUrl: true } } } },
                tasks: { include: { assignedUser: { select: { id: true, name: true, avatarUrl: true } } } }
            }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            ...(updatedEventWithTasks || event),
            _id: event.id,
            time: event.startTime || undefined,
            tasks: (updatedEventWithTasks || event).tasks?.map(t => ({ ...t, _id: t.id }))
        }, 'Event updated successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const existingEvent = await prisma.event.findUnique({
            where: { id }
        });

        if (!existingEvent) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Event not found')).payload);
        }

        // Only admin or event creator can delete
        if ((user.role || '').toLowerCase() !== 'admin' && existingEvent.createdBy !== user.id) {
            setCorsHeaders(res, origin);
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS')).payload);
        }

        await prisma.event.delete({
            where: { id }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }, 'Event deleted successfully'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleTaskStatus(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { taskId, status } = req.body;

        if (!taskId || !status || !['pending', 'in_progress', 'completed'].includes(status)) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error('Invalid taskId or status')).payload);
        }

        const task = await prisma.eventTask.update({
            where: { id: taskId },
            data: { status }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ ...task, _id: task.id }, 'Task status updated'));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}
