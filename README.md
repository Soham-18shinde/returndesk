# ReturnDesk — Returns Management System

ReturnDesk is a full-stack application for an internal support team to create, review, and manage product return requests. It uses Next.js App Router, JavaScript, PostgreSQL, and Prisma.

## Project Links

- **Live application:** https://returndesk-seven.vercel.app/
- **GitHub repository:** https://github.com/Soham-18shinde/returndesk

The deployed application and its production database state should be verified independently. The presence of a migration in the repository does not establish that it has been applied to production.

## Features Implemented

- Create return requests with customer name and contact, order reference, item name, positive integer quantity, and a reason.
- Generate unique, human-readable references in the `RD-YYYY-NNNN` format.
- Search by customer name, order number, or return reference.
- Combine search with status and reason filters, allowlisted sorting, and server-side pagination.
- View request details and chronological notes.
- Append notes at any status without overwriting previous notes.
- Edit request details before a final decision.
- Enforce the return lifecycle: **Open → In Review → Approved → Completed**, or **In Review → Rejected**.
- Require a resolution when approving a request: Refund, Replacement, or Store Credit.
- Require a refund amount greater than zero for Refund; other resolutions cannot have a refund amount.
- Prevent duplicate active requests for the same order and item, using case-insensitive and whitespace-normalized comparisons.
- Allow a new request for the same order and item after the previous request is Rejected, Completed, or soft-removed.
- Soft-remove only Open or Rejected requests. Removed records remain in the database but are excluded from normal list and detail results.
- Display status counts and allow the request list to be filtered by selecting a status count.
- Provide loading, empty, validation, and server-error states in a responsive interface.

## Technology Stack

| Area | Technology |
|---|---|
| Frontend and backend | Next.js App Router, React, JavaScript |
| Styling | Tailwind CSS 4 and project CSS |
| API | Next.js Route Handlers |
| Database | PostgreSQL |
| ORM | Prisma |
| Database adapter | Prisma Neon adapter |
| Unit and integration tests | Node.js built-in test runner |
| Deployment | Vercel and Neon PostgreSQL |

## Requirements

- Node.js and npm
- Git
- A PostgreSQL database

The submitted deployment uses Neon. Another compatible PostgreSQL instance can be used for local development.

## Local Setup

### 1. Clone the repository

```bash
git clone https://github.com/Soham-18shinde/returndesk.git
cd returndesk
npm ci
```

### 2. Configure environment variables

Copy `.env.example` to `.env`.

In PowerShell:

```powershell
Copy-Item .env.example .env
```

