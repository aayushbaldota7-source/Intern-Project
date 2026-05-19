# OrderPulse — Real-Time Order Notification System

A production-grade system where connected clients **automatically receive database updates in real time — no polling required**.

---

## Problem Statement

Design and implement a system where clients receive updates automatically whenever data in the database changes, without relying on frequent polling.

### Database Table: `orders`

| Column | Type | Description |
|---|---|---|
| `id` | SERIAL PRIMARY KEY | Auto-incremented unique ID |
| `customer_name` | VARCHAR(255) | Name of the customer |
| `product_name` | VARCHAR(255) | Name of the product ordered |
| `status` | VARCHAR(50) | One of: `pending`, `shipped`, `delivered` |
| `updated_at` | TIMESTAMPTZ | Timestamp of last change |

### Requirements Met

- ✅ Any `INSERT`, `UPDATE`, or `DELETE` on `orders` triggers a real-time notification to all clients
- ✅ Clients receive updates **without polling** — using WebSockets (Socket.IO)
- ✅ Working backend service (Node.js) that listens for DB changes and pushes them to clients
- ✅ Browser-based client that shows live order updates and a real-time event log
- ✅ Documentation explaining the approach, how to run, and why this method was chosen

---

## How It Works

```
┌────────────┐    REST API     ┌─────────────────────────────┐
│  Browser   │ ─────────────► │  Node.js + Express Backend  │
│  Client    │                │                             │
│            │ ◄───────────── │  1. Writes change to DB     │
│  (live UI) │   Socket.IO    │  2. PostgreSQL trigger fires │
└────────────┘   WebSocket    │  3. pg_notify() sends event  │
                              │  4. Backend broadcasts to    │
                              │     all connected clients    │
                              └──────────────┬──────────────┘
                                             │ LISTEN/NOTIFY
                                    ┌────────▼────────┐
                                    │   PostgreSQL 17  │
                                    │                  │
                                    │  orders table +  │
                                    │  trigger function│
                                    └─────────────────┘
```

**Step-by-step flow:**

1. A user creates/updates/deletes an order via the browser form (REST API call)
2. Node.js writes the change to PostgreSQL
3. A PostgreSQL **trigger** (`orders_change_trigger`) fires automatically on every `INSERT`, `UPDATE`, or `DELETE`
4. The trigger calls `pg_notify('orders_channel', payload)` with a JSON payload containing the operation type and row data
5. The backend has a **dedicated LISTEN connection** (`notificationService.js`) permanently subscribed to `orders_channel`
6. On receiving a notification, the backend **broadcasts** the event to all connected browsers via Socket.IO (WebSocket)
7. The browser updates the orders table and event log **instantly** — no polling, no delay

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| **Database** | PostgreSQL 17 | Native `LISTEN/NOTIFY` support; no extra message broker needed |
| **Backend** | Node.js 20 + Express.js | Non-blocking I/O; perfect for event-driven architecture |
| **Real-Time Transport** | Socket.IO (WebSocket) | Reliable bidirectional communication; automatic reconnection |
| **DB Change Detection** | PostgreSQL LISTEN/NOTIFY | Zero-overhead; triggers fire inside the DB transaction itself |
| **Frontend** | Vanilla HTML / CSS / JavaScript | Zero dependencies; served directly by the backend |

---

## Why LISTEN/NOTIFY + WebSockets? (Not Polling)

### The Problem with Polling

With polling, every client repeatedly asks the server "Did anything change?" on a fixed interval:

```
Client → Server: "Any changes?" → DB query → "No"   (wasted)
Client → Server: "Any changes?" → DB query → "No"   (wasted)
Client → Server: "Any changes?" → DB query → "Yes"  (finally useful)
```

| | Polling | LISTEN/NOTIFY + WebSocket |
|---|---|---|
| **Latency** | Up to poll interval (1–30 s) | Under 10 ms |
| **DB load at idle** | Constant (many queries) | Zero |
| **Server load** | Scales badly with more clients | Stays flat |
| **Bandwidth** | Wasted on empty responses | Only used when data changes |

**Example:** With 10,000 clients polling every 5 seconds → **2,000 requests/second** even when nothing changes.  
With LISTEN/NOTIFY, the load is **zero at idle** — the DB pushes events only when something actually changes.

### Why PostgreSQL LISTEN/NOTIFY Specifically?

- Built into PostgreSQL — no extra tools like Kafka, Redis, or Debezium needed
- The trigger fires **inside the database transaction**, so notifications are guaranteed to be consistent with committed data
- The Node.js `pg` library natively supports `LISTEN` on a persistent connection
- Keeps the architecture simple and easy to deploy

---

## Project Structure

```
order-notifications/
├── backend/
│   ├── server.js
│   ├── src/
│   │   ├── app.js
│   │   ├── config/
│   │   │   └── database.js
│   │   ├── routes/
│   │   │   └── orderRoutes.js
│   │   ├── controllers/
│   │   │   └── orderController.js
│   │   ├── services/
│   │   │   ├── orderService.js
│   │   │   └── notificationService.js
│   │   ├── middleware/
│   │   │   ├── logger.js
│   │   │   └── errorHandler.js
│   │   └── db/migrations/
│   │       └── 001_init.sql
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

## How to Run (Without Docker — Windows CMD)

### Prerequisites

- Node.js ≥ 20 ([nodejs.org](https://nodejs.org))
- PostgreSQL 17 installed and running as a Windows service

### Step 1 — Set up the Database

Open **Command Prompt** and run:

```cmd
set PGPASSWORD=postgres
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -c "CREATE DATABASE ordersdb;"
"C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -d ordersdb -f "backend\src\db\migrations\001_init.sql"
```

This creates the `orders` table, the trigger function, and inserts 1 sample row (Rohit — Wireless Headphones).

### Step 2 — Install Backend Dependencies

```cmd
cd backend
npm install
```

### Step 3 — Start the Backend

```cmd
npm start
```

You should see:
```
✅ Database connection successful
🚀 Server running on http://localhost:3000
📡 Socket.IO ready for connections
👂 Listening on PostgreSQL channel "orders_channel"
```

### Step 4 — Open the App

Open your browser and go to: **http://localhost:3000**

The backend also serves the frontend — no separate server needed.

---

## How to Run (Docker — One Command)

```bash
docker compose up --build
```

Then open: **http://localhost:3000**

---

## REST API Reference

| Method | Endpoint | Body | Description |
|---|---|---|---|
| `GET` | `/orders` | — | Fetch all orders |
| `POST` | `/orders` | `{ customer_name, product_name, status }` | Create a new order |
| `PUT` | `/orders/:id` | `{ customer_name?, product_name?, status? }` | Update an order |
| `DELETE` | `/orders/:id` | — | Delete an order |
| `GET` | `/health` | — | Health check |

**Example — Create an order:**
```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d "{\"customer_name\":\"Rohit\",\"product_name\":\"Keyboard\",\"status\":\"pending\"}"
```

**Example — Update status:**
```bash
curl -X PUT http://localhost:3000/orders/1 \
  -H "Content-Type: application/json" \
  -d "{\"status\":\"shipped\"}"
```

---

## Environment Variables (`backend/.env`)

```env
PORT=3000
NODE_ENV=development
LOG_LEVEL=info
DB_HOST=localhost
DB_PORT=5432
DB_NAME=ordersdb
DB_USER=postgres
DB_PASSWORD=postgres
CORS_ORIGIN=*
```
