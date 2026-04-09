# Deployment Guide

## One-Command Local Stack

From repository root:

```bash
docker compose up --build
```

Services:

- Frontend: http://localhost:8080
- Backend API: http://localhost:5000/api
- Health: http://localhost:5000/api/health
- Postgres: localhost:5432
- Redis: localhost:6379

## Production Migration Command

The backend container runs migrations automatically on startup:

```bash
npx prisma migrate deploy
```

## Required Environment Variables

Backend (`backend/.env.production`):

- DATABASE_URL
- JWT_SECRET
- PORT
- CORS_ORIGIN
- RATE_LIMIT_WINDOW_MS
- RATE_LIMIT_MAX
- REDIS_URL
- AWS_REGION
- AWS_S3_BUCKET
- AWS_ACCESS_KEY_ID
- AWS_SECRET_ACCESS_KEY

Frontend (`frontend/.env.production`):

- VITE_API_BASE_URL

## Render / Railway (Option A)

1. Create Postgres and Redis managed services.
2. Set backend env vars in service settings.
3. Deploy backend container from `backend/Dockerfile`.
4. Deploy frontend container from `frontend/Dockerfile`.
5. Configure frontend `VITE_API_BASE_URL` to backend public URL + `/api`.

## AWS (Option B)

### Suggested Topology

- EC2: runs Docker Compose for backend + frontend + redis
- RDS PostgreSQL: managed database
- S3: property image storage (stub service already prepared)

### AWS Steps

1. Create RDS PostgreSQL and update `DATABASE_URL`.
2. Launch EC2 and install Docker + Docker Compose.
3. Copy repository and set `backend/.env.production`.
4. Run `docker compose up -d --build`.
5. Configure security groups for ports 80/443 and backend private access.
6. Add reverse proxy or ALB for TLS termination.

## CI/CD

Workflow: `.github/workflows/deploy.yml`

Pipeline does:

1. Backend install + tests
2. Frontend install + build + tests
3. Docker image builds
4. Image push to GHCR on main branch
