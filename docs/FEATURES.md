# PraxisAPI — Feature List

Hands-on Express + PostgreSQL API platform for learning, prototyping, and integration tests.

**Stack:** Express 5 · Drizzle ORM · PostgreSQL · Socket.IO · Resend · Jest  
**Docs UI:** Swagger at `/` · Base path `/api/v1`

---

## F0 — Platform foundation

- Express app with CORS, rate limit, sessions, Passport, Morgan, cookie parser
- Path aliases `@/*` → `src/*`
- PostgreSQL via `DATABASE_URL` + Drizzle schemas / migrations (`drizzle/`)
- UUID primary keys exposed as `_id` in JSON (`serializers`)
- Pagination helper with `aggregatePaginate`-compatible response shape
- Auth plumbing: JWT middleware, Passport Google/GitHub, Socket.IO handshake
- `DELETE /api/v1/reset-db` — truncate app data (keeps schema, migration journal, `public_json_docs`, geo tables)
- `npm run db:drop-all` — full schema wipe for re-migrate
- Health endpoints: `/healthcheck`, `/live`, `/ready`, `/version`
- Kitchen-sink utilities (HTTP methods, status codes, request/response inspection, cookies, redirect, image)
- Jest + supertest harness (`TEST_DATABASE_URL` required)

---

## F1 — Auth + Todos

### Auth (`/api/v1/users`)

- Register / login / logout
- Access + refresh tokens (cookie **or** `Authorization: Bearer`)
- Refresh-token rotation
- Current user
- Email verify + resend
- Forgot / reset password
- Change password
- Avatar upload
- Assign role (admin)
- Google / GitHub OAuth
- User-create side-effects: ecommerce profile + cart + social profile (transactional)

### Todos (`/api/v1/todos`)

- CRUD
- Filters: `?query=` (title), `?complete=`
- Seed: `POST /api/v1/seed/todos`

---

## F2 — Ecommerce

Mounts under `/api/v1/ecommerce/*`:

- Categories — CRUD + paginate
- Products — CRUD + paginate + `mainImage` / `subImages[]`
- Addresses — CRUD + paginate
- Cart — get / add / remove / clear + nested product items
- Coupons — admin CRUD + apply / remove
- Orders — create, status, admin list, address snapshot, line items
- Profile — get / update + my orders

Seed: `POST /api/v1/seed/ecommerce` (runs user seed first)

---

## F3 — Social media

Mounts under `/api/v1/social-media/*`:

- Profile — get / update + cover image + account join
- Posts — CRUD + images + like / comment / bookmark counts + flags
- Comments — CRUD + paginate
- Likes — post & comment
- Follow — follow / unfollow + followers / following paginate
- Bookmarks — bookmark / unbookmark + bookmarked posts paginate

Seed: `POST /api/v1/seed/social-media` (runs user seed first)

---

## F4 — Chat app

Mounts under `/api/v1/chat-app/*`:

- Chats — one-on-one / group / rename / participants / leave / delete
- Messages — send / list / delete + attachments
- Socket.IO realtime events

Seed: `POST /api/v1/seed/chat-app` (runs user seed first)

---

## F5 — Public JSON APIs

Mounts under `/api/v1/public/*` (Postgres `public_json_docs`):

- Legacy: randomusers, randomproducts, randomjokes, books, quotes, meals, dogs, cats, stocks
- World: companies, customers, employees, inventory, orders, tickets, invoices, shipments, transactions, projects, subscriptions, appointments

Each resource follows the same pattern: `GET /`, `GET /:id`, `GET /…/random` (+ `?query=` / `?page=` / `?limit=` / `?inc=`).

Requires: `npm run db:seed:public`  
Regenerate world JSON: `npm run json:generate:world`

**YouTube:** controllers exist (static JSON under `src/json/youtube/`); route intentionally **unmounted** (third-party copyrighted payloads).

---

## F6 — Mail / Env / Docker / Ops

- Outbound mail via **Resend** + mailgen templates
- Dev-only guards: all `/api/v1/seed/*` + `reset-db` blocked outside `NODE_ENV=development`
- Docker Compose: API + Postgres healthcheck + migrate-on-boot
- Seed credentials: `GET /api/v1/seed/generated-credentials`

---

## F7 — Payments

Providers (all wired; default via `DEFAULT_PAYMENT_PROVIDER`):

- **Stripe** — PaymentIntent + webhook (`POST /stripe/webhook`)
- **Razorpay** — create + verify
- **PayPal** — create + verify

Post-payment side-effects: stock decrement, coupon usage, cart clear

---

## F8 — Errors / indexes / cleanup

- SQLSTATE → HTTP mapping (unique / FK / bad input → 400)
- Production indexes for filter / sort / lookup patterns
- No mongoose-style model APIs in runtime paths

---

## F9 — Seeds + verification

### Seed order

| Route | Order |
|---|---|
| `POST /api/v1/seed/todos` | todos only |
| `POST /api/v1/seed/ecommerce` | users → ecommerce |
| `POST /api/v1/seed/social-media` | users → social |
| `POST /api/v1/seed/chat-app` | users → chat |

### Nested response shapes

| Field | Source tables |
|---|---|
| `user.avatar` | `users.avatar_*` |
| `product.mainImage` / `subImages[]` | `products` + `product_sub_images` |
| `cart.items[]` | `carts` + `cart_items` (+ products) |
| `order.items` + address | `ecom_orders` + `ecom_order_items` |
| `socialProfile.coverImage` | `social_profiles.cover_image_*` |
| `post.images[]` | `social_posts` + `social_post_images` |
| `chat.participants` | `chats` + `chat_participants` |
| `message.attachments[]` | `chat_messages` + `chat_message_attachments` |

### Test scripts

```bash
npm test
npm run test:unit | test:health | test:todo | test:auth
npm run test:ecommerce | test:payments | test:social | test:chat
npm run test:public | test:ops | test:seeds | test:verification
```

---

## F10 — Geo APIs

Mounts under `/api/v1/public/geo/*` (Postgres tables, not `public_json_docs`):

| Route | Filter | Notes |
|---|---|---|
| `GET /countries` | optional `?q=` | ISO countries (~250) |
| `GET /states?countryCode=` | **required** `countryCode` (ISO2), optional `?q=` | States / provinces for a country |
| `GET /cities?stateId=` | **required** `stateId`, optional `?q=` | Cities for a state |

- Cascading form pattern: country → states → cities
- Pagination: `?page=` + `?limit=` (SQL `LIMIT`/`OFFSET`, never full-table load)
- Storage: `geo_countries` / `geo_states` / `geo_cities` with parent FKs + indexes
- Dataset: world admin cities (~150k) from [countries-states-cities-database](https://github.com/dr5hn/countries-states-cities-database) (no county layer)
- Seed: `npm run db:seed:geo` (downloads CSC nested JSON.gz into a gitignored cache, then upserts)
- Tests use a tiny in-repo fixture — not the world dump

---

## Quick commands

```bash
npm run db:generate
npm run db:migrate
npm run db:drop-all && npm run db:migrate
npm run db:seed:public
npm run db:seed:geo
npm start
```
