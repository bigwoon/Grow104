import { z } from 'zod';

// ============================================
// NOTIFICATION SCHEMAS
// ============================================

export const NotificationCreateSchema = z.object({
    userId: z.string().uuid(),
    title: z.string().min(1).max(200),
    message: z.string().min(1).max(1000),
    type: z.enum(['event', 'message', 'request', 'system', 'invitation', 'task']),
});

export const NotificationUpdateSchema = z.object({
    isRead: z.boolean().optional(),
});

// ============================================
// TASK SCHEMAS
// ============================================

export const TaskCreateSchema = z.object({
    gardenId: z.string().uuid(),
    assignedTo: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    dueDate: z.string().datetime().optional(),
    status: z.enum(['pending', 'in-progress', 'completed']).default('pending'),
});

export const TaskUpdateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000).optional(),
    dueDate: z.string().datetime().optional().nullable(),
    status: z.enum(['pending', 'in-progress', 'completed']).optional(),
});

// ============================================
// GARDEN INVITATION SCHEMAS
// ============================================

export const GardenInvitationCreateSchema = z.object({
    gardenId: z.string().uuid(),
    userId: z.string().uuid(),
    role: z.enum(['Gardener', 'Volunteer']),
});

// ============================================
// INVENTORY SCHEMAS
// ============================================

export const SupplyCreateSchema = z.object({
    name: z.string().min(1).max(200),
    category: z.string().min(1).max(100),
    available: z.boolean().default(true),
});

export const SupplyUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(100).optional(),
    available: z.boolean().optional(),
});

export const SeedlingCreateSchema = z.object({
    name: z.string().min(1).max(200),
    season: z.enum(['spring', 'fall', 'both']),
    available: z.boolean().default(true),
});

export const SeedlingUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    season: z.enum(['spring', 'fall', 'both']).optional(),
    available: z.boolean().optional(),
});

// ============================================
// EVENT SCHEMAS
// ============================================

export const EventCreateSchema = z.object({
    title: z.string().min(1).max(200),
    type: z.enum(['harvest', 'planting', 'community']),
    description: z.string().min(1).max(2000),
    gardenId: z.string().uuid(),
    date: z.string().datetime(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
    location: z.string().max(500).optional(),
    maxParticipants: z.number().int().positive().optional(),
});

export const EventUpdateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    type: z.enum(['harvest', 'planting', 'community']).optional(),
    description: z.string().min(1).max(2000).optional(),
    date: z.string().datetime().optional(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    location: z.string().max(500).optional().nullable(),
    maxParticipants: z.number().int().positive().optional().nullable(),
});

// ============================================
// MESSAGE SCHEMAS
// ============================================

export const MessageCreateSchema = z.object({
    toUserId: z.string().uuid(),
    subject: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    requestType: z.string().max(100).optional(),
});

// ============================================
// REPORT SCHEMAS
// ============================================

export const ReportCreateSchema = z.object({
    gardenId: z.string().uuid().optional(),
    title: z.string().min(1).max(200),
    content: z.string().min(1).max(5000),
    type: z.string().min(1).max(100),
    activityType: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    hoursWorked: z.number().positive().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    visitDate: z.string().datetime().optional(),
    notes: z.string().max(2000).optional(),
});

// ============================================
// VOLUNTEER REQUEST SCHEMAS
// ============================================

export const VolunteerRequestCreateSchema = z.object({
    gardenId: z.string().uuid(),
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    date: z.string().datetime(),
    status: z.enum(['open', 'filled', 'cancelled']).default('open'),
});

export const VolunteerRequestUpdateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000).optional(),
    date: z.string().datetime().optional(),
    status: z.enum(['open', 'filled', 'cancelled']).optional(),
});

// ============================================
// GARDENER REQUEST SCHEMAS
// ============================================

export const GardenerRequestCreateSchema = z.object({
    title: z.string().min(1).max(200),
    description: z.string().min(1).max(2000),
    requestType: z.enum(['supplies', 'seedlings', 'food-utility', 'volunteer-help']),
    status: z.enum(['pending', 'approved', 'rejected', 'completed']).default('pending'),

    // Supplies
    supplyIds: z.array(z.string().uuid()).optional(),

    // Seedlings
    seedlingIds: z.array(z.string().uuid()).optional(),
    season: z.enum(['spring', 'fall', 'both']).optional(),
    quantity: z.number().int().positive().optional(),

    // Food/Utility
    assistanceType: z.string().max(100).optional(),
    householdSize: z.number().int().positive().optional(),

    // Volunteer Help
    task: z.string().max(500).optional(),

    notes: z.string().max(2000).optional(),
});

export const GardenerRequestUpdateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).optional(),
    requestType: z.enum(['supplies', 'seedlings', 'food-utility', 'volunteer-help']).optional(),
    supplyIds: z.array(z.string()).optional(),
    seedlingIds: z.array(z.string()).optional(),
    season: z.string().optional(),
    quantity: z.number().int().positive().optional(),
    assistanceType: z.string().optional(),
    householdSize: z.number().int().positive().optional(),
    task: z.string().optional(),
    notes: z.string().optional(),
    status: z.enum(['pending', 'approved', 'rejected', 'completed']).optional()
});

// ============================================
// VALIDATION HELPER
// ============================================

export type ValidationError = {
    field: string;
    message: string;
};

export const formatZodError = (error: z.ZodError): ValidationError[] => {
    return error.issues.map((err) => ({
        field: err.path.join('.'),
        message: err.message,
    }));
};
