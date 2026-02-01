import prisma from './prisma';

/**
 * Get gardener's assigned garden
 * Used for auto-detecting gardenId when gardeners create requests
 * @throws Error if gardener is not assigned to any garden
 */
export const getGardenerGarden = async (userId: string) => {
    const assignment = await prisma.gardenGardener.findFirst({
        where: { userId },
        include: { garden: true }
    });

    if (!assignment) {
        throw new Error('NO_GARDEN_ASSIGNMENT');
    }

    return assignment.garden;
};

/**
 * Check if user is assigned to a garden (as gardener or volunteer)
 */
export const isAssignedToGarden = async (userId: string, gardenId: string): Promise<boolean> => {
    const gardenerAssignment = await prisma.gardenGardener.findFirst({
        where: { userId, gardenId }
    });

    const volunteerAssignment = await prisma.gardenVolunteer.findFirst({
        where: { userId, gardenId }
    });

    return !!(gardenerAssignment || volunteerAssignment);
};

/**
 * Get all gardens assigned to a volunteer
 */
export const getVolunteerGardens = async (userId: string) => {
    const assignments = await prisma.gardenVolunteer.findMany({
        where: { userId },
        include: {
            garden: {
                include: {
                    gardenGardeners: {
                        include: {
                            user: {
                                select: {
                                    id: true,
                                    name: true,
                                    email: true,
                                    avatarUrl: true,
                                    growing: true
                                }
                            }
                        }
                    }
                }
            }
        }
    });

    return assignments.map(a => a.garden);
};

/**
 * Create notification for user(s)
 */
export const createNotification = async (
    userId: string | string[],
    title: string,
    message: string,
    type: string
) => {
    const userIds = Array.isArray(userId) ? userId : [userId];

    await prisma.notification.createMany({
        data: userIds.map(id => ({
            userId: id,
            title,
            message,
            type
        }))
    });
};

/**
 * Get all admin user IDs
 */
export const getAdminIds = async (): Promise<string[]> => {
    const admins = await prisma.user.findMany({
        where: { role: 'Admin', isActive: true },
        select: { id: true }
    });

    return admins.map(a => a.id);
};
