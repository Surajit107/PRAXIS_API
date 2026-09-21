<p align="center">
  <img src="https://img.shields.io/badge/PraxisAPI-v1.3.1-0F172A?style=for-the-badge&labelColor=334155" alt="PraxisAPI version" />
</p>

<h1 align="center">PraxisAPI</h1>

<p align="center">
  <strong>Hands-on Express + PostgreSQL API platform</strong><br />
  Learn backend patterns · Prototype clients · Validate integrations
</p>

<p align="center">
  <a href="#features">Features</a> ·
  <a href="#tech-stack">Tech Stack</a> ·
  <a href="#quick-start">Quick Start</a> ·
  <a href="#docker">Docker</a> ·
  <a href="#api-surface">API Surface</a> ·
  <a href="#testing">Testing</a> ·
  <a href="#documentation">Docs</a> ·
  <a href="#support">Support</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-24-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Express-5-000000?style=flat-square&logo=express&logoColor=white" alt="Express" />
  <img src="https://img.shields.io/badge/PostgreSQL-17-4169E1?style=flat-square&logo=postgresql&logoColor=white" alt="PostgreSQL" />
  <img src="https://img.shields.io/badge/Drizzle-ORM-C5F74F?style=flat-square&logo=drizzle&logoColor=black" alt="Drizzle" />
  <img src="https://img.shields.io/badge/Socket.IO-4-010101?style=flat-square&logo=socketdotio&logoColor=white" alt="Socket.IO" />
  <img src="https://img.shields.io/badge/Jest-29-C21325?style=flat-square&logo=jest&logoColor=white" alt="Jest" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=flat-square" alt="License" />
</p>

---

## Overview

**PraxisAPI** is a production-shaped practice backend — not a toy CRUD demo. It ships multiple complete product domains (auth, ecommerce, social, realtime chat), public JSON datasets, cascading geo lookups, payment provider stubs, Swagger docs, Docker Compose, and a Jest suite that hits a real PostgreSQL database.

Use it when you need a stable local API to build frontends against, teach backend architecture, or exercise auth / payments / websockets without standing up five separate services.

