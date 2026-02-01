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
            return res.status(400).json(handleError(new Error('Event ID is required')));
        }

        // Delete registration
        await prisma.eventRegistration.delete({
            where: {
                eventId_userId: {
                    eventId: id,
                    userId: user.id
                }
            }
        });

        const origin = req.headers.origin;
        return res.status(200).json(successResponse({ success: true }, 'Registration cancelled successfully', origin));

    } catch (error: any) {
        console.error('Unregister from event error:', error);
        const origin = req.headers.origin;
        return res.status(500).json(handleError(error, origin));
    }
}
