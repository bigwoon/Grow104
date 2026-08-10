import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest, requireAdmin, validateRequest } from '../lib/middleware';
import { successResponse, handleError, setCorsHeaders } from '../lib/response';
import {
    SupplyCreateSchema,
    SupplyUpdateSchema,
    SeedlingCreateSchema,
    SeedlingUpdateSchema,
    ReportCreateSchema
} from '../lib/validation';
import { getGardenerGarden } from '../lib/utils';
import prisma from '../lib/prisma';
import { handleCorsPreflightRequest } from '../lib/cors';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    let { type, id } = req.query;
    const origin = req.headers.origin;

    // Normalize type to handle malformed query strings from frontend (e.g. ?type=supplies?search=...)
    if (typeof type === 'string' && type.includes('?')) {
        type = type.split('?')[0];
    }

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return handleCorsPreflightRequest(req, res, origin);
    }

    if (type === 'supplies' || type === 'seedlings') {
        if (req.method === 'GET') return handleInventoryList(req, res, type, origin);
        if (req.method === 'POST') return handleInventoryCreate(req, res, type, origin);
        if (req.method === 'PUT' && id && typeof id === 'string') return handleInventoryUpdate(req, res, type, id, origin);
        if (req.method === 'DELETE' && id && typeof id === 'string') return handleInventoryDelete(req, res, type, id, origin);
    }

    if (type === 'reports') {
        if (req.method === 'GET') {
            if (id && typeof id === 'string') return handleReportGetSingle(req, res, id, origin);
            return handleReportList(req, res, origin);
        }
        if (req.method === 'POST') return handleReportCreate(req, res, origin);
        if (req.method === 'DELETE' && id && typeof id === 'string') return handleReportDelete(req, res, id, origin);
    }

    setCorsHeaders(res, origin);
    return res.status(400).json(handleError(new Error('Invalid type. Use supplies, seedlings, or reports')).payload);
}

// ============================================
// INVENTORY HANDLERS (SUPPLIES & SEEDLINGS)
// ============================================

async function handleInventoryList(req: VercelRequest, res: VercelResponse, type: string, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { category, season, available } = req.query;
        const where: any = {};
        if (available !== undefined) where.available = available === 'true';

        let items;
        if (type === 'supplies') {
            if (category && typeof category === 'string') where.category = category;
            items = await prisma.supplyItem.findMany({
                where,
                include: { creator: { select: { id: true, name: true } } },
                orderBy: [{ available: 'desc' }, { name: 'asc' }]
            });
        } else {
            if (season && typeof season === 'string') where.OR = [{ season }, { season: 'both' }];
            items = await prisma.seedlingItem.findMany({
                where,
                include: { creator: { select: { id: true, name: true } } },
                orderBy: [{ available: 'desc' }, { name: 'asc' }]
            });
        }

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(items.map(i => ({ ...i, _id: i.id }))));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleInventoryCreate(req: VercelRequest, res: VercelResponse, type: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        if (type === 'supplies') {
            const data = validateRequest(SupplyCreateSchema, req.body);
            const item = await prisma.supplyItem.create({
                data: { ...data, createdBy: user.id },
                include: { creator: { select: { id: true, name: true } } }
            });
            setCorsHeaders(res, origin);
            return res.status(201).json(successResponse({ ...item, _id: item.id }));
        } else {
            const data = validateRequest(SeedlingCreateSchema, req.body);
            const item = await prisma.seedlingItem.create({
                data: { ...data, createdBy: user.id },
                include: { creator: { select: { id: true, name: true } } }
            });
            setCorsHeaders(res, origin);
            return res.status(201).json(successResponse({ ...item, _id: item.id }));
        }
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleInventoryUpdate(req: VercelRequest, res: VercelResponse, type: string, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);

        if (type === 'supplies') {
            const data = validateRequest(SupplyUpdateSchema, req.body);
            const item = await prisma.supplyItem.update({
                where: { id },
                data,
                include: { creator: { select: { id: true, name: true } } }
            });
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ ...item, _id: item.id }));
        } else {
            const data = validateRequest(SeedlingUpdateSchema, req.body);
            const item = await prisma.seedlingItem.update({
                where: { id },
                data,
                include: { creator: { select: { id: true, name: true } } }
            });
            setCorsHeaders(res, origin);
            return res.status(200).json(successResponse({ ...item, _id: item.id }));
        }
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleInventoryDelete(req: VercelRequest, res: VercelResponse, type: string, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);
        if (type === 'supplies') await prisma.supplyItem.delete({ where: { id } });
        else await prisma.seedlingItem.delete({ where: { id } });
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

// ============================================
// REPORT HANDLERS
// ============================================

async function handleReportList(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const { gardenId, userId, type } = req.query;
        const where: any = {};
        if (gardenId && typeof gardenId === 'string') where.gardenId = gardenId;
        if (userId && typeof userId === 'string') where.userId = userId;
        if (type && typeof type === 'string') where.type = type;

        const reports = await prisma.report.findMany({
            where,
            include: {
                user: { select: { id: true, name: true, avatarUrl: true, role: true } },
                garden: { select: { id: true, name: true, address: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse(reports.map(r => ({
            ...r,
            _id: r.id,
            volunteer: r.user,
            volunteerName: r.user?.name || 'Unknown Volunteer',
            gardenName: r.garden?.name || 'N/A'
        }))));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleReportGetSingle(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        authenticate(req as AuthenticatedRequest);
        const report = await prisma.report.findUnique({
            where: { id },
            include: {
                user: { select: { id: true, name: true, avatarUrl: true, role: true } },
                garden: { select: { id: true, name: true, address: true } }
            }
        });

        if (!report) {
            setCorsHeaders(res, origin);
            return res.status(404).json(handleError(new Error('Report not found')).payload);
        }

        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({
            ...report,
            _id: report.id,
            volunteer: report.user,
            volunteerName: report.user?.name || 'Unknown Volunteer',
            gardenName: report.garden?.name || 'N/A'
        }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleReportCreate(req: VercelRequest, res: VercelResponse, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        const data = validateRequest(ReportCreateSchema, req.body);
        let gId = data.gardenId || ((user.role || '').toLowerCase() === 'gardener' ? (await getGardenerGarden(user.id))?.id : null);

        const title = data.title || `${data.activityType} Visit Report`;
        const content = data.content || data.description;
        const type = data.type || 'visit';

        const report = await prisma.report.create({
            data: {
                userId: user.id, gardenId: gId, title, content,
                type, activityType: data.activityType, description: data.description,
                hoursWorked: data.hoursWorked || null, rating: data.rating || null,
                visitDate: data.visitDate ? new Date(data.visitDate) : null, notes: data.notes || null
            },
            include: {
                user: { select: { id: true, name: true, avatarUrl: true, role: true } },
                garden: { select: { id: true, name: true, address: true } }
            }
        });

        setCorsHeaders(res, origin);
        return res.status(201).json(successResponse({ ...report, _id: report.id }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}

async function handleReportDelete(req: VercelRequest, res: VercelResponse, id: string, origin?: string) {
    try {
        const user = authenticate(req as AuthenticatedRequest);
        requireAdmin(user);
        await prisma.report.delete({ where: { id } });
        setCorsHeaders(res, origin);
        return res.status(200).json(successResponse({ success: true }));
    } catch (error: any) {
        setCorsHeaders(res, origin);
        const { status, payload } = handleError(error);
        return res.status(status).json(payload);
    }
}
