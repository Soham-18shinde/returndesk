# ReturnDesk

**A returns management system for online retail operations.**

ReturnDesk helps store staff manage customer return requests from creation through review, approval or rejection, and final resolution. It provides searchable request records, controlled status transitions, resolution tracking, and chronological notes.

## Live Demo

- **Application:** https://returndesk-seven.vercel.app/
- **GitHub Repository:** https://github.com/Soham-18shinde/returndesk

## Features

- **Returns dashboard:** Search by customer, order reference, or return reference.
- **Filtering and sorting:** Filter by status and reason, sort results, and navigate paginated results.
- **Create requests:** Record customer details, order reference, item, quantity, and reason.
- **Request details:** View and update eligible return requests.
- **Status workflow:** Enforce valid transitions between Open, In Review, Approved, Rejected, and Completed.
- **Resolution tracking:** Support Refund, Replacement, and Store Credit.
- **Chronological notes:** Append notes to maintain a history of updates.
- **Business-rule validation:** Validate operations on the server and enforce relevant constraints in the database.
- **Soft deletion:** Remove eligible requests without permanently deleting their records.
- **Seed data:** Populate the database with fictional demonstration requests and notes.

## Technology Stack

| Layer | Technology |
|---|---|
| Framework | Next.js App Router |
| Language | JavaScript |
| UI | React |
| Styling | Tailwind CSS |
| Database | PostgreSQL |
| ORM and migrations | Prisma |
| Database hosting | Neon |
| Database adapter | Prisma Neon adapter |
| Deployment | Vercel |

## Getting Started

### Prerequisites

Install Node.js, npm, Git, and create a PostgreSQL database. A Neon PostgreSQL database can be used for local development.

### 1. Clone the repository

```bash
git clone https://github.com/Soham-18shinde/returndesk.git
cd returndesk
```

### 2. Install dependencies

```bash
npm ci
```

`npm ci` installs the exact dependency versions recorded in `package-lock.json` and is the recommended clean-machine setup.

### 3. Configure environment variables

Copy `.env.example` to `.env` in the project root and replace the placeholders with connection strings for your own PostgreSQL database.

Configure both variables:

- `DATABASE_URL` — the runtime connection used by the application. For Neon, use the pooled endpoint (the hostname includes `-pooler`).
- `DIRECT_URL` — the direct, non-pooled connection used by Prisma migration commands.

Neon connection strings should require TLS (for example, with `sslmode=require`). Keep credentials private and never commit `.env`; `.env.example` contains placeholders only.

### 4. Generate the Prisma Client

```bash
npm run db:generate
```

### 5. Apply database migrations

```bash
npm run db:migrate:deploy
```

This applies the committed migrations to the configured database.

The `202610150001_normalized_live_order_item` migration checks for active order/item duplicates after trimming surrounding whitespace and ignoring capitalization. If any groups are found, its preflight stops before replacing the existing exact-match index. Resolve those conflicts through an approved data-management decision, then rerun the migration; the migration does not clean or rewrite request records.

### 6. Seed demonstration data

```bash
npm run db:seed
```

The seed script prepares sample return requests and notes. Review `prisma/seed.js` before running it against a database containing data you need to preserve.

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the application for production |
| `npm run start` | Start the production server after building |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate the Prisma Client |
| `npm run db:migrate` | Create and apply a development migration |
| `npm run db:migrate:deploy` | Apply committed migrations |
| `npm run db:seed` | Seed demonstration data |
| `node --test tests/return-validation.test.js` | Run return-validation unit tests |
| `node --test tests/order-item-uniqueness.test.js` | Run database-backed duplicate-prevention tests against an isolated database |

## Return Request Workflow

```text
Open
  └── In Review
        ├── Approved
        │     └── Completed
        └── Rejected
```

Rejected and Completed are terminal statuses. Unsupported status transitions are rejected.

### Resolution rules

Approval requires a resolution:

- **Refund:** Requires a positive refund amount.
- **Replacement:** Must not include a refund amount.
- **Store Credit:** Must not include a refund amount.

### Additional business rules

