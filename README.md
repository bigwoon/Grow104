# SS Garden App Backend

Backend API for SS Garden App built with Vercel + NeonDB + Cloudinary.

## Tech Stack

- **Platform:** Vercel Serverless Functions
- **Database:** NeonDB (PostgreSQL)
- **ORM:** Prisma
- **Language:** TypeScript
- **File Storage:** Cloudinary
- **Authentication:** JWT

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment Variables

Create `.env.local` file:

```bash
cp .env.example .env.local
```

Fill in your credentials:
- `DATABASE_URL` - NeonDB connection string
- `JWT_SECRET` - Random secret for JWT tokens
- `JWT_REFRESH_SECRET` - Random secret for refresh tokens
- `CLOUDINARY_*` - Cloudinary credentials
- `GOOGLE_MAPS_API_KEY` - Google Maps API key for geocoding

### 3. Setup Database

```bash
# Generate Prisma Client
npm run prisma:generate

# Run migrations
npm run prisma:migrate

# (Optional) Open Prisma Studio to view database
npm run prisma:studio
```

### 4. Run Development Server

```bash
npm run dev
```

API will be available at `http://localhost:3000/api`

### 5. Deploy to Vercel

```bash
# Login to Vercel
vercel login

# Deploy
npm run deploy
```

## Project Structure

```
├── api/                  # API endpoints (Vercel serverless functions)
├── lib/                  # Shared utilities
│   ├── prisma.ts        # Prisma client
│   ├── middleware.ts    # Authentication
│   ├── response.ts      # Response wrappers
│   ├── geocode.ts       # Geocoding
│   ├── cloudinary.ts    # Image upload
│   └── utils.ts         # Helper functions
├── prisma/
│   └── schema.prisma    # Database schema
├── vercel.json          # Vercel configuration
└── package.json         # Dependencies
```

## API Endpoints

### Authentication
- `POST /api/auth/signup` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Get current user
- `POST /api/auth/heartbeat` - Update online status

### Users
- `GET /api/users` - List users
- `GET /api/users/:id` - Get user by ID
- `PUT /api/users/profile` - Update profile
- `POST /api/users/avatar` - Upload avatar
- `GET /api/users/online` - Get online users

### Gardens
- `GET /api/gardens` - List gardens
- `POST /api/gardens` - Create garden
- `GET /api/gardens/:id` - Get garden
- `POST /api/gardens/:id/assign-gardener` - Assign gardener
- `POST /api/gardens/:id/assign-volunteer` - Assign volunteer

### Messages
- `GET /api/messages` - List messages
- `POST /api/messages` - Send message
- `GET /api/messages/conversation/:userId` - Get conversation
- `PUT /api/messages/:id/read` - Mark as read

### Reports
- `GET /api/reports` - List reports
- `POST /api/reports` - Submit report

### Events
- `GET /api/events` - List events
- `POST /api/events` - Create event
- `POST /api/events/:id/register` - Register for event

### Requests
- `GET /api/volunteer-requests` - List volunteer requests
- `POST /api/volunteer-requests` - Create request
- `GET /api/gardener-requests` - List gardener requests
- `POST /api/gardener-requests/supplies` - Request supplies
- `POST /api/gardener-requests/seedlings` - Request seedlings

### Inventory
- `GET /api/inventory/supplies` - List supplies
- `POST /api/inventory/supplies` - Add supply (admin)
- `GET /api/inventory/seedlings` - List seedlings
- `POST /api/inventory/seedlings` - Add seedling (admin)

### Invitations
- `POST /api/invitations` - Send invitation (admin)
- `GET /api/invitations/token/:token` - Validate token

### Map
- `GET /api/map-data` - Get map markers

## Development

### Adding New Endpoint

1. Create file in `api/` folder
2. Export default async function
3. Use utilities from `lib/`

Example:

```typescript
import { VercelRequest, VercelResponse } from '@vercel/node';
import { authenticate } from '../../lib/middleware';
import { successResponse, handleError } from '../../lib/response';
import prisma from '../../lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const user = authenticate(req);
    
    // Your logic here
    const data = await prisma.model.findMany();
    
    return res.status(200).json(successResponse(data));
  } catch (error) {
    return res.status(500).json(handleError(error));
  }
}
```

### Database Changes

```bash
# Make changes to prisma/schema.prisma

# Create migration
npm run prisma:migrate

# Generate Prisma Client
npm run prisma:generate
```

## License

ISC
