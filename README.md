# ReturnDesk

ReturnDesk is a returns management application for an online store. It provides a centralized interface for staff to create, review, approve, reject, and track return requests while maintaining a history of notes and request updates.

## Live Application

**Deployment URL:** Pending deployment.

**GitHub Repository:** https://github.com/Soham-18shinde/returndesk

## Features

- **Returns dashboard:** Browse return requests with search, status and reason filters, sorting, and server-side pagination.
- **Create requests:** Record customer details, order reference, item, quantity, and return reason.
- **Request details:** View an individual return request and its chronological notes.
- **Status management:** Move requests through the supported return lifecycle.
- **Resolution management:** Record a refund, replacement, or store credit when approving a request.
- **Notes:** Append notes to maintain a chronological record of updates.
- **Validation:** Validate incoming data and return structured API errors.
- **Soft deletion:** Remove eligible requests without permanently deleting their records.
- **Demonstration data:** Seed the database with sample requests across different statuses and reasons.

## Technology Stack

- **Framework:** Next.js App Router
- **Language:** JavaScript
- **Frontend:** React
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL
- **ORM and migrations:** Prisma
- **Database hosting:** Neon
- **Database adapter:** Prisma Neon adapter

## Prerequisites

Before setting up the project, install:

- Node.js and npm
- Git
- Access to a PostgreSQL database, such as a Neon database

## Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/Soham-18shinde/returndesk.git
cd returndesk
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env` file in the project root using `.env.example` as the template.

Configure the following variables:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL pooled connection string used by the application |
| `DIRECT_URL` | Direct PostgreSQL connection string used for database migration operations |

Use the appropriate connection strings for your own database. For Neon, the pooled connection string and direct connection string can be obtained from the database connection settings.

Do not commit `.env` or expose database credentials. The committed `.env.example` contains placeholders rather than real credentials.

### 4. Generate the Prisma Client

```bash
npm run db:generate
```

### 5. Apply database migrations

```bash
npm run db:migrate:deploy
```

This applies the committed Prisma migrations to the configured database. It prepares the database schema without creating a new development migration.

### 6. Seed the database

```bash
npm run db:seed
```

The seed script populates the database with demonstration return requests and notes.

The seed implementation is designed to handle existing sample records. Review `prisma/seed.js` before running it against a database containing data you need to preserve.

### 7. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Available Commands

| Command | Description |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Create a production build |
| `npm run start` | Start the production server after building |
| `npx eslint .` | Run ESLint checks |
| `npm run db:generate` | Generate the Prisma Client |
| `npm run db:migrate` | Create and apply development migrations |
| `npm run db:migrate:deploy` | Apply committed database migrations |
| `npm run db:seed` | Seed the database with demonstration data |
| `node --test tests/return-validation.test.js` | Run return-validation unit tests |

## Return Request Lifecycle

The supported workflow is:

```text
Open
  └── In Review
        ├── Approved
        │     └── Completed
        └── Rejected
```

Rejected and Completed requests are terminal states.

Approval requires a resolution:

- **Refund:** Requires a positive refund amount.
- **Replacement:** Must not include a refund amount.
- **Store Credit:** Must not include a refund amount.

Invalid status transitions and invalid resolution combinations should be rejected by the application.

## Business Rules

The application implements the return-management rules defined for the assignment:

- A return request has a unique, human-readable reference.
- A new live request cannot be created for the same order and item while an existing request for that pair remains active.
- A new request for the same order and item may be created after the previous request reaches Rejected or Completed.
- Customer and item details become locked after a request is Approved, Rejected, or Completed.
- Notes can be added throughout the request lifecycle.
- Only Open and Rejected requests can be removed.
- Removal is handled through soft deletion, and removed requests are excluded from normal list and detail access.
- Status changes must follow the supported lifecycle.
- Approval requires a valid resolution and the corresponding refund-amount rules.

These rules are enforced through the application's validation and database implementation, as applicable.

## API Overview

The application exposes the following route handlers:

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/returns` | List and search return requests |
| `POST` | `/api/returns` | Create a return request |
| `GET` | `/api/returns/:identifier` | Retrieve a request |
| `PATCH` | `/api/returns/:identifier` | Update an eligible request or change its status |
| `DELETE` | `/api/returns/:identifier` | Soft-delete an eligible request |
| `POST` | `/api/returns/:identifier/notes` | Append a note to a request |

The API validates incoming data and returns structured errors for invalid requests. The frontend communicates with these route handlers rather than directly modifying database records.

## Design Decisions

### PostgreSQL and Prisma

PostgreSQL provides persistent relational storage for return requests and related records. Prisma provides the database access layer and migration tooling.

### Server-side validation

Validation is performed on the server so that business rules do not depend solely on frontend controls. Invalid data and unsupported operations must be rejected even when a request is sent directly to the API.

### Explicit status transitions

The request lifecycle is defined through supported transitions. This prevents requests from being moved arbitrarily between statuses.

### Append-only notes

Notes preserve the history of updates. New notes are appended instead of overwriting existing notes, providing a chronological record for staff.

### Soft deletion

Eligible requests are marked as removed instead of being permanently deleted. This preserves stored records while keeping removed requests out of the normal user interface.

### Seed data

A seed script provides repeatable demonstration data so that the dashboard, filters, details, and request workflow can be evaluated without manually creating every example.

## Assumptions and Scope

- ReturnDesk is a standalone returns-management tool, not a customer-facing storefront.
- Order references and item information are entered into ReturnDesk; integration with an external order-management system is outside the current scope.
- Refund amounts are recorded during the approval workflow. The application does not independently retrieve order prices or calculate refunds from an external order system.
- Seed records are fictional demonstration data and are not real customer or order records.
- Database credentials and deployment-specific configuration are supplied through environment variables.
- The application is intended to demonstrate the return-management workflow described in the assignment rather than a complete e-commerce platform.

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
│   └── return-validation.test.js
├── .env.example
├── prisma.config.mjs
└── package.json
```

## Testing and Verification

The repository includes unit tests for return validation.

Run them with:

```bash
node --test tests/return-validation.test.js
```

Run the lint checks and production build with:

```bash
npx eslint .
npm run build
```

These checks help catch validation regressions, lint errors, and build-time issues. They do not replace integration tests against a configured PostgreSQL database.

## Known Limitations and Future Improvements

- Integration with an external order-management system and automatic retrieval of order prices are outside the current scope.
- Automated integration tests for the API, database constraints, and complete request lifecycle would improve regression coverage.
- Additional accessibility testing and production monitoring would help prepare the application for broader production use.
- Deployment and database configuration must be verified in the target hosting environment.

Only features verified in the submitted application should be considered complete. Any issues discovered during final verification should be documented honestly.

## Development Time

**Approximate time spent:** [Enter your actual approximate hours.]

## Author

**Soham Shinde**

GitHub: [@Soham-18shinde](https://github.com/Soham-18shinde)