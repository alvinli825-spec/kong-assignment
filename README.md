# Services API

A read-focused API for the organization's service catalog. It backs the dashboard
widget from the user story: each card shows a service's name, description and the
number of versions available, with search, sorting and pagination; a card links
through to the full service, including its versions.

Built with **Node.js 20**, **NestJS 9**, **TypeORM 0.3**, **PostgreSQL 15** and
**TypeScript**.

## Quick start

Requirements: Node.js 20 (`.nvmrc` provided), Docker.

```bash
# 1. Start PostgreSQL 15 (also creates the e2e test database)
docker compose up -d

# 2. Install and configure
npm install
cp .env.example .env

# 3. Create the schema and load sample data
npm run migration:run
npm run seed

# 4. Run
npm run start:dev
```

The API is now available at `http://localhost:3000`, with interactive OpenAPI
docs at `http://localhost:3000/docs`.

```bash
curl -H "Authorization: Bearer reader-token" \
  "http://localhost:3000/v1/services?q=payments&sort=name&order=asc&page=1&limit=10"
```

## API overview

All `/v1` routes require a bearer token (see [Authentication](#authentication)).

| Method | Path | Role | Description |
|--------|------|------|-------------|
| GET | `/health` | public | Liveness check |
| GET | `/v1/services` | reader | List services (filter, sort, paginate) |
| GET | `/v1/services/:id` | reader | Fetch one service, versions included |
| GET | `/v1/services/:id/versions` | reader | Fetch a service's versions |
| POST | `/v1/services` | admin | Create a service |
| PATCH | `/v1/services/:id` | admin | Update a service |
| DELETE | `/v1/services/:id` | admin | Delete a service (cascades versions) |
| POST | `/v1/services/:id/versions` | admin | Add a version |
| PATCH | `/v1/services/:id/versions/:versionId` | admin | Update a version |
| DELETE | `/v1/services/:id/versions/:versionId` | admin | Delete a version |

### Listing: filtering, sorting, pagination

`GET /v1/services` accepts:

| Param | Default | Constraints | Behavior |
|-------|---------|-------------|----------|
| `q` | — | ≤ 255 chars | Case-insensitive substring match on name **or** description. `%`, `_` and `\` are escaped, so they match literally. |
| `sort` | `name` | `name` \| `createdAt` \| `updatedAt` | Whitelisted sort fields only |
| `order` | `asc` | `asc` \| `desc` (case-insensitive) | |
| `page` | `1` | integer ≥ 1 | |
| `limit` | `10` | integer 1–100 | Capped to protect the database |

Response shape:

```json
{
  "data": [
    {
      "id": "…",
      "name": "Payments",
      "description": "Processes card payments…",
      "versionCount": 3,
      "createdAt": "…",
      "updatedAt": "…"
    }
  ],
  "meta": { "page": 1, "limit": 10, "total": 12, "totalPages": 2 }
}
```

`versionCount` is what the card renders ("3 versions"); the full version objects
are intentionally not embedded in the list to keep pages small. Results are
secondarily ordered by `id` so pagination is stable when the sort field ties.

Invalid parameters (unknown sort field, `limit` > 100, non-integer `page`,
malformed UUIDs, …) return `400` with a descriptive message. Unknown services
return `404`.

## Authentication

Requests authenticate with `Authorization: Bearer <token>`. Two static tokens are
configured via environment variables (see `.env.example`):

- `API_READER_TOKEN` — read-only access (all GET endpoints)
- `API_ADMIN_TOKEN` — full access, including CRUD

Missing or unknown tokens get `401`; a reader token on a mutation gets `403`.
`/health` and `/docs` are public.

This is deliberately the simplest scheme that demonstrates authn + role-based
authz end-to-end. In production I would replace it with OIDC/JWT (or Kong's own
key-auth/OIDC plugins at the gateway) with per-user identities, token expiry and
rotation — the guard/role structure would stay the same.

## Data model

```
service                          service_version
─────────────────────            ─────────────────────
id          uuid PK              id          uuid PK
name        varchar(255)         service_id  uuid FK → service (ON DELETE CASCADE)
description text                 name        varchar(100)
created_at  timestamptz          description text
updated_at  timestamptz          created_at  timestamptz
                                 updated_at  timestamptz
```

A service has many versions. Versions are modeled as their own table (not an
array column) so they can carry metadata and grow independently. The schema is
managed by hand-written TypeORM migrations — `synchronize` is disabled
everywhere.

## Testing

```bash
npm test          # unit tests (query building, guard logic, controller wiring)
npm run test:e2e  # integration tests over HTTP against real Postgres
npm run lint      # eslint + prettier
```

The e2e suite runs against a dedicated `kong_services_test` database (created by
the docker-compose init script) so it can never touch development data. It boots
the full application — global guard, validation pipes, versioned routes — runs
migrations, loads fixtures and exercises every endpoint, including edge cases:
wildcard escaping in search, pagination stability across pages, version ordering,
cascade deletes, auth failures, cross-service version access and validation
errors.

## Design considerations & trade-offs

- **Offset pagination** (`page`/`limit`) fits a dashboard widget with page
  controls and gives a cheap `total` for "N of M". For very large catalogs or
  infinite scroll, cursor (keyset) pagination would be the next step.
- **`ILIKE '%…%'` search** is simple and correct at catalog scale (hundreds to
  thousands of services). It can't use a btree index; at larger scale I'd add a
  `pg_trgm` GIN index or move to `tsvector` full-text search without changing
  the API contract.
- **`versionCount` via a relation-count subquery** (TypeORM
  `loadRelationCountAndMap`) avoids both N+1 queries and shipping full version
  lists on every card.
- **Validation at the edge**: DTOs + a global `ValidationPipe`
  (`whitelist: true, transform: true`) mean handlers only ever see typed,
  bounded input; unknown body fields are silently stripped.
- **Read model = entity**: responses serialize the entities directly. There is
  no field to hide today; if the model grew sensitive fields I'd introduce
  explicit response DTOs / `class-transformer` serialization.
- **Sort fields are an enum whitelist** mapped to entity properties — user input
  is never interpolated into SQL. Search terms are always bound as parameters.
- **URI versioning (`/v1`)** so the widget contract can evolve without breaking
  existing consumers.

## Assumptions

- "Versions available" on the card means the **count** is enough for the list
  view; full version details are served by the detail endpoints.
- Service names are not required to be unique — nothing in the story demands it,
  and organizations often have same-named services in different contexts. A
  unique constraint would be a one-line migration if the product decides
  otherwise.
- "Navigate to a given service" needs a stable identifier in every list item;
  clients use `id` to fetch `/v1/services/:id`.
- Version ordering: newest first (`created_at DESC`), which matches how a
  changelog is typically read. Semver-aware ordering was deliberately avoided —
  version names are free-form text (e.g. `beta-2`).
- Deleting a service deletes its versions (a version has no meaning without its
  service).

## Project structure

```
src/
├── auth/                 # bearer-token guard, @Roles / @Public decorators
├── config/               # typed configuration factory
├── database/
│   ├── data-source.ts    # shared DataSource (app CLI + migrations + seed)
│   ├── migrations/
│   └── seeds/
├── health/
├── services/
│   ├── dto/              # request validation + response shapes (Swagger)
│   ├── entities/
│   ├── services.controller.ts
│   ├── services.service.ts
│   └── services.module.ts
├── app.module.ts
├── main.ts
└── setup-app.ts          # shared app config (prefix, pipes) for main + e2e
```

## Possible next steps

Rate limiting, request logging/tracing, CI pipeline, cursor pagination,
`pg_trgm` search index, response DTO layer, soft deletes with audit history,
OIDC-based auth.
