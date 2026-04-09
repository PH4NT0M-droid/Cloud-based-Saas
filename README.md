# Cloud-Based SaaS OTA Channel Manager

Production-oriented OTA Channel Manager platform for hotels and homestays.

## Step 1 Implemented

- Node.js + Express backend scaffold
- Prisma + PostgreSQL setup
- JWT authentication (Admin, Owner, Staff)
- Register/Login endpoints
- Validation and centralized error handling
- Jest tests for auth flows
- Docker and docker-compose for local runtime

## Step 2 Implemented

- Property management module with CRUD APIs
- Room type management module with CRUD APIs
- Role-based access control for Owner/Admin writes and Staff read-only access
- Prisma relations: User -> Properties -> RoomTypes
- Express-validator based request validation
- Jest tests for property and room modules

### Step 2 APIs

- POST /api/properties
- GET /api/properties
- GET /api/properties/:id
- PUT /api/properties/:id
- DELETE /api/properties/:id
- POST /api/rooms
- GET /api/rooms?propertyId=
- PUT /api/rooms/:id
- DELETE /api/rooms/:id

## Step 3 Implemented

- Calendar-based inventory management per room type and date
- Single-day upsert endpoint
- Transaction-based bulk date-range update endpoint
- Inventory calendar retrieval with ascending date sort
- Role-based access: ADMIN/OWNER write, STAFF read-only
- Future booking integration helper: reduceInventory(roomTypeId, startDate, endDate)

### Step 3 APIs

- POST /api/inventory/update
- POST /api/inventory/bulk-update
- GET /api/inventory/calendar?roomTypeId=&startDate=&endDate=

## Step 4 Readiness

- Inventory reduction helper is in place for booking flow integration.
- Backend module structure is ready to add pricing engine files (rates model, services, and APIs) in the next phase.

## Step 4 Implemented

- Rates engine for room-type date pricing
- Single date upsert and bulk date-range updates with Prisma transactions
- OTA modifier support and effective price calculation
- Dynamic pricing helper based on occupancy signals from inventory
- Role-based access: ADMIN/OWNER write, STAFF read-only

### Step 4 APIs

- POST /api/rates/update
- POST /api/rates/bulk-update
- GET /api/rates?roomTypeId=&startDate=&endDate=

## Step 5 Readiness

- Effective pricing output is normalized and ready for OTA-specific sync payloads.
- Pricing and inventory services are modular, enabling adapter-based OTA integration in the next phase.

## Step 5 Implemented

- OTA Adapter Pattern architecture with independent adapters
- Mock integration adapters for Booking.com, Airbnb, MakeMyTrip, and Agoda
- Parallel sync orchestration for inventory and rates
- Unified booking fetch across all OTAs
- Retry mechanism with failure logging for sync resilience

### Step 5 APIs

- POST /api/ota/sync-inventory
- POST /api/ota/sync-rates
- GET /api/ota/bookings

## Step 6 Readiness

- Unified OTA booking payload format is available for booking ingestion.
- Inventory and pricing sync contracts are standardized for booking auto-sync workflows.

## Step 6 Implemented

- Unified booking management module across OTAs
- Booking sync from OTA adapters with duplicate protection
- Booking lifecycle status management (CONFIRMED/CANCELLED)
- Automatic inventory reduce/restore integration during sync and status changes
- Pricing snapshot attachment on booking creation via totalPrice

### Step 6 APIs

- GET /api/bookings
- GET /api/bookings/:id
- PUT /api/bookings/:id/status
- POST /api/bookings/sync

## Step 7 Readiness

- Backend APIs now cover auth, properties, rooms, inventory, rates, OTA sync, and bookings.
- API response contracts are consistent and ready for React frontend integration.

## Step 7 Implemented

- React + Vite frontend dashboard with modular architecture
- Redux Toolkit slices for auth, properties, inventory, rates, and bookings
- Tailwind CSS responsive UI with sidebar layout and reusable components
- Auth flow with login/register, JWT persistence, and protected routes
- Full page set: Dashboard, Properties, Inventory, Rates, Bookings, Promotions, Analytics
- Axios API integration layer with token interceptor and domain services
- Recharts analytics visualizations for revenue, occupancy, and OTA distribution
- Basic frontend test coverage using Vitest and Testing Library

### Frontend Routes

- /login
- /register
- /dashboard
- /properties
- /inventory
- /rates
- /bookings
- /promotions
- /analytics

## Step 8 Readiness

- Frontend layout and charting foundation is ready for advanced analytics modules.
- Redux architecture is in place for additional advanced features like notifications, AI pricing insights, and drill-down KPI widgets.

## Step 8 Implemented

- Backend analytics module with revenue, occupancy, OTA performance, and key metrics APIs
- In-memory analytics caching for faster repeated dashboard queries
- Smart pricing engine with occupancy rules and competitor simulation insights
- OTA reliability upgrades: retry up to 3 attempts and failed sync job tracking
- Notification service with email simulation and in-app notification persistence
- Frontend analytics dashboard upgraded with date filters, loading skeletons, and four chart views

### Step 8 Analytics APIs

- GET /api/analytics/revenue?startDate=&endDate=
- GET /api/analytics/occupancy?roomTypeId=&startDate=&endDate=
- GET /api/analytics/ota-performance
- GET /api/analytics/metrics

## Step 9 Readiness

- Backend and frontend modules are fully integrated and deployment-ready.
- Notification, analytics, and pricing services are isolated for container-friendly scaling.

## Step 9 Implemented

- Backend Dockerfile hardened with multi-stage production build
- Frontend Dockerized with multi-stage build and Nginx static hosting
- Full docker-compose orchestration for frontend, backend, postgres, and redis
- Production environment templates for backend and frontend
- Security hardening with CORS policy and rate limiting
- AWS-ready S3 service stub and externalized cloud config
- GitHub Actions CI/CD pipeline for test, build, and image publish

### Deploy With One Command

```bash
docker compose up --build
```

### Production Migration Command

```bash
npx prisma migrate deploy
```

## Quick Start

1. Copy env file:

```bash
cp backend/.env.example backend/.env
```

2. Install backend dependencies:

```bash
cd backend
npm install
```

3. Run database migrations and start development server:

```bash
npx prisma migrate dev --name init
npm run dev
```

4. Run tests:

```bash
npm test
```

5. Run with Docker:

```bash
docker compose up --build
```

## Frontend Quick Start

```bash
cd frontend
npm install
npm run dev
```

## Production Deployment Docs

See [DEPLOYMENT.md](DEPLOYMENT.md) for AWS, Render/Railway, and CI/CD details.
