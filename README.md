# SynChef

**Cook the world, together.** SynChef is a web platform for real-time, step-by-step cooking,
live cook-along sessions with friends, and exploration of 822 recipes across a 196-country Flavor Map.
One responsive, installable web app (desktop, tablet, Android and iOS browsers) backed by a
Spring Boot API.

| Capability | What it does |
|---|---|
| Real-time cooking | Server-authoritative cooking sessions: focused step view, synced timers (survive reloads and device switches), progress saved automatically, alerts when a timer finishes, screen kept awake. |
| Cook together | Share a 6-letter code; everyone in the kitchen sees the same step and timers live, with presence, an activity feed and host hand-over. |
| Global gastronomy | 822 recipes (29 curated with cultural context + 792 from TheMealDB) with real photos and source links; all 196 countries on a 3D Flavor Map; scaling, search and filters by region, country, difficulty and time. |
| Community kitchen | Share your own dishes (public/private), live comments, reporting with a full moderation and appeal workflow. |
| Admin console | Live platform stats, report queue, user management with guard rails, comment moderation, 30-day analytics. |

## Project structure

```
backend/    Spring Boot API (Java 17, Maven)
frontend/   React + TypeScript web app (Vite), plus docker-compose.yml for the full stack
README.md
```

## Architecture

```
Browser (React 18 + TypeScript SPA, PWA)
   │  same origin: /api (REST, JSON)   /ws (STOMP over WebSocket)   /uploads
   ▼
nginx (prod) / Vite dev proxy (dev)
   ▼
Spring Boot 3.3 API (Java 17) ── Spring Security (HttpOnly session cookie + CSRF), JPA/Hibernate
   ▼
PostgreSQL
```

* **Backend** — `backend/`: controllers → services → repositories, DTO boundaries, global error
  handling, server-side sessions, role-based authorization, STOMP broker with per-subscription
  authorization, idempotent data migrations.
* **Frontend** — `frontend/`: Vite + React + TypeScript, feature modules, design tokens,
  CSS modules, one shared real-time connection, route-level code splitting, service worker.
* **Mobile** — the former native Android app (`mobile/`, Kotlin/Gradle) has been **retired**.
  Every screen it offered exists in the responsive web app, which can be installed to the home
  screen. The code remains available in git history (commit `4f8528f` and earlier).

## Quick start (local development)

Prerequisites: Java 17+, Maven 3.9+, Node 20+, PostgreSQL 14+.

```bash
# 1. Backend — configure secrets once
cd backend
cp .env.example .env          # set SPRING_DATASOURCE_* (and optionally APP_ADMIN_*, GOOGLE_CLIENT_ID)
mvn spring-boot:run           # http://localhost:8080 — schema, catalogue and migrations apply on start

# 2. Frontend
cd ../frontend
npm install
npm run dev                   # http://localhost:3000 (proxies /api, /ws, /uploads to :8080)
```

> After pulling this version, **restart** any running `npm run dev` — the Vite config moved to
> `vite.config.ts` (adds the `@/` import alias). Previously issued logins are not carried over:
> sign in again (credentials are now an HttpOnly cookie, not a token in localStorage).

Bootstrap an administrator by setting `APP_ADMIN_EMAIL` and `APP_ADMIN_PASSWORD` (≥ 12 chars)
in `backend/.env` before starting the API.

### Docker (full stack)

```bash
cd frontend
cp .env.example .env          # set POSTGRES_PASSWORD at least
docker compose up --build     # http://localhost:3000
```

## Quality gates

| Command | What runs |
|---|---|
| `cd backend && mvn verify` | 49 unit + integration tests (auth, CSRF, authorization, catalogue, community, cooking sessions, migrations) on in-memory H2 |
| `cd frontend && npm run lint` | ESLint (TypeScript + React hooks), zero warnings allowed |
| `npm run typecheck` | `tsc` in strict mode (`noUncheckedIndexedAccess`) |
| `npm test` | Vitest + Testing Library (27 tests, incl. "no credentials in Web Storage") |
| `npm run build` | type-check + production build |

## Data sources

Recipes come from SynChef's own curated set and [TheMealDB](https://www.themealdb.com/); recipe
pages link to their source. The globe's Earth textures are the three.js example textures (MIT).
