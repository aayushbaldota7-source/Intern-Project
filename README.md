# OrderPulse — Real-Time Order Notification System

A simple backend system where connected clients automatically receive updates whenever the database changes — **no polling needed**.

---

## Problem Statement

Build a system where connected clients automatically receive updates whenever the database changes, without using frequent polling.

### Database Table: `orders`

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PRIMARY KEY | Auto-incremented ID |
| `customer_name` | VARCHAR | Name of the customer |
| `product_name` | VARCHAR | Name of the product |
| `status` | VARCHAR | `pending`, `shipped`, or `delivered` |
| `updated_at` | TIMESTAMPTZ | Last modified timestamp |

### Requirements

- Any `INSERT`, `UPDATE`, or `DELETE` on the `orders` table should notify all connected clients in real time.
- Clients should receive updates **without polling** the server repeatedly.
- The frontend should update automatically whenever a change happens.

### Deliverables

- ✅ Backend service that listens for DB changes using **PostgreSQL LISTEN/NOTIFY**
- ✅ Real-time updates pushed to clients using **Socket.IO (WebSocket)**
- ✅ Simple frontend dashboard showing live orders and an event log
- ✅ REST API to create, update, and delete orders
- ✅ Docker setup for easy deployment
- ✅ README with setup instructions

---

## How It Works

```
1. A REST API call (POST/PUT/DELETE) changes a row in PostgreSQL.
2. A PostgreSQL trigger fires automatically and calls pg_notify().
3. The backend has a dedicated LISTEN connection that receives the notification.
4. The backend broadcasts the change to all clients via Socket.IO.
5. The browser updates the UI instantly — no polling required.
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Database | PostgreSQL 17 |
| Backend | Node.js + Express.js |
| Real-Time | PostgreSQL LISTEN/NOTIFY + Socket.IO |
| Frontend | Vanilla HTML / CSS / JavaScript |
| Containers | Docker + Docker Compose |

---

## Project Structure

```
order-notifications/
├── backend/
│   ├── server.js                        # Entry point
│   ├── src/
│   │   ├── app.js                       # Express + Socket.IO setup
│   │   ├── config/database.js           # DB connection pool
│   │   ├── routes/orderRoutes.js        # REST endpoints
│   │   ├── controllers/orderController.js
│   │   ├── services/
│   │   │   ├── orderService.js          # SQL queries
│   │   │   └── notificationService.js  # LISTEN/NOTIFY bridge
│   │   ├── middleware/
│   │   │   ├── logger.js
│   │   │   └── errorHandler.js
│   │   └── db/migrations/001_init.sql   # Table + trigger SQL
│   ├── Dockerfile
│   └── package.json
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── docker-compose.yml
└── README.md
```

---

## Setup Instructions

### Option A — Docker (recommended, one command)

```bash
# 1. Copy the environment file
cp .env.example .env

# 2. Start everything
docker compose up --build

# 3. Open the app
open http://localhost:3000
```

The migration SQL runs automatically on first PostgreSQL boot.

### Option B — Run Locally

**Requirements:** Node.js ≥ 20, PostgreSQL 14+

```bash
# 1. Create the database and run the migration
createdb ordersdb
psql -U postgres -d ordersdb -f backend/src/db/migrations/001_init.sql

# 2. Install dependencies
cd backend
cp .env.example .env
npm install

# 3. Start the server
npm start
# or with file-watch reload:
npm run dev

# 4. Open http://localhost:3000
```

---

## REST API

| Method | Endpoint | Description |
|---|---|---|
| GET | `/orders` | Get all orders |
| POST | `/orders` | Create a new order |
| PUT | `/orders/:id` | Update an order (any field) |
| DELETE | `/orders/:id` | Delete an order |
| GET | `/health` | Health check |

**Example — Create an order:**
```bash
curl -X POST http://localhost:3000/orders \
  -H 'Content-Type: application/json' \
  -d '{"customer_name":"Alice","product_name":"Keyboard","status":"pending"}'
```

---

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ordersdb
DB_USER=postgres
DB_PASSWORD=postgres
CORS_ORIGIN=*
```

---

## Why Not Polling?

| | Polling | LISTEN/NOTIFY |
|---|---|---|
| **Latency** | Up to poll interval (1–30s) | Under 10ms |
| **DB load at idle** | Constant (many requests) | Zero |
| **Scalability** | Gets worse with more clients | Stays flat |

With 10,000 clients polling every 5 seconds, you get **2,000 requests/second** even when nothing changes. With LISTEN/NOTIFY, the load is nearly **zero** at idle.

---

## Future Improvements

- [ ] Add JWT authentication for WebSocket connections
- [ ] Add Redis adapter for running multiple backend instances
- [ ] Add per-user rooms so clients only see their own orders
- [ ] Add input validation with `zod`
- [ ] Add unit tests with `vitest`
