## Quick Startup Commands

Use 3 terminals from the repo root.

Terminal 1 (Postgres local data dir):

```powershell
Set-Location "D:\Desktop\Projects\Cloud Based Saas"
& "C:\Program Files\PostgreSQL\15\bin\postgres.exe" -D ".\.local-postgres" -p 55432 -h 0.0.0.0
```

Terminal 2 (backend):

```powershell
Set-Location "D:\Desktop\Projects\Cloud Based Saas\backend"
npm start
```

Terminal 3 (frontend):

```powershell
Set-Location "D:\Desktop\Projects\Cloud Based Saas\frontend"
npm run dev -- --host 0.0.0.0 --port 5173
```

If you use Docker DB instead of local Postgres:

```powershell
Set-Location "D:\Desktop\Projects\Cloud Based Saas"
docker compose up -d postgres redis
```

### Property-Scoped Permissions Rollout (Latest)

After pulling latest code (which includes `ManagerPropertyPermission`), run this once:

```powershell
Set-Location "D:\Desktop\Projects\Cloud Based Saas\backend"
npx prisma db push
npx prisma generate
```

If `npx prisma generate` fails on Windows with `EPERM ... query_engine-windows.dll.node`:

```powershell
Set-Location "D:\Desktop\Projects\Cloud Based Saas\backend"
npx prisma generate --no-engine
```

### Windows Quick Fixes (Common)

If local Postgres command returns exit code `1`, check if PostgreSQL is already listening first:

```powershell
Get-NetTCPConnection -LocalPort 55432 -State Listen -ErrorAction SilentlyContinue
```

If no listener appears, rerun Postgres command from repo root and verify `.local-postgres` exists.

# Full Setup Guide (Fresh Install)

This guide sets up the project from scratch on a new machine.

## Stack

- Backend: Node.js + Express + Prisma
- Frontend: React + Vite
- Database: PostgreSQL
- Cache: Redis

## 1. Prerequisites

Install these first:

- Git
- Node.js 20+ (LTS recommended)
- npm 10+
- Docker Desktop (recommended path)
- Optional (no Docker DB path): PostgreSQL 15+

Verify:

```bash
git --version
node --version
npm --version
docker --version
```

## 2. Clone Repository

```bash
git clone https://github.com/PH4NT0M-droid/Cloud-based-Saas.git
cd Cloud-based-Saas
```

## 3. Install Dependencies

```bash
cd backend
npm install
cd ../frontend
npm install
cd ..
```

## 4. Environment Setup

Create `backend/.env` with:

```env
NODE_ENV=development
PORT=5000
DATABASE_URL=postgresql://ota_user:ota_password@127.0.0.1:5432/ota_channel_manager?schema=public
JWT_SECRET=super_secret_change_me
JWT_EXPIRES_IN=1d
CORS_ORIGIN=http://localhost:5173,http://localhost:8080
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=300
REDIS_URL=redis://localhost:6379
AWS_REGION=ap-south-1
AWS_S3_BUCKET=ota-channel-manager-assets
AWS_ACCESS_KEY_ID=replace_me
AWS_SECRET_ACCESS_KEY=replace_me
```

Notes:

- Use port `5432` when using Docker PostgreSQL.
- If you run PostgreSQL manually on another port (for example `55432`), update `DATABASE_URL` accordingly.

## 5. Database + Redis (Recommended: Docker)

From repository root:

```bash
docker compose up -d postgres redis
```

Verify containers:

```bash
docker ps
```

## 6. Prisma Migration + Client

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
cd ..
```

If this is a first-time local DB and you want dev migration behavior:

```bash
cd backend
npx prisma migrate dev --name init
npx prisma generate
cd ..
```

## 7. Run Backend + Frontend

Open two terminals.

Terminal 1 (backend):

```bash
cd backend
npm run dev
```

Terminal 2 (frontend):

```bash
cd frontend
npm run dev -- --host 0.0.0.0 --port 5173
```

## 8. Verify Everything Is Running

Backend health:

```bash
curl http://localhost:5000/api/health
```

Frontend:

- Open `http://localhost:5173`

Default local admin login:

- Email: `admin@admin.com`
- Password: `Password123`

## 9. Run Tests

Backend tests:

```bash
cd backend
npm test
```

Frontend tests:

```bash
cd frontend
npm test
```

## 10. Full Docker Alternative (App + DB + Redis)

If you want everything containerized:

```bash
docker compose up --build
```

Then:

- Frontend: `http://localhost:8080`
- Backend API: `http://localhost:5000`

## 11. Windows Notes (if `npm` is not found in terminal)

Some shells may not have PATH loaded. Use absolute paths:

Backend:

```powershell
Push-Location "D:\Desktop\Projects\Cloud Based Saas\backend"
& "C:\Program Files\nodejs\node.exe" src/server.js
```

Frontend:

```powershell
Push-Location "D:\Desktop\Projects\Cloud Based Saas\frontend"
& "C:\Program Files\nodejs\node.exe" .\node_modules\vite\bin\vite.js --host 0.0.0.0 --port 5173
```

## 12. Troubleshooting

### A) "Invalid or expired token" everywhere

Clear local session and log in again:

```js
localStorage.removeItem('token');
localStorage.removeItem('user');
location.reload();
```

### B) Prisma cannot connect to DB

Check DB host/port in `backend/.env` and ensure PostgreSQL is listening on that port.

### C) Port already in use

- Backend uses `5000`
- Frontend uses `5173`
- PostgreSQL uses `5432` (or your configured custom port)

Stop conflicting process or change ports.

### D) Migration/client drift

Run:

```bash
cd backend
npx prisma migrate deploy
npx prisma generate
```

## 13. Useful Commands

Start only DB/Redis:

```bash
docker compose up -d postgres redis
```

Stop DB/Redis:

```bash
docker compose stop postgres redis
```

Stop all compose services:

```bash
docker compose down
```

Run backend in production mode:

```bash
cd backend
npm start
```

Build frontend:

```bash
cd frontend
npm run build
```
