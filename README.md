# LocalLife

LocalLife is a full-stack local commerce platform focused on discovery, reservations, and restaurant delivery. Users can explore Toronto-area stores on an interactive map, search by category or text, save favorite locations, place dine-in or delivery orders, make reservations, and track active deliveries. The project is built as a small multi-service system with a React frontend, an Express/PostgreSQL API, and a dedicated driver-assignment service that optimizes deliveries.

This repository is designed as a portfolio project that demonstrates end-to-end product development: UI work, API design, relational data modeling, geospatial queries with PostGIS, and service-to-service coordination for delivery workflows.

Live demo: [https://local-life-frontend.vercel.app](https://local-life-frontend.vercel.app)

## Features

- Interactive Leaflet map centered on the user's location
- Nearby store discovery with category filters and text search
- User registration and login
- Store details with order and reservation flows
- Delivery orders for restaurant stores
- Saved locations tied to user accounts
- Order history and reservation history
- Admin dashboard for orders, reservations, users, and drivers
- Live-style delivery simulation with driver movement and status transitions
- Dedicated driver-assignment service with multi-delivery route sequencing

## Architecture Overview

LocalLife is split into three runnable applications:

- `frontend` is a React app that renders the map UI, auth screens, store details, admin dashboard, and user flows.
- `backend` is an Express API that handles users, stores, search, orders, reservations, saved locations, and delivery state.
- `driver-assignment-service` is a separate Express service that evaluates drivers, generates delivery stop permutations, and assigns the best driver for a new delivery.

```mermaid
flowchart LR
  A["React Frontend (:3000)"] -->|"HTTP API requests"| B["Express Backend (:3001)"]
  A -->|"Polling for orders, deliveries, admin data"| B
  B -->|"SQL + PostGIS queries"| C[("PostgreSQL + PostGIS")]
  B -->|"POST /assign"| D["Driver Assignment Service (:3002)"]
  D -->|"Reads and updates driver/delivery data"| C
```

## How The Services Interact

1. The frontend loads categories, store lists, and user-specific data from the backend.
2. For nearby search, the backend uses PostGIS queries to filter stores by distance and Toronto map bounds.
3. When a user places a delivery order, the backend creates the order in PostgreSQL and then calls the driver-assignment service.
4. The driver-assignment service loads active drivers and deliveries, generates valid pickup/dropoff sequences, and returns the best available driver whose total ETA stays within the configured 2-hour limit.
5. The backend stores and advances delivery state, while a simulation loop updates driver locations and delivery statuses over time.
6. The frontend polls for user orders, active deliveries, and admin views so the UI reflects driver movement and delivery progress.

## Delivery Lifecycle

Delivery orders move through a defined lifecycle implemented in the backend and reflected in the database:

`assigned -> started -> arrived_at_restaurant -> picked_up -> returning -> completed`

What happens in practice:

- A restaurant delivery order is created in the backend.
- The backend sends the order, restaurant location, and customer location to the driver-assignment service.
- If a driver is selected, a delivery record is created and linked to that driver.
- The backend's movement simulation starts the trip to the restaurant, waits briefly at pickup, drives to the customer, then sends the driver back to their original location.
- Active deliveries are exposed through backend routes so the frontend can show driver progress.
- On startup and shutdown, the backend performs recovery and cleanup work so drivers and deliveries do not stay stuck in active states.

## Engineering Highlights

### 1. Geospatial search with PostGIS

The backend stores each business as a geographic point and uses PostGIS functions such as `ST_DWithin`, `ST_Distance`, and coordinate extraction to power nearby store lookup and map display.

### 2. Separate driver-assignment microservice

Delivery assignment is intentionally split out from the main API. This service owns driver ranking, route sequencing, queueing hooks, analytics endpoints, and configuration tuning, which makes the project more representative of real service boundaries than a typical single-process portfolio app.

### 3. Multi-delivery route optimization logic

The driver-assignment service generates valid pickup/dropoff permutations, filters out invalid sequences where dropoff happens before pickup, and chooses the shortest sequence that satisfies the maximum ETA threshold.

### 4. Delivery simulation and recovery flow

The backend includes startup recovery, graceful shutdown, driver reset logic, and an interval-based movement simulation that advances deliveries through multiple states while updating driver positions in the database.

### 5. Real full-stack data model

The project goes beyond simple CRUD by modeling users, stores, orders, order items, reservations, saved locations, drivers, and deliveries, with indexes and constraints that support the map and delivery workflows.

## Tech Stack

### Frontend

- React 18
- React Leaflet + Leaflet
- Axios
- CSS Modules

### Backend

- Node.js
- Express
- PostgreSQL
- PostGIS
- `pg`
- `bcrypt`

### Driver Assignment Service

- Node.js
- Express
- PostgreSQL
- Custom route sequencing and ETA calculation logic

### Tooling

- `concurrently` for local multi-service startup
- `nodemon` for backend and driver service development
- `react-scripts` for frontend dev/build

## Folder Structure

```text
local-life/
├── backend/
│   ├── config/
│   ├── middleware/
│   ├── routes/
│   ├── sql/
│   ├── db.js
│   └── index.js
├── driver-assignment-service/
│   ├── config.js
│   ├── database.js
│   ├── driverAssignmentService.js
│   └── server.js
├── frontend/
│   ├── public/
│   └── src/
│       ├── components/
│       ├── config/
│       ├── hooks/
│       ├── services/
│       └── utils/
├── SETUP_LOCAL.md
├── package.json
└── README.md
```

## Key Folders And Files

- [`backend/index.js`](./backend/index.js): Express app setup, startup recovery, graceful shutdown, global error handling, and delivery movement simulation
- [`backend/routes/`](./backend/routes): API routes for users, orders, reservations, nearby search, delivery, saved locations, and search
- [`backend/sql/schema.sql`](./backend/sql/schema.sql): database schema for all major entities
- [`backend/sql/1000_stores.sql`](./backend/sql/1000_stores.sql): large Toronto-area store seed data
- [`driver-assignment-service/driverAssignmentService.js`](./driver-assignment-service/driverAssignmentService.js): driver ranking, ETA calculation, sequence generation, and assignment workflow
- [`frontend/src/App.js`](./frontend/src/App.js): top-level app flow for auth, location setup, map, and side panels
- [`frontend/src/components/Map/Map.js`](./frontend/src/components/Map/Map.js): store rendering, filters, saved locations, driver display, and admin mode behavior

## Local Setup

### Prerequisites

- Node.js 18+
- npm 8+
- PostgreSQL 14+
- PostGIS extension enabled in PostgreSQL

### 1. Create the database

```sql
CREATE DATABASE local_life;
```

Enable PostGIS in the database if it is not already enabled:

```sql
CREATE EXTENSION postgis;
```

### 2. Load the schema

From the repository root:

```bash
psql -U postgres -d local_life -f backend/sql/schema.sql
```

### 3. Seed stores

You have two options:

- For a quick demo, use the sample inserts documented in [`SETUP_LOCAL.md`](./SETUP_LOCAL.md)
- For a larger dataset, load [`backend/sql/1000_stores.sql`](./backend/sql/1000_stores.sql)

Example:

```bash
psql -U postgres -d local_life -f backend/sql/1000_stores.sql
```

### 4. Install dependencies

From the repository root:

```bash
npm run install:all
```

### 5. Configure environment variables

Create local `.env` files for the backend, driver-assignment service, and frontend using the variables listed below.

### 6. Start the application

From the repository root:

```bash
npm run dev
```

This starts:

- Frontend: `http://localhost:3000`
- Backend API: `http://localhost:3001`
- Driver assignment service: `http://localhost:3002`

You can also run each service separately:

```bash
cd backend && npm run dev
cd driver-assignment-service && npm run dev
cd frontend && npm run dev
```

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Purpose | Default |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string | none |
| `PORT` | No | Backend port | `3001` |
| `NODE_ENV` | No | Runtime environment | `development` |
| `CORS_ORIGIN` | No | Allowed frontend origin | `http://localhost:3000` |
| `DRIVER_ASSIGNMENT_SERVICE_URL` | No | Base URL for assignment service | `http://localhost:3002` |
| `ADMIN_CODE` | No | Admin login code verified by the backend | none |
| `JWT_SECRET` | No | Secret used to sign user/admin session tokens | none |
| `USER_TOKEN_TTL` | No | User session token lifetime | `7d` |
| `ADMIN_TOKEN_TTL` | No | Admin session token lifetime | `4h` |
| `DB_POOL_SIZE` | No | PostgreSQL pool size | `10` |
| `DB_IDLE_TIMEOUT` | No | PostgreSQL idle timeout in ms | `30000` |
| `DB_CONNECTION_TIMEOUT` | No | PostgreSQL connection timeout in ms | `60000` |

Example:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/local_life
PORT=3001
NODE_ENV=development
CORS_ORIGIN=http://localhost:3000
DRIVER_ASSIGNMENT_SERVICE_URL=http://localhost:3002
ADMIN_CODE=local-life-admin
JWT_SECRET=replace-this-with-a-long-random-secret
USER_TOKEN_TTL=7d
ADMIN_TOKEN_TTL=4h
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=60000
```

### Driver Assignment Service (`driver-assignment-service/.env`)

| Variable | Required | Purpose | Default |
| --- | --- | --- | --- |
| `DATABASE_URL` | Yes | PostgreSQL connection string | none |
| `DRIVER_SERVICE_PORT` | No | Driver service port | `3002` |
| `NODE_ENV` | No | Runtime environment | `development` |
| `DB_POOL_SIZE` | No | PostgreSQL pool size | `10` |
| `DB_IDLE_TIMEOUT` | No | PostgreSQL idle timeout in ms | `30000` |
| `DB_CONNECTION_TIMEOUT` | No | PostgreSQL connection timeout in ms | `60000` |
| `MAX_ASSIGNMENT_DISTANCE` | No | Assignment search radius in km | `50` |
| `ASSIGNMENT_TIMEOUT` | No | Assignment timeout in ms | `5000` |
| `ASSIGNMENT_RETRIES` | No | Assignment retry count | `3` |

Example:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/local_life
DRIVER_SERVICE_PORT=3002
NODE_ENV=development
DB_POOL_SIZE=10
DB_IDLE_TIMEOUT=30000
DB_CONNECTION_TIMEOUT=60000
MAX_ASSIGNMENT_DISTANCE=50
ASSIGNMENT_TIMEOUT=5000
ASSIGNMENT_RETRIES=3
```

### Frontend (`frontend/.env`)

| Variable | Required | Purpose | Default |
| --- | --- | --- | --- |
| `REACT_APP_API_URL` | No | Backend API base URL. Leave unset for same-origin deployments. | `http://localhost:3001` in development, same-origin in production |
Example:

```bash
REACT_APP_API_URL=http://localhost:3001
```

If you deploy the frontend and backend on the same origin, you can leave `REACT_APP_API_URL` unset and the frontend will use relative requests in production.

## Deployment Notes

- If the frontend and backend are deployed on the same host, the frontend can use the production default relative API base URL and the backend can rely on its same-origin CORS fallback.
- If the frontend is hosted separately, set `REACT_APP_API_URL` in the frontend and set `CORS_ORIGIN` in the backend to the deployed frontend origin.
- `CORS_ORIGIN` can be a comma-separated list when you want to allow multiple frontend origins.
- Set `DRIVER_ASSIGNMENT_SERVICE_URL` in the backend to the deployed driver-assignment-service URL.
- The driver-assignment-service supports standard platform `PORT` in addition to `DRIVER_SERVICE_PORT`.

## API And Workflow Notes

- Search routes live under `/api/search` and `/api/nearby`
- User auth routes live under `/api/users`
- Orders live under `/api/orders`
- Reservations live under `/api/reservations`
- Saved locations live under `/api/saved-locations`
- Delivery status and driver tracking routes live under `/delivery`
- The driver-assignment service exposes operational endpoints such as `/assign`, `/drivers`, `/analytics`, `/config`, and `/queue/status`

## Why This Project Works Well As A Portfolio Piece

This codebase shows more than just UI polish. It demonstrates:

- building a multi-service system instead of a single CRUD server
- working with geospatial data and distance-based filtering
- modeling a realistic relational schema
- coordinating asynchronous delivery workflows across services
- designing both user-facing and admin-facing product flows

## Related Documentation

- [`SETUP_LOCAL.md`](./SETUP_LOCAL.md) contains the original local setup notes and troubleshooting tips
