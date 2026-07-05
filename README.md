# Umunsi Backend API

REST API backend for umunsi.com news portal.

## Setup

```bash
npm install
cp env.example .env  # Edit with your database URL and JWT secret
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

## API Endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | /api/auth/login | - | Login, returns JWT |
| POST | /api/auth/register | - | Register new user |
| GET | /api/auth/users | ADMIN | List users |
| GET | /api/articles | - | List published articles (paginated) |
| GET | /api/articles/latest | - | Latest articles |
| GET | /api/articles/:slug | - | Single article by slug |
| POST | /api/articles | ADMIN/EDITOR/AUTHOR | Create article |
| PUT | /api/articles/:id | ADMIN/EDITOR/AUTHOR | Update article |
| DELETE | /api/articles/:id | ADMIN/EDITOR | Delete article |
| GET | /api/categories | - | List categories |
| POST | /api/categories | ADMIN | Create category |
| PUT | /api/categories/:id | ADMIN | Update category |
| DELETE | /api/categories/:id | ADMIN | Delete category |
| GET | /api/media | AUTH | List uploaded media |
| POST | /api/media/upload | AUTH | Upload image (field: "file") |
| GET | /api/users | ADMIN | List users |
| POST | /api/users | ADMIN | Create user |
| PUT | /api/users/:id | ADMIN | Update user |
| DELETE | /api/users/:id | ADMIN | Delete user |
| GET | /api/stats | AUTH | Dashboard stats |
| GET | /api/settings/public | - | Public settings |
| GET | /api/settings | ADMIN/EDITOR | Get settings |
| PUT | /api/settings | ADMIN/EDITOR | Update settings |
| GET | /api/ads | - | Active ad banners |
| PUT | /api/ads/:position | ADMIN/EDITOR | Upsert banner |
| DELETE | /api/ads/:position | ADMIN | Delete banner |

## Upload

- Endpoint: `POST /api/media/upload`
- Field name: `file`
- Allowed types: JPEG, PNG, WebP, GIF
- Max size: 10MB
- Returns: `{ url: "/uploads/filename.ext", filename: "filename.ext" }`

## Deploy on Vercel

1. Push to GitHub
2. Import project in Vercel
3. Set environment variables: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`
4. Deploy
