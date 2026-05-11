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

## Supabase Setup
Create `OFS database`:
```
Create your database and copy your database password
Navigate to Authentication -> Sign-in/Providers -> Disable "Confirm Email"
At the project root navigate to SQL\SupabaseQueries.sql
Copy this query and navigate to SQL Editor in Supabase
Create a new Snippet, paste the query, and press run.
```

## Product Images/Supabase Storage
This project supports two ways of adding product images:

-Use a direct image URL from an external website.
-Upload a local image file through Supabase Storage.
For local uploads, the project uses a Supabase Storage bucket named product-images. When a manager uploads a product image from the dashboard, the application uploads the file into that bucket, generates a public URL for the uploaded file, and stores that URL in the product’s image_url field in the items table.

The database does not store the image file itself. It only stores the URL that points to the image in Supabase Storage. 
An example URL: https://<your-project>.supabase.co/storage/v1/object/public/product-images/products/example-image.jpg

Supabase Storage Setup
To enable local product image uploads:
```
Open your Supabase project dashboard.
Go to Storage.
Create a new bucket named product-images.
Make sure the bucket is readable by the app so uploaded images can be displayed (he simplest option is to make the bucket public and then allow authenticated users to upload to it).
```
Storage Policies
In addition to creating the bucket, you must also add Storage policies. Without these policies, uploads may fail even if the bucket already exists.
```
Open Supabase Dashboard -> Storage -> Policies
Then add policies for the product-images bucket.

A simple setup is:
Public read access for product images
Authenticated users can upload product images
Authenticated users can update product images
Authenticated users can delete product images
```

## Environment Setup

Create `ofs-backend/.env`:

```
SUPABASE_URL=your_supabase_project_url
SUPABASE_DB_URL=postgresql://postgres_URL:[YOUR-PASSWORD]@aws-1-us-west-2.pooler.supabase.com:6543/postgres (use the transaction pooler string)
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
At root:
npm install
```
```bash
cd ofs-frontend
npm install
```
```bash
cd ofs-backend
pip install --no-cache-dir -r requirements.txt
npm install
```
```bash
docker compose up --build
```

- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- FastAPI Swagger documentation: http://localhost:8000/docs

## Creating your first Manager user
To create your first manager user, make sure to sign up and create a regular user. Once you have done so,
- Navigate to your Supabase database
- Go to SQL Editor
- Create a new snippet
- paste this query in and replace the email with the email you used to sign up:

After doing so, you'll be able to access the Manager Dashboard and add more Manager roles from the Manager Account page.
```
-- To set your first user to manager, run this query
-- Replace 'your@email.com' with the email of the user you want to set to manager
UPDATE public.profiles
SET role = 'manager'
WHERE email = 'your@email.com';
```