Configure both database URLs with credentials for your own database:

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST-pooler/returndesk?sslmode=require"
DIRECT_URL="postgresql://USER:PASSWORD@HOST/returndesk?sslmode=require"
```

- `DATABASE_URL` is used by the runtime Prisma client and seed script.
- `DIRECT_URL` is used by Prisma migrations.

Replace the placeholders with your actual connection strings. Never commit `.env` or real credentials. The repository's `.gitignore` excludes environment files while allowing `.env.example`.

### 3. Generate Prisma Client, migrate, and seed

```bash
npm run db:generate
npm run db:migrate:deploy
npm run db:seed
```

`db:migrate:deploy` applies pending repository migrations to the database selected by the configured connection URLs. Use a clean local database when setting up a fresh instance.

The seed script is designed to be rerun. It creates or updates eligible sample requests and adds missing sample notes without resetting or deleting database records. Review `prisma/seed.js` before running it against a database containing data you care about.

#### Important migration note

The normalized order/item uniqueness migration checks for existing active duplicate groups using case-insensitive, whitespace-normalized comparisons. If conflicting groups exist, the migration stops and reports the number of duplicate groups instead of silently modifying or deleting records.

Resolve any conflicts intentionally before retrying the migration. Review migration SQL and verify the target database before applying migrations, especially in production.

Check migration status with:

```bash
npx prisma migrate status
```

Run this command against the intended database configuration. A migration file in the repository does not prove that production has applied it.

### 4. Start the application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## API Overview

All listed API routes return JSON. Errors use a machine-readable `error` object containing a code and message.

| Method and route | Purpose |
|---|---|
| `GET /api/returns` | List requests with search, filters, sorting, and pagination |
| `POST /api/returns` | Create a return request and generate its reference |
| `GET /api/returns/:identifier` | Retrieve a request by ID or reference, including notes |
| `PATCH /api/returns/:identifier` | Update eligible details, status, or resolution |
| `DELETE /api/returns/:identifier` | Soft-remove an eligible request |
| `POST /api/returns/:identifier/notes` | Append a note to a request |

The list endpoint supports these query parameters:

- `search`
- `status`
- `reason`
- `sortBy`
- `sortOrder`
- `page`
- `pageSize`

Sorting fields are allowlisted, and page size is limited to 100. Search, filtering, sorting, and pagination are applied on the server.

## Business Rules and Lifecycle

### Status transitions

- **Open:** A request can be submitted for review or removed.
- **In Review:** A request can be approved or rejected.
- **Approved:** A request can be completed.
- **Rejected:** A terminal status.
- **Completed:** A terminal status.

Invalid transitions are rejected by the application. Finalized requests cannot have their customer and item details edited, but notes can still be appended.

### Resolutions

Approval requires one of the following:

- **Refund:** A refund amount greater than zero is required.
- **Replacement:** A refund amount must not be supplied.
- **Store Credit:** A refund amount must not be supplied.

### Duplicate requests

Only one live request may exist for a given order and item combination. The database constraint normalizes capitalization and surrounding or repeated whitespace for comparisons. Rejected, Completed, and soft-removed requests do not block a new request for that order and item.

### Removal

Removal is a soft delete, not a permanent database deletion. Only Open and Rejected requests can be removed. Removed requests are excluded from normal list and detail results.

## Design Decisions

- **PostgreSQL and Prisma:** PostgreSQL provides persistent relational storage, while Prisma provides schema management, migrations, and database access.
- **Database-enforced uniqueness:** Duplicate prevention is enforced at the database level so concurrent requests cannot bypass the rule simply because application-level checks run at different times.
- **Normalized order/item comparison:** Case and whitespace differences should not allow duplicate live requests for the same order and item.
- **Explicit lifecycle transitions:** Status changes are validated against the allowed workflow rather than accepting arbitrary status updates.
- **Soft deletion:** Removed requests remain available in storage for record retention while disappearing from normal user-facing results.
- **Append-only notes:** Notes are added as separate records with timestamps so earlier notes are retained.
- **Server-side list operations:** Search, filters, sorting, and pagination run through the API to avoid loading the entire dataset into the browser.
- **Separate pooled and direct connections:** The runtime can use a pooled database connection, while migration commands use a direct connection.

## Assumptions

- ReturnDesk is an internal support-team tool, not a customer-facing online store.
- Each order/item combination can have only one active return request at a time.
- Rejected and Completed requests are terminal and release the order/item combination for a future request.
- Refund amounts must be positive when the selected resolution is Refund. Currency-specific formatting and payment processing are outside the current scope.
- Sample customer details and order references are fictional and intended for demonstration.
- The application is evaluated as a technical assignment; authentication and role-based permissions are not implemented.

## Sample Data

`prisma/seed.js` defines 30 sample requests across the five statuses and five reasons, with sample notes on some requests. It uses deterministic references and order data with a fixed date anchor.

The seed script does not reset, truncate, or delete database records. It avoids restoring soft-deleted requests and does not update locked details on finalized requests. Review the script before running it against an existing database.

## Tests

### Validation unit tests

These tests do not require a database:

```bash
node --test tests/return-validation.test.js
```

They cover request validation, lifecycle transitions, list-query validation, note input, and response/error helpers.

### Order/item uniqueness integration test

`tests/order-item-uniqueness.test.js` checks the PostgreSQL uniqueness constraint, including capitalization and whitespace variants, terminal and soft-deleted requests, and concurrent creation.

It requires `RETURNDESK_TEST_DATABASE_URL` to point to a **separate, disposable PostgreSQL database with the repository migrations already applied**. The test skips when the variable is absent and refuses to run if the test database identity matches `DATABASE_URL` or `DIRECT_URL`. It writes test rows, so never use production for this test.

In PowerShell, configure the test URL for the test process and run:

```powershell
$env:RETURNDESK_TEST_DATABASE_URL = "<isolated-test-database-url>"
node --test tests/order-item-uniqueness.test.js
```

Prepare the test database separately and apply migrations only to that isolated database. Do not accidentally point migration or test commands at production.

## Project Structure

```text
returndesk/
├── prisma/
│   ├── migrations/
│   ├── schema.prisma
│   └── seed.js
├── src/
│   ├── app/
│   │   ├── api/                 # Return and note route handlers
│   │   ├── returns/             # Create and detail pages
│   │   ├── globals.css
│   │   ├── layout.js
│   │   ├── page.js              # Dashboard
│   │   ├── return-details.js
│   │   ├── return-form.js
│   │   └── returns-dashboard.js
│   └── lib/                     # Prisma client, API helpers, validation
├── tests/
│   ├── return-validation.test.js
│   └── order-item-uniqueness.test.js
├── .env.example
├── package.json
└── prisma.config.mjs
```

## Available Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the production application |
| `npm run start` | Start the production server |
| `npm run lint` | Run ESLint |
| `npm run db:generate` | Generate Prisma Client |
| `npm run db:migrate` | Run `prisma migrate dev` |
| `npm run db:migrate:deploy` | Apply pending migrations |
| `npm run db:seed` | Run the configured seed script |
| `npx prisma migrate status` | Check migration status for the configured database |

## Deployment

The submitted application is hosted at [returndesk-seven.vercel.app](https://returndesk-seven.vercel.app/), and its source is available in the [GitHub repository](https://github.com/Soham-18shinde/returndesk).

For a deployment:

1. Configure `DATABASE_URL` and `DIRECT_URL` in the hosting environment.
2. Review the pending migrations and the target database state.
3. Apply migrations to the intended database.
4. Verify migration status independently.
5. Check the deployed pages and API routes.

The repository alone does not confirm current deployment availability or the migration state of the production database.

## Limitations and Future Improvements

- Authentication and role-based access control are not implemented.
- The API does not currently restrict access by support-team role.
- Automated coverage can be expanded with additional API and end-to-end tests.
- The uniqueness integration test requires a separately configured disposable PostgreSQL database and is not run by the validation unit-test command.

These items are limitations or possible future improvements, not implemented features.

## Development Time

**Approximate development time:** [15-16 hours.

This is an approximate total for implementation, debugging, testing, and documentation.

## Author

**Soham Shinde** — [GitHub Profile](https://github.com/Soham-18shinde)
