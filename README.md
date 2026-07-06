# Distributed URL Shortener (Bitly Clone) 🚀

This is a production-grade, highly performant Distributed URL Shortener API and interactive dashboard built using **Node.js**, **TypeScript**, **Express**, **PostgreSQL** (via Prisma ORM), and **Redis**.

It includes authentication, analytics, rate limiting, and caching, and is designed to run both locally in a **Docker** environment and deploy seamlessly to serverless environments like **Vercel**.

---

## ⚡ How the Backend is Highlighted & Optimized

This project showcases backend engineering principles designed to scale, reduce latency, and provide robust fault tolerance:

### 1. High-Speed Caching Layer (Redis)
Every lookup to `/:shortCode` hits the **Redis in-memory cache** first (O(1) time complexity). 
* **Cache Hit**: Redirect is served in **< 1-2ms**, completely bypassing database queries.
* **Cache Miss**: The app queries PostgreSQL, caches the result in Redis with a Time-To-Live (TTL) relative to its expiry, and performs the redirect.

### 2. Non-Blocking Asynchronous Click Analytics
Database write operations are typically slow. To prevent recording analytics from slowing down the redirect, **clicks are logged asynchronously in the background**. The server initiates the write promise and immediately returns the `302 Redirect` response to the user.

### 3. Database Column Indexing
The `short_code` database column is configured with an **explicit unique index** in PostgreSQL. On cache misses, the database engine searches an B-tree index, executing queries in O(log N) rather than doing full-table scans (O(N)).

### 4. Graceful Fallback (Fail-Safe Architecture)
If Redis is not configured or goes down, the app **degrades gracefully**. It intercepts Redis errors, logs warnings, and switches to local in-memory rate limiting and direct database lookups rather than crashing.

### 5. Base62 Short Code Generation
To avoid sequential and guessable URLs (which can lead to harvesting vulnerability), the system generates random 6-character Base62 codes (e.g., `aB7x9K`). A built-in checks-and-retry mechanism runs checks against Redis and DB to ensure absolute collision safety.

### 6. Lazy Deletion of Expired Links
To save database space and optimize performance, expired links are handled through **lazy deletion**: when a client visits an expired link, the server detects the expiry, deletes the record from the database and Redis, and returns a `410 Gone` error.

---

## 🛠️ Tech Stack & Key Concepts

* **Runtime**: Node.js (v22.20.0) with TypeScript
* **Database**: PostgreSQL (relational model for users, links, and click logs)
* **ORM**: Prisma (type-safe queries and migration manager)
* **Cache & Rate Limiter**: Redis (ioredis & rate-limit-redis)
* **Logging**: Pino (JSON-structured high-performance logging)
* **API Docs**: Swagger (OpenAPI 3.0)
* **Deployment**: Docker & Vercel Serverless

---

## 🚀 Setup & Execution Guide

### Local Development (Using Docker Compose - Recommended)

Running with Docker starts the Node app, PostgreSQL database, and Redis cache automatically.

1. Clone or copy files into your repository.
2. Build and run the containers:
   ```bash
   docker compose up --build
   ```
3. The app is ready!
   * **Dashboard & App**: `http://localhost:3000`
   * **API Docs (Swagger)**: `http://localhost:3000/docs`

---

### Local Development (Manual Setup)

If you have PostgreSQL and Redis running locally:

1. Copy `.env.example` to `.env` and configure your credentials:
   ```env
   PORT=3000
   JWT_SECRET=super_secret_jwt_token_for_url_shortener_dev
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/urlshortener?schema=public
   REDIS_URL=redis://localhost:6379
   NODE_ENV=development
   ```
2. Install dependencies:
   ```bash
   npm install --ignore-scripts
   ```
3. Run database migrations:
   ```bash
   npx prisma migrate dev
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```

---

## ☁️ Vercel Serverless Deployment

This project is fully configured for deployment on Vercel:

1. Create a PostgreSQL database instance on [Supabase](https://supabase.com) or [Neon](https://neon.tech).
2. Create a Redis instance on [Upstash](https://upstash.com).
3. Connect your Git repository to Vercel.
4. Configure the following environment variables in Vercel project settings:
   * `DATABASE_URL`: Your Supabase/Neon PostgreSQL connection string.
   * `REDIS_URL`: Your Upstash Redis connection string.
   * `JWT_SECRET`: A strong secret key.
5. Deploy! Vercel will compile the TypeScript code and run it inside Serverless Functions.
