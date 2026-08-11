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
- Swagger docs: http://localhost:3000/docs when `ENABLE_SWAGGER=true`

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
- For production or shared office use, set a strong `JWT_SECRET` with at least 32 characters.
- Set `CORS_ORIGINS` to the frontend URL that users open, for example `http://192.168.1.10:5173`.
- Set `VITE_API_BASE_URL` to the backend URL reachable from other computers, for example `http://192.168.1.10:3000`.
- Keep `ENABLE_SWAGGER=false` unless you explicitly want to expose API docs.
