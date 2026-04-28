# OFS (On-Demand Food Delivery Service)

## App Overview

OFS is a grocery delivery web service that allows customers to sign up, browse real-time product catalogs, checkout, and track their orders. There is also a manager dashboard that allows for easy restocking of food items and management of order statuses with live mapping of delivery robots.

---

## Tech Stack

**Backend**

- FastAPI + Uvicorn
- psycopg v3 (PostgreSQL driver)
- python-jose (JWT validation)
- Stripe (payment processing)
- email-validator
- Docker

**Frontend**

- Next.js / React
- Tailwind CSS
- Supabase JS (authentication & database client)
- Mapbox (live delivery tracking)
- Docker

---

## Prerequisites

- Docker and Docker Compose installed
- A [Supabase](https://supabase.com) account (project URL, anon key, DB connection string)
- A [Stripe](https://stripe.com) account (secret key)
- A [Mapbox](https://mapbox.com) account (access token)

---

## Environment Setup

Create `ofs-backend/.env`:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_DB_URL=your_supabase_db_connection_string
STRIPE_SECRET_KEY=your_stripe_secret_key
MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
FRONTEND_BASE_URL=http://localhost:3000/
```

Create `ofs-frontend/.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN=your_mapbox_access_token
```

---

## Running the Project

```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
