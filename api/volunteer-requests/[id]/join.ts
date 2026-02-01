import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate, AuthenticatedRequest } from '../../../lib/middleware';
import { successResponse, handleError } from '../../../lib/response';
import prisma from '../../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const user = authenticate(req as AuthenticatedRequest);
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
            return res.status(400).json(handleError(new Error('Request ID is required')));
        }

        // Get request details
        const request = await prisma.volunteerRequest.findUnique({
            where: { id },
            include: {
                garden: true,
                requester: {
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                }
            }
        });

        if (!request) {
            return res.status(404).json(handleError(new Error('Request not found')));
        }

        // TODO: Add volunteer to garden or create assignment record
        // For now, just return success

        const origin = req.headers.origin;
        return res.status(200).json(successResponse({
            success: true,
            request
        }, 'Successfully joined volunteer request', origin));

    } catch (error: any) {
        console.error('Join volunteer request error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
