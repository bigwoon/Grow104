# Backend Business Logic Overview

This document provides a technical overview of the core business logic implemented in the Grow104 backend.

## 1. Core Domains & Logic

### Identity & Access Management (IAM)
- **Role-Based Access Control (RBAC)**: Supports `Admin`, `Gardener`, and `Volunteer` roles.
- **Invitations**: 
    - Admins can invite any role. 
    - Volunteers and Gardeners can invite peers of their own role.
    - Logic: Generates a signed, expiring token linked to a specific role.
- **Security**: Uses bcrypt hashing for passwords and dual-token JWT (Access + Refresh) for session management.

### Garden Ecosystem
- **Entity Linking**: The `Garden` record acts as the central hub for all other data.
- **Onboarding**: For users signing up as `Gardener`, the backend automatically initializes a `Garden` record and links it to the user.
- **Assignment Logic**: Managed via many-to-many relationship tables (`GardenGardener`, `GardenVolunteer`).

### Request & Support System
The backend implements three distinct request flows:
1. **Gardener Service Requests**: 
    - **Supplies**: Tools and hardware needs.
    - **Seedlings**: Seasonal plant requests (mapped to fall/spring).
    - **Assistance**: Social support requests (Food/Utility).
### Volunteer Requests & Assignments
- **Entity Linking**: Volunteers join requests through a `VolunteerAssignment` many-to-many relationship.
- **Interactive Fields**: Requests support `time`, `location`, `task requirements`, and `priority` (low, medium, high).
- **Status Lifecycle**:
    - `open`: Request is created and has available slots.
    - `in_progress`: Automatically set when `maxVolunteers` is reached.
    - `completed`: Set by Admin or Gardener after work is done.
    - `cancelled`: Set by Admin or Gardener if no longer needed.
- **Rules**:
    - Users can `join` and `leave` requests dynamically.
    - Requests automatically reopen (reset to `open`) if a user leaves and slots become available.
    - ID aliasing: All responses map internal `id` to `_id` for frontend consistency.

### Reporting & Documentation
- **Activity Reports**: Logic for tracking "quantitative" work (hours) and "qualitative" notes.
- **Gardener Performance**: Volunteers rate gardeners during visits, which updates the gardener's internal status.

### Event Management
- **Workshops/Community Days**: Logic includes `maxParticipants` caps and user registration tracking.
- **Auto-Notification**: Logic to notify everyone assigned to a garden when an event is created for that specific location.

## 2. Technical Implementation Patterns

### Standardized Response Format
The backend uses a standard `successResponse` and `handleError` pattern to ensure the frontend always receives predictable JSON shapes:
```json
{
  "success": true,
  "data": { ... },
  "message": "Success message"
}
```

### Data Validation
All incoming requests are validated using **Zod schemas** BEFORE reaching the Prisma layer, ensuring data integrity at the API boundary.

### Geocoding
Garden addresses are automatically geocoded (Latitude/Longitude) during creation to support the frontend Map View.

### Bulk Operations
A migration script (`upload-gardeners.ts`) handles CSV parsing with specialized logic for:
- Detecting gardeners with missing emails.
- Random password generation.
- Initial gardener request creation from CSV "needs" columns.

## 3. UI/UX Logic Alignment Rules

To ensure seamless integration with the frontend, the following rules MUST be followed:
1. **Status Casing**: All statuses in API responses must be **lowercase snake_case** (e.g., `in_progress`). This matches the frontend's color-coding and filtering logic.
2. **ID Mapping**: All resources must include an `_id` field in the response (aliased from `id`).
3. **GeoJSON**: Garden coordinates must be mapped to a GeoJSON-compatible structure for map rendering.
4. **Dynamic Actions**: Interactive actions (join, register, etc.) should use RESTful path patterns (e.g., `/api/requests/:id/join`) via Vercel rewrites.
