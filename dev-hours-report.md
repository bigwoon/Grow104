# Grow104 — Development Hours Report

**Project:** Grow104 Community Garden Platform  
**Developer:** Sowande Crews  
**Client:** Southside Community  
**Report Date:** April 14, 2026  
**Project Duration:** October 2025 — April 2026  

---

## Project Summary

Full-stack web application for managing community gardens in the Southside neighborhood. The platform supports role-based access for Admins, Gardeners, and Volunteers — including garden management, volunteer coordination, messaging, event scheduling, reporting, and an interactive map.

**Live URL:** https://www.grow104.org

---

## Technology Stack

| Layer | Technology |
|:---|:---|
| Frontend | React + TypeScript, Vite |
| Backend | Node.js, Vercel Serverless Functions |
| Database | NeonDB (PostgreSQL), Prisma ORM |
| File Storage | Cloudinary |
| Auth | JWT (Access + Refresh tokens), bcrypt |
| Hosting | Vercel |

---

## Development Hours Breakdown

**Rate:** $25.00/hr

| Phase | Description | Hours | Cost |
|:---|:---|---:|---:|
| Original Backend (Python/Lambda) | Authentication system, REST API endpoints, database schema design, CORS configuration, security hardening, query optimization | 40 | $1,000.00 |
| Repository Audit & Hardening | Full codebase scan, accessibility fixes, form validation, error boundaries, security review | 8 | $200.00 |
| Backend Rewrite (Node.js) | Complete migration from Python/AWS Lambda to Vercel + NeonDB + Prisma + TypeScript | 30 | $750.00 |
| Data Migration & Import | CSV parsing scripts, 2024 & 2025 home gardener data import, address geocoding, data integrity verification | 10 | $250.00 |
| Frontend Development | Admin dashboard, Gardener dashboard, Volunteer dashboard, interactive map view, messaging system, report submission, user management, profile pages, event registration | 50 | $1,250.00 |
| Ongoing Features & Bug Fixes | Task creation API, map sizing fixes, admin invitation link generator, API validation fixes, deployment troubleshooting | 12 | $300.00 |
| **Total** | | **150** | **$3,750.00** |

---

## Key Deliverables

### Authentication & User Management
- Secure signup/login with JWT token refresh
- Role-based access control (Admin, Gardener, Volunteer)
- Admin invitation system with token-based signup links
- User profile management with avatar uploads

### Garden Management
- Garden creation with automatic geocoding
- Gardener and volunteer assignment
- Garden inventory tracking (vegetables, supplies, seedlings)

### Communication
- Direct messaging between users
- Notification system
- Online status tracking

### Volunteer Coordination
- Volunteer request creation and management
- Volunteer assignment with automatic status updates
- Gardener service requests (supplies, seedlings, assistance)

### Events & Reporting
- Event creation with registration and capacity limits
- Visit reports with hours tracking and ratings
- Activity documentation

### Interactive Map
- Map view of all garden locations
- Geocoded addresses via OpenStreetMap/Nominatim

### Data Migration
- Import of 70+ home gardener records from 2024 spreadsheets
- Import of 2025 gardener cohort
- Address normalization and deduplication

### Deployment & Infrastructure
- Vercel serverless deployment pipeline
- NeonDB PostgreSQL cloud database
- Cloudinary image CDN integration
- Production CORS and security configuration

---

*Prepared by Sowande Crews — April 2026*
