import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, validateRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders } from '../lib/response';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';
import { ReportCreateSchema } from '../lib/validation';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (req.method === 'POST') {
        return handleCreateReport(req, res, origin);
    }

    if (req.method === 'GET') {
        return handleGetReports(req, res, origin);
    }

    setCorsHeaders(res, origin);
    return res.status(405).json(handleError(new Error('Method not allowed')).payload);
}

async function handleCreateReport(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const validatedData = validateRequest(ReportCreateSchema, req.body);

        const type = validatedData.type || 'visit';
        const title = validatedData.title || `${validatedData.activityType} Visit Report`;
        const content = validatedData.content || validatedData.description;

        // Validate type against allowed business logic types
        const validTypes = ['note', 'incident', 'observation', 'task', 'visit'];
        if (!validTypes.includes(type)) {
            setCorsHeaders(res, origin);
            return res.status(400).json(handleError(new Error(`Invalid type. Must be one of: ${validTypes.join(', ')}`)).payload);
        }

        const report = await prisma.report.create({
            data: {
                ...validatedData,
                title,
                content,
                type,
                userId: user.id, // Primary author/linked user
                visitDate: validatedData.visitDate ? new Date(validatedData.visitDate) : null,
                hoursWorked: validatedData.hoursWorked || null,
            },
            include: {
                user: {
                    select: { id: true, name: true, avatarUrl: true, role: true }
                }
            }
        });

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({
            ...report,
            _id: report.id,
            volunteer: report.user,
            volunteerName: report.user?.name || 'Unknown Volunteer'
        }, 'Report created successfully'));

    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleGetReports(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { gardenId, type, userId } = req.query;

        const where: any = {};
        if (gardenId && typeof gardenId === 'string') where.gardenId = gardenId;
        if (type && typeof type === 'string') where.type = type;
        if (userId && typeof userId === 'string') where.userId = userId;

        const reports = await prisma.report.findMany({
            where,
            include: {
                user: {
                    select: { id: true, name: true, avatarUrl: true, role: true }
                },
                garden: {
                    select: { id: true, name: true, address: true }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        setCorsHeaders(res, origin);
        // Map id to _id and add volunteer aliases for frontend compatibility
        const formattedReports = reports.map(r => ({
            ...r,
            _id: r.id,
            volunteer: r.user, // Frontend expects volunteer or volunteerName
            volunteerName: r.user?.name || 'Unknown Volunteer',
            gardenName: r.garden?.name || 'N/A'
        }));

        return res.status(200).json(successResponse(formattedReports));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}