- Every request receives a unique, human-readable reference.
- Only one active request may exist for the same order and item.
- A new request for that order and item is permitted after the previous request reaches Rejected or Completed.
- Customer and item details become locked after approval, rejection, or completion.
- Notes remain append-only and can be added throughout the request lifecycle.
- Only Open and Rejected requests may be removed.
- Removal uses soft deletion, and deleted requests are excluded from normal list and detail access.

## API Overview

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/returns` | List, search, filter, sort, and paginate requests |
| `POST` | `/api/returns` | Create a request |
| `GET` | `/api/returns/:identifier` | Retrieve a request |
| `PATCH` | `/api/returns/:identifier` | Update an eligible request or its status |
| `DELETE` | `/api/returns/:identifier` | Soft-delete an eligible request |
| `POST` | `/api/returns/:identifier/notes` | Append a note |

The route handlers validate input and return structured JSON responses for errors. Business rules are enforced server-side rather than relying only on frontend validation.

## Design Decisions

**PostgreSQL and Prisma:** Relational storage keeps request data consistent, while Prisma provides schema management and migration tooling.

**Server-side business rules:** The API and database enforce critical constraints so that invalid operations cannot be accepted simply by bypassing the interface.

**Explicit status transitions:** A defined lifecycle prevents arbitrary changes to request status.

**Append-only notes:** Keeping notes as a chronological history avoids overwriting previous updates.

**Soft deletion:** Eligible records are marked as deleted instead of being physically removed.

**Seeded demonstration data:** Sample requests make it easier to evaluate dashboard filters, statuses, and detail views without manually entering every record.

## Assumptions and Scope

- ReturnDesk is an internal returns-management tool, not a customer-facing e-commerce storefront.
- Order and item details are entered manually; external order-management integration is outside the current scope.
- Refund amounts are recorded in the approval workflow. The application does not independently retrieve order prices from an external system.
- Seeded customers, orders, and requests are fictional demonstration data.
- Database credentials and deployment-specific settings are supplied through environment variables.
- Authentication, payment execution, and integration with a live fulfilment system are outside the implemented assignment scope.

## Project Structure

```text
returndesk/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── returns/
│   │   ├── returns/
│   │   ├── page.js
│   │   ├── return-form.js
│   │   ├── return-details.js
│   │   └── returns-dashboard.js
│   └── lib/
│       ├── prisma.js
│       ├── return-api.js
│       └── return-validation.js
├── tests/
│   ├── return-validation.test.js
│   └── order-item-uniqueness.test.js
├── .env.example
├── prisma.config.mjs
└── package.json
```

## Testing and Verification

Run the validation unit tests:

```bash
node --test tests/return-validation.test.js
```

Run lint checks and a production build:

```bash
npm run lint
npm run build
```

The duplicate-prevention integration suite writes uniquely named synthetic requests. Run it only against a disposable PostgreSQL test database with all migrations applied. Set `RETURNDESK_TEST_DATABASE_URL` to that database before running the command; the test refuses to run if it identifies the same database as `DATABASE_URL` or `DIRECT_URL`. The suite can leave terminal test rows behind, so use a disposable database or branch and discard it after testing. It is skipped when the variable is not set.

Before saying the normalized duplicate fix is live in a deployment, verify that `202610150001_normalized_live_order_item` is applied in that deployment's database. Run `npx prisma migrate status` with that deployment's environment and confirm the migration appears as applied; a successful application deployment by itself does not confirm the database migration ran.

**Current production status (last checked 2026-10-15):** the last read-only check found only `202610140001_init` applied and one normalized active duplicate group containing two requests. The normalized migration is still pending there and its preflight will stop until that conflict is resolved. No production request records were changed. Recheck status before release.

Unit tests and build checks are useful safeguards, but they do not replace integration testing against a configured PostgreSQL database or end-to-end testing of the deployed application.

## Known Limitations and Future Improvements

- Add automated API integration and end-to-end tests.
- Add authentication and role-based access control before using the application with real customer data.
- Integrate with an external order-management system.
- Connect approved refunds and replacements to real fulfilment or payment providers.

## Author

**Soham Shinde**

GitHub: https://github.com/Soham-18shinde

**Approximate development time:** 14–15 hours, including implementation, database setup, testing, deployment, and documentation.
