# ReturnDesk — Returns Management System

ReturnDesk is a full-stack web application for managing product return requests. It helps a store team create return requests, track their status, review them, record decisions, and maintain notes.

## Live Demo

- **Live Application:** https://returndesk-seven.vercel.app/
- **GitHub Repository:** https://github.com/Soham-18shinde/returndesk

## Features

- Create return requests with customer details, order reference, item name, quantity, and reason.
- Generate human-readable return references.
- View and search return requests.
- Filter requests by status and reason.
- Sort and paginate the returns list.
- View individual return request details.
- Add notes to return requests.
- Manage return statuses according to the supported workflow.
- Select a resolution when approving a return.
- Validate refund amounts and other request data.
- Prevent invalid status transitions and duplicate active returns for the same order and item.
- Soft-delete eligible return requests.
- Display loading, empty, and error states in the interface.
- Use the responsive interface on desktop and mobile screens.

## Tech Stack

- **Frontend:** Next.js, React, Tailwind CSS
- **Backend:** Next.js App Router and Route Handlers
- **Database:** PostgreSQL using Neon
- **ORM:** Prisma
- **Testing:** Node.js test runner

## Prerequisites

Install the following before running the project:

- Node.js
- npm
- Git
- A PostgreSQL database, such as Neon

## Getting Started

Follow these steps to run ReturnDesk locally.

### 1. Clone the repository

```bash
git clone https://github.com/Soham-18shinde/returndesk.git
cd returndesk
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Create a `.env` file in the project root by copying `.env.example`.

On Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Open `.env` and add your actual Neon database connection strings:

```env
DATABASE_URL="your-neon-pooled-connection-string"
DIRECT_URL="your-neon-direct-connection-string"
```

- `DATABASE_URL` is the pooled database connection used by the application.
- `DIRECT_URL` is the direct database connection used for database operations such as migrations.

Replace the example values with your actual connection strings. Keep your `.env` file private and never commit database credentials to GitHub.

### 4. Generate the Prisma Client

```bash
npm run db:generate
```

### 5. Apply database migrations

```bash
npm run db:migrate:deploy
```

This applies the migrations included in the repository to the configured database.

**Important:** Use a development database when setting up a fresh local environment. Before applying pending migrations to an existing production database, review the migration and verify the current database state.

### 6. Add sample data

```bash
npm run db:seed
```

The seed script creates or updates sample return requests for development and demonstration purposes. Review the seed script before running it against an existing database, as it may update eligible sample records.

### 7. Start the development server

```bash
npm run dev
```

Open the following URL in your browser:

http://localhost:3000

## Return Request Workflow

The application supports the following return statuses:

1. **Open** — The return request has been created.
2. **In Review** — The request is being reviewed.
3. **Approved** — The return request has been approved with a resolution.
4. **Rejected** — The return request has been rejected.
5. **Completed** — The return process has been completed.

Rejected and Completed are final statuses. The application validates status changes and rejects invalid transitions.

### Available Resolutions

- Refund
- Replacement
- Store Credit

A refund requires a positive refund amount. Replacement and Store Credit do not use a refund amount.

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
│   │   ├── returns/
│   │   ├── globals.css
│   │   ├── layout.js
│   │   ├── page.js
│   │   ├── return-details.js
│   │   ├── return-form.js
│   │   └── returns-dashboard.js
│   └── lib/
│       ├── prisma.js
│       ├── return-api.js
│       └── return-validation.js
├── tests/
│   ├── return-validation.test.js
│   └── order-item-uniqueness.test.js
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── prisma.config.mjs
└── README.md
```

## Available Commands

Run these commands from the project directory.

| Command | Purpose |
|---|---|
| `npm run dev` | Start the development server |
| `npm run build` | Build the application |
| `npm run start` | Start the production server |
| `npm run lint` | Check the code for linting issues |
| `npm run db:generate` | Generate the Prisma Client |
| `npm run db:migrate` | Run the configured development migration command |
| `npm run db:migrate:deploy` | Apply pending migrations |
| `npm run db:seed` | Add or update sample data |

## Running Tests

### Unit tests

Run the validation test suite:

```bash
node --test tests/return-validation.test.js
```

### Database integration test

The order-and-item uniqueness test requires a separate test database if its configuration expects `RETURNDESK_TEST_DATABASE_URL`.

Create a disposable PostgreSQL database for testing, configure the variable only as required by the test, and inspect the test setup before running it. Never point destructive integration-test setup at your production database.

Do not add `RETURNDESK_TEST_DATABASE_URL` to your normal application configuration unless you need it for this test.

## Database Notes

ReturnDesk uses Prisma to manage its PostgreSQL data model and migrations.

The database contains return request records and their associated notes. Migration files are maintained in the repository.

Before deploying a database migration:

1. Review the migration file.
2. Check which migrations have already been applied.
3. Check for existing records that could conflict with new constraints.
4. Back up important data where appropriate.
5. Apply the migration only after verifying that it is safe for the target database.

## Deployment

The application is deployed on Vercel and uses Neon PostgreSQL.

- **Live Application:** https://returndesk-seven.vercel.app/
- **Source Code:** https://github.com/Soham-18shinde/returndesk

To deploy your own copy:

1. Import the GitHub repository into Vercel.
2. Configure the required environment variables in Vercel.
3. Connect the appropriate Neon PostgreSQL database.
4. Verify the database migration state.
5. Deploy the application and check the deployed pages and API routes.

## Security

- Do not commit `.env` or real database credentials.
- Use `.env.example` to document required environment variables.
- Use a separate database for destructive integration tests.
- Verify database migrations before applying them to production.

## Future Improvements

Possible improvements include authentication, role-based access control, and additional automated integration tests.

These are potential future improvements and should not be considered implemented features unless they are added to the application.

## Author

**Soham Shinde**

GitHub: https://github.com/Soham-18shinde