| | |
| --- | --- |
| **Base path** | `/api/v1` |
| **Interactive docs** | Swagger UI at [`/`](http://localhost:8000/) |
| **Default host** | `http://localhost:8000` |
| **Feature catalog** | [`docs/FEATURES.md`](docs/FEATURES.md) |

---

## Features

### Application domains

| Domain | Highlights |
| --- | --- |
| **Auth** | Register / login, JWT access + refresh (cookie or Bearer), Google & GitHub OAuth, email verify, password reset, avatar upload, roles |
| **Todos** | Full CRUD with search & completion filters |
| **Ecommerce** | Categories, products, cart, coupons, addresses, orders, profiles |
| **Payments** | Stripe (PaymentIntent + webhook), Razorpay, PayPal — selectable via `DEFAULT_PAYMENT_PROVIDER` |
| **Social media** | Profiles, posts, comments, likes, follows, bookmarks |
| **Chat** | One-on-one & group chats, attachments, **Socket.IO** realtime events |

### Public & utility APIs

| Area | Highlights |
| --- | --- |
| **Public JSON** | Random users / products / jokes, books, quotes, meals, dogs, cats, stocks |
| **World datasets** | Companies, customers, employees, inventory, orders, tickets, invoices, shipments, transactions, projects, subscriptions, appointments |
| **Geo** | Cascading `countries → states → cities` with pagination (~150k cities) |
| **Kitchen sink** | HTTP methods, status codes, request/response inspection, cookies, redirects, images |
| **Ops** | Health / live / ready / version, seed routes, `DELETE /api/v1/reset-db` (dev only; preserves public JSON + geo) |

### Platform

- Drizzle migrations (CLI-generated — never hand-written)
- UUID primary keys exposed as `_id` in JSON
- Pagination shaped like `aggregatePaginate` responses
- Rate limiting, CORS, sessions, Passport, Winston + Morgan logging
- SQLSTATE → HTTP status mapping
- Resend + Mailgen for transactional email
- Docker Compose with Postgres healthcheck and migrate-on-boot

---

## Tech stack

```text
Runtime     Node.js 24 (see .nvmrc)
Framework   Express 5
Database    PostgreSQL 17 + Drizzle ORM
Realtime    Socket.IO
Auth        JWT · Passport (Google / GitHub)
Mail        Resend · Mailgen
Payments    Stripe · Razorpay · PayPal
Docs        Swagger UI + OpenAPI (src/swagger.yaml)
Tests       Jest · Supertest
```

---

## Quick start

### Prerequisites

- Node.js matching [`.nvmrc`](.nvmrc)
- PostgreSQL 17+ **or** Docker Desktop / Compose
- A copy of [`.env.example`](.env.example) filled with your secrets

### Install & run

```bash
# 1. Configure environment
cp .env.example .env
# Edit DATABASE_URL, JWT / session secrets, and optional Resend / OAuth / payment keys

# 2. Install dependencies
npm install

# 3. Apply schema
npm run db:migrate

# 4. Optional seeds (needed for public JSON + geo routes)
npm run db:seed:public
npm run db:seed:geo

# 5. Start the API (Nodemon)
npm start
```

Open **Swagger** at [http://localhost:8000](http://localhost:8000) and hit the API under `/api/v1`.

> **Security note:** Seed routes and `DELETE /api/v1/reset-db` only work when `NODE_ENV` is exactly `development`. Any other value returns `403`. `reset-db` truncates app tables only — it never touches `public_json_docs` or geo tables.

---

## Docker

Run the API and Postgres together:

```bash
cp .env.example .env
docker compose up --build
```

| Behavior | Detail |
| --- | --- |
| Healthgate | Backend waits until Postgres passes `pg_isready` |
| DB URL | Compose sets `DATABASE_URL=postgresql://praxisapi:praxisapi@postgres:5432/praxisapi` |
| Boot | `scripts/docker-boot.js` retries connect → migrates → `start:prod` |
| Host access | Published on `localhost:5432` / `localhost:8000` for local tools & Jest |

---

## API surface

All routes are versioned under `/api/v1`.

| Mount | Purpose |
| --- | --- |
| `/users` | Authentication & account management |
| `/todos` | Todo CRUD |
| `/ecommerce/*` | Catalog, cart, coupons, orders, profile |
| `/social-media/*` | Profiles, posts, social graph |
| `/chat-app/*` | Chats & messages (+ Socket.IO) |
| `/public/*` | JSON datasets, world resources, geo |
| `/kitchen-sink/*` | HTTP utility playground |
| `/seed/*` | Dev-only dataset seeders |
| `/healthcheck`, `/live`, `/ready`, `/version` | Health & metadata |

For the full endpoint matrix, see [`docs/FEATURES.md`](docs/FEATURES.md) and the Swagger UI.

---

## Scripts

<details>
<summary><strong>Server & database</strong></summary>

| Command | Description |
| --- | --- |
| `npm start` | Dev server with Nodemon |
| `npm run start:prod` | Node without Nodemon |
| `npm run start:docker` | Wait for Postgres → migrate → production start |
| `npm run db:generate` | Generate a Drizzle migration via CLI |
| `npm run db:migrate` | Apply pending migrations |
| `npm run db:drop-all` | Wipe public schema + Drizzle journal |
| `npm run db:seed:public` | Load public JSON collections |
| `npm run db:seed:geo` | Load world geo data (downloads CSC cache on first run) |
| `npm run json:generate:world` | Regenerate world JSON fixtures |

</details>

<details>
<summary><strong>Tests</strong></summary>

| Command | Scope |
| --- | --- |
| `npm test` | Full suite |
| `npm run test:auth` | Auth |
| `npm run test:todo` | Todos |
| `npm run test:ecommerce` | Ecommerce |
| `npm run test:payments` | Payments |
| `npm run test:social` | Social media |
| `npm run test:chat` | Chat |
| `npm run test:public` | Public + geo |
| `npm run test:ops` | Production guards |
| `npm run test:seeds` | Seeders |
| `npm run test:verification` | Mount / reset-db verification |
| `npm run test:unit` | Unit helpers |

</details>

---

## Testing

Jest talks to a **real** PostgreSQL database. Requirements:

1. `TEST_DATABASE_URL` is set  
2. It is **not** equal to `DATABASE_URL`  
3. The database name contains `test`

### Example (Compose Postgres)

```bash
# Create a throwaway DB
docker exec -it praxis-api-postgres \
  psql -U praxisapi -c "CREATE DATABASE praxisapi_test;"
```

```env
# .env
DATABASE_URL=postgresql://praxisapi:praxisapi@localhost:5432/praxisapi
TEST_DATABASE_URL=postgresql://praxisapi:praxisapi@localhost:5432/praxisapi_test
```

```bash
# Migrate the test DB, then run the suite
DATABASE_URL=postgresql://praxisapi:praxisapi@localhost:5432/praxisapi_test npm run db:migrate
npm test
```

---

## Project structure

```text
praxis-api/
├── drizzle/                 # Generated SQL migrations + journal
├── docs/                    # Feature catalog
├── scripts/                 # Boot, seeds, codegen, path aliases
├── src/
│   ├── apps/                # Domain models · routes · controllers (via path aliases)
│   ├── controllers/
│   ├── models/
│   ├── routes/
│   │   ├── apps/            # auth · todo · ecommerce · social · chat
│   │   ├── public/          # JSON datasets · geo · world resources
│   │   └── kitchen-sink/    # HTTP utilities
│   ├── middlewares/
│   ├── seeds/
│   ├── socket/              # Socket.IO handshake & events
│   ├── swagger.yaml         # OpenAPI document
│   └── index.js             # Process entry
├── tests/                   # Jest + Supertest
├── docker-compose.yml
└── package.json
```

Domain code is organized under `src/{models,routes,controllers}/apps/…`.

---

## Environment

Copy [`.env.example`](.env.example) and configure at least:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Application Postgres connection |
| `TEST_DATABASE_URL` | Isolated Jest database |
| `ACCESS_TOKEN_SECRET` / `REFRESH_TOKEN_SECRET` | JWT signing |
| `EXPRESS_SESSION_SECRET` | Session cookie secret |
| `CORS_ORIGIN` | Allowed browser origin(s) |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Outbound mail |
| `DEFAULT_PAYMENT_PROVIDER` | `stripe` \| `razorpay` \| `paypal` |
| `STRIPE_*` / `RAZORPAY_*` / `PAYPAL_*` | Payment credentials |
| `GOOGLE_*` / `GITHUB_*` | OAuth apps |

Stripe webhook endpoint: `POST {PRAXIS_API_HOST_URL}/stripe/webhook`.

---

## Documentation

| Resource | Link |
| --- | --- |
| Interactive OpenAPI | [http://localhost:8000](http://localhost:8000) (after `npm start`) |
| Feature checklist | [`docs/FEATURES.md`](docs/FEATURES.md) |
| Env template | [`.env.example`](.env.example) |

---

## Support

If you clone, fork, or use this project, please consider starring the repository, sharing it with others, and following the author on GitHub. That small bit of support helps keep the work visible and motivates continued improvements.

---

## License

Released under the [MIT License](LICENSE.txt). Copyright © 2026 Surajit Pal.
