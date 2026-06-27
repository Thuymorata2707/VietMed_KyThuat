# Docker Guide

This project can run with Docker Compose:

- MySQL database
- NestJS backend
- Vite/React frontend served by Nginx

## First Run

Copy the sample env file if you want to customize ports or passwords:

```bash
cp .env.example .env
```

Start the stack:

```bash
docker compose up --build
```

Open:

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Swagger docs: http://localhost:3000/docs

The backend runs Prisma migrations automatically before starting.

## Seed Data

After the backend is running, seed the database when needed:

```bash
docker compose exec backend npm run db:seed
```

## Common Commands

```bash
docker compose up --build
docker compose down
docker compose logs -f backend
docker compose exec backend npm run db:status
```

To remove local Docker database and uploaded files:

```bash
docker compose down -v
```

## Notes

- Uploaded files are stored in the `backend-uploads` Docker volume.
- MySQL data is stored in the `mysql-data` Docker volume.
- For production, set a strong `JWT_SECRET` and database password instead of using defaults.
