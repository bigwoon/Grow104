import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../../lib/middleware';
import { successResponse, handleError } from '../../../lib/response';
import { getGardenerGarden } from '../../../lib/utils';
import prisma from '../../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);
        const {
            gardenId,
            title,
            content,
            type,
            activityType,
            description,
            hoursWorked,
            rating,
            visitDate,
            notes
        } = req.body;

        if (!title || !content || !type || !activityType) {
            return res.status(400).json(handleError(new Error('Missing required fields')));
        }

        // Auto-detect garden for gardeners if not provided
        let finalGardenId = gardenId;
        if (!finalGardenId && user.role === 'Gardener') {
            const garden = await getGardenerGarden(user.id);
            finalGardenId = garden.id;
        }

        // Create report
        const report = await prisma.report.create({
            data: {
                userId: user.id,
                gardenId: finalGardenId,
                title,
                content,
                type,
                activityType,
                description,
                hoursWorked: hoursWorked ? parseFloat(hoursWorked) : null,
                rating: rating ? parseInt(rating) : null,
                visitDate: visitDate ? new Date(visitDate) : null,
                notes
            },
            include: {
                user: {
                    select: {
                        id: true,
                        name: true,
                        avatarUrl: true,
                        role: true
                    }
                },
                garden: {
                    select: {
                        id: true,
                        name: true,
                        address: true
                    }
                }
            }
        });

        const origin = req.headers.origin;
        return res.status(201).json(successResponse(report, 'Report submitted successfully', origin));

    } catch (error: any) {
        console.error('Create report error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
