# Local Life — Local Development Setup

For the shortest path from a fresh clone:

```bash
npm run setup:local
createdb local_life
psql -U postgres -d local_life -c "CREATE EXTENSION IF NOT EXISTS postgis;"
npm run db:init
npm run dev
```

Optional store seed:

```bash
npm run db:seed:stores
```

## Prerequisites

- Node.js 18+ (https://nodejs.org)
- PostgreSQL 14+ with PostGIS extension (https://postgis.net)

---

## 1. Copy environment files

From the project root:

```bash
npm run env:copy
```

This creates `.env` files for the backend, frontend, and driver-assignment service if they do not already exist.

---

## 2. Install dependencies

From the project root:

```bash
npm run install:all
```

---

## 3. Create the PostgreSQL database

Open psql as the postgres superuser and run:

```sql
CREATE DATABASE local_life;
```

Enable PostGIS:

```bash
psql -U postgres -d local_life -c "CREATE EXTENSION IF NOT EXISTS postgis;"
```

Then run the schema to create all tables and seed the drivers:

```bash
npm run db:init
```

> If your local postgres username or database name is different, run:
> `PGUSER=your_user PGDATABASE=your_database npm run db:init`

---

## 4. Start the three services

From the project root:

```bash
npm run dev
```

That starts all three services together:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Driver assignment service: `http://localhost:3002`

If you prefer separate terminals, run one command in each:

**Terminal 1 — Backend API (port 3001)**
```bash
cd backend
npm start
```

**Terminal 2 — Driver Assignment Service (port 3002)**
```bash
cd driver-assignment-service
npm start
```

**Terminal 3 — Frontend (port 3000)**
```bash
cd frontend
npm start
```

The app will be available at **http://localhost:3000**

---

## 5. Seed stores (optional)

For the larger Toronto dataset:

```bash
npm run db:seed:stores
```

If you want only a few manual demo stores instead, add them in psql:

```sql
INSERT INTO stores (name, category, location, attributes) VALUES
('Toronto Burger',  'restaurant', ST_SetSRID(ST_MakePoint(-79.3832, 43.6532), 4326)::geography,
 '{"address":"1 King St W, Toronto","open":"09:00","close":"22:00","products":[{"name":"Burger","price":12.99},{"name":"Fries","price":4.99}]}'::jsonb),

('Kensington Market',  'market', ST_SetSRID(ST_MakePoint(-79.4005, 43.6545), 4326)::geography,
 '{"address":"Kensington Ave, Toronto","open":"08:00","close":"20:00","products":[{"name":"Fresh Produce","price":5.00}]}'::jsonb),

('Queen St Cafe',  'cafe', ST_SetSRID(ST_MakePoint(-79.3960, 43.6480), 4326)::geography,
 '{"address":"500 Queen St W, Toronto","open":"07:00","close":"18:00","products":[{"name":"Latte","price":4.50},{"name":"Croissant","price":3.00}]}'::jsonb);
```

---

## How the delivery system works

1. User places a **delivery** order through the frontend
2. Backend calls the **Driver Assignment Service** (port 3002) which uses a route-optimization algorithm to pick the best available driver
3. The driver is assigned and a `deliveries` row is created with status `assigned`
4. The backend's movement simulation loop (runs every 3 seconds) advances each driver through: `assigned → started → arrived_at_restaurant → picked_up → returning → completed`
5. The frontend polls the order status every 10 seconds and shows live driver position on the map

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `DATABASE_URL` connection error | Check postgres is running: `pg_ctl status` |
| PostGIS not found | `CREATE EXTENSION postgis;` inside `local_life` DB |
| Port already in use | Kill the process using that port |
| No stores visible on map | Run `npm run db:seed:stores` or add the sample inserts above |
| No drivers available | Run `npm run db:init` again to reseed drivers from `schema.sql` |
