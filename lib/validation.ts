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
// GARDEN SCHEMAS
// ============================================

export const GardenCreateSchema = z.object({
    name: z.string().min(1).max(200),
    address: z.string().min(1).max(500),
    zipcode: z.string().regex(/^\d{5}$/, 'Invalid zipcode format'),
    description: z.string().max(2000).optional(),
    plotSize: z.string().max(100).optional(),
    sunlight: z.enum(['full', 'partial', 'shade']).optional(),
});

export const GardenUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    address: z.string().min(1).max(500).optional(),
    zipcode: z.string().regex(/^\d{5}$/, 'Invalid zipcode format').optional(),
    description: z.string().max(2000).optional().nullable(),
    plotSize: z.string().max(100).optional().nullable(),
    sunlight: z.enum(['full', 'partial', 'shade']).optional().nullable(),
    status: z.enum(['active', 'planning', 'maintenance']).optional(),
});

// ============================================
// INVENTORY SCHEMAS
// ============================================

export const SupplyCreateSchema = z.object({
    name: z.string().min(1).max(200),
    category: z.string().min(1).max(100).optional().default('Other'),
    description: z.string().max(2000).optional(),
    quantity: z.number().int().nonnegative().optional(),
    unit: z.string().max(50).optional(),
    available: z.boolean().default(true),
});

export const SupplyUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    category: z.string().min(1).max(100).optional(),
    description: z.string().max(2000).optional().nullable(),
    quantity: z.number().int().nonnegative().optional().nullable(),
    unit: z.string().max(50).optional().nullable(),
    available: z.boolean().optional(),
});

export const SeedlingCreateSchema = z.object({
    name: z.string().min(1).max(200),
    description: z.string().max(2000).optional(),
    season: z.enum(['spring', 'fall', 'both']),
    available: z.boolean().default(true),
});

export const SeedlingUpdateSchema = z.object({
    name: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional().nullable(),
    season: z.enum(['spring', 'fall', 'both']).optional(),
    available: z.boolean().optional(),
});

// ============================================
// EVENT SCHEMAS
// ============================================

export const EventCreateSchema = z.object({
    title: z.string().min(1).max(200),
    type: z.enum(['harvest', 'planting', 'community', 'workshop', 'cleanup', 'social', 'training']),
    description: z.string().max(2000).optional(),
    gardenId: z.string().uuid(),
    date: z.string().datetime(),
    time: z.string().optional(),
    startTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    endTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    location: z.string().max(500).optional(),
    maxParticipants: z.number().int().positive().optional(),
});

export const EventUpdateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    type: z.enum(['harvest', 'planting', 'community', 'workshop', 'cleanup', 'social', 'training']).optional(),
    description: z.string().max(2000).optional(),
    date: z.string().datetime().optional(),
    time: z.string().optional(),
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
    subject: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(5000),
    requestType: z.string().max(100).optional(),
});

// ============================================
// REPORT SCHEMAS
// ============================================

export const ReportCreateSchema = z.object({
    gardenId: z.string().uuid().optional(),
    title: z.string().min(1).max(200).optional(),
    content: z.string().min(1).max(5000).optional(),
    type: z.string().min(1).max(100).optional(),
    activityType: z.string().min(1).max(100),
    description: z.string().min(1).max(2000),
    hoursWorked: z.number().positive().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    visitDate: z.string().optional(),
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
    time: z.string().max(100).optional(),
    location: z.string().max(500).optional(),
    task: z.string().max(500).optional(),
    maxVolunteers: z.number().int().positive().default(1),
    skills: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high']).default('medium'),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).default('open'),
});

export const VolunteerRequestUpdateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().min(1).max(2000).optional(),
    date: z.string().datetime().optional(),
    time: z.string().max(100).optional().nullable(),
    location: z.string().max(500).optional().nullable(),
    task: z.string().max(500).optional().nullable(),
    maxVolunteers: z.number().int().positive().optional(),
    skills: z.array(z.string()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
});

// ============================================
// GARDENER REQUEST SCHEMAS
// ============================================

export const GardenerRequestCreateSchema = z.object({
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(2000).optional(),
    requestType: z.enum(['supplies', 'seedlings', 'food-utility', 'volunteer-help']).optional(), // Optional to allow inference
    status: z.enum(['pending', 'approved', 'rejected', 'completed']).default('pending'),

    // Supplies
    supplyIds: z.array(z.string()).optional(), // Relaxed to allow names
    items: z.array(z.string()).optional(), // Alias for supplyIds from frontend

    // Seedlings
    // Relaxed validation to allow vegetable names (strings) instead of just UUIDs
    // Frontend sends names like "Carrots", "Beans" etc.
    seedlingIds: z.array(z.string()).optional(),
    vegetables: z.array(z.string()).optional(), // Alias for seedlingIds from frontend
    season: z.enum(['spring', 'fall', 'both']).optional(),
    quantity: z.number().int().positive().optional(),

    // Food/Utility
    assistanceType: z.string().max(100).optional(),
    householdSize: z.number().int().positive().optional(),
    details: z.string().max(2000).optional(), // Alias for notes/description from frontend

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

// ============================================
// ONBOARDING INVITATION SCHEMAS
// ============================================

export const InvitationCreateSchema = z.object({
    email: z.string().email().transform(v => v.toLowerCase()),
    role: z.enum(['Admin', 'Gardener', 'Volunteer']),
    message: z.string().max(500).optional(),
});
