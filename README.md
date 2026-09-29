# Pricewatch — price drop detector

A full-stack app for tracking product prices and knowing the moment one drops
to your target. JWT-authenticated REST API + SQLite database on the backend,
a plain HTML/CSS/JS dashboard on the frontend.

## Stack

- **Backend:** Node.js, Express, better-sqlite3, JWT (jsonwebtoken), bcryptjs
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Data format:** JSON over REST

## Project structure

```
price-detector/
├── backend/
│   ├── src/
│   │   ├── db.js                  # SQLite schema + connection
│   │   ├── server.js              # Express app entry point
│   │   ├── middleware/auth.js     # JWT verification middleware
│   │   ├── routes/auth.routes.js  # register / login / me
│   │   └── routes/products.routes.js  # CRUD + price history
│   ├── package.json
│   └── .env.example
└── frontend/
    ├── index.html
    ├── css/style.css
    └── js/app.js
```

## Running it

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env      # then edit JWT_SECRET to a long random string
npm start
```

The API starts on `http://localhost:4000` and creates `price_detector.db`
(SQLite file) automatically on first run.

### 2. Frontend

The frontend is static — open `frontend/index.html` directly in a browser,
or serve it with any static file server, e.g.:

```bash
cd frontend
npx serve .
```

It expects the API at `http://localhost:4000/api` (see `API_BASE` at the top
of `js/app.js` if you need to change that).

> Note: the JWT is kept in memory in the browser tab, not in localStorage —
> refreshing the page signs you out. That's a deliberate simplification for
> this demo; a production build would add refresh tokens or an httpOnly
> session cookie instead.

## API reference

All responses are JSON. Protected routes require `Authorization: Bearer <token>`.

| Method | Path                          | Auth | Description                              |
|--------|-------------------------------|------|-------------------------------------------|
| POST   | `/api/auth/register`          | –    | Create an account, returns a token        |
| POST   | `/api/auth/login`             | –    | Log in, returns a token                   |
| GET    | `/api/auth/me`                | ✅   | Current user info                         |
| GET    | `/api/products`                | ✅   | List your tracked products                |
| POST   | `/api/products`                | ✅   | Start tracking a new product              |
| GET    | `/api/products/:id`            | ✅   | Get one product + full price history      |
| PUT    | `/api/products/:id`            | ✅   | Update name / url / target price          |
| DELETE | `/api/products/:id`            | ✅   | Stop tracking a product                   |
| POST   | `/api/products/:id/prices`     | ✅   | Log a new observed price (a "check")      |
| GET    | `/api/products/:id/prices`     | ✅   | Full price history for one product        |

### Example: register + add a product

```bash
curl -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"you@example.com","password":"a-strong-password"}'
# -> { "token": "...", "user": { "id": 1, "email": "you@example.com" } }

curl -X POST http://localhost:4000/api/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <token>" \
  -d '{"name":"Sony WH-1000XM5","targetPrice":249,"currentPrice":329}'
```

Each time you log a new price with `POST /api/products/:id/prices`, the
response includes `droppedToTarget: true/false` so a client can trigger an
alert the moment a price hits the target.

## Design notes

This build tracks prices you (or a script you write) report in — it does not
scrape retailer websites itself, since that depends on each site's terms of
service and page structure. To make it live, you'd add a scheduled job that
fetches a price from each product's `url` and calls
`POST /api/products/:id/prices` automatically.

## Extending it

- Add email/push notifications on `droppedToTarget`
- Add a scraper/cron worker per retailer
- Add refresh tokens for longer sessions
- Add pagination on `GET /api/products` for large lists
