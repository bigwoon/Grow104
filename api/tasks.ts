import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, requireGardenerOrAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError } from '../lib/response';
import { TaskCreateSchema, TaskUpdateSchema } from '../lib/validation';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { id } = req.query;
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method === 'GET') return handleList(req, res, origin);
    if (req.method === 'POST') return handleCreate(req, res, origin);
    if (req.method === 'PUT' && id && typeof id === 'string') return handleUpdate(req, res, origin, id);
    if (req.method === 'DELETE' && id && typeof id === 'string') return handleDelete(req, res, origin, id);

    return res.status(405).json({ error: 'Method not allowed' });
}

async function handleList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { userId, gardenId, status } = req.query;

        const where: any = {};

        // Admins can see all tasks, others only see their assigned tasks
        if (user.role !== 'Admin') {
            where.assignedTo = user.id;
        } else if (userId && typeof userId === 'string') {
            where.assignedTo = userId;
        }

        if (gardenId && typeof gardenId === 'string') {
            where.gardenId = gardenId;
        }

        if (status && typeof status === 'string') {
            where.status = status;
        }

        const tasks = await prisma.task.findMany({
            where,
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            },
            orderBy: [
                { status: 'asc' },
                { dueDate: 'asc' }
            ]
        });

        return res.status(200).json(successResponse(tasks, undefined, origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireGardenerOrAdmin(user);

        const validatedData = validateRequest(TaskCreateSchema, req.body);

        // If user is a Gardener, verify they have access to the garden
        if (user.role === 'Gardener') {
            const garden = await prisma.garden.findFirst({
                where: {
                    id: validatedData.gardenId,
                    OR: [
                        { ownerId: user.id },
                        { gardenGardeners: { some: { userId: user.id } } }
                    ]
                }
            });

            if (!garden) {
                return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
            }
        }

        const task = await prisma.task.create({
            data: {
                ...validatedData,
                dueDate: validatedData.dueDate ? new Date(validatedData.dueDate) : null
            },
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            }
        });

        // Create notification for assigned user
        if (task.assignedTo !== user.id) {
            await prisma.notification.create({
                data: {
                    userId: task.assignedTo,
                    title: 'New Task Assigned',
                    message: `You have been assigned a new task: ${task.title}`,
                    type: 'task'
                }
            });
        }

        return res.status(201).json(successResponse(task, 'Task created successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleUpdate(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);

        const existingTask = await prisma.task.findUnique({
            where: { id },
            include: { garden: true }
        });

        if (!existingTask) {
            return res.status(404).json(handleError(new Error('Task not found'), origin));
        }

        // Users can update their own tasks, Gardeners can update tasks in their gardens, Admins can update all
        const canUpdate =
            user.role === 'Admin' ||
            existingTask.assignedTo === user.id ||
            (user.role === 'Gardener' && existingTask.garden.ownerId === user.id);

        if (!canUpdate) {
            return res.status(403).json(handleError(new Error('INSUFFICIENT_PERMISSIONS'), origin));
        }

        const validatedData = validateRequest(TaskUpdateSchema, req.body);

        const task = await prisma.task.update({
            where: { id },
            data: {
                ...validatedData,
                dueDate: validatedData.dueDate !== undefined
                    ? (validatedData.dueDate ? new Date(validatedData.dueDate) : null)
                    : undefined
            },
            include: {
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                },
                user: {
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true
                    }
                }
            }
        });

        return res.status(200).json(successResponse(task, 'Task updated successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}

async function handleDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        await prisma.task.delete({
            where: { id }
        });

        return res.status(200).json(successResponse({ success: true }, 'Task deleted successfully', origin));
    } catch (error: any) {
        return res.status(500).json(handleError(error, origin));
    }
}
