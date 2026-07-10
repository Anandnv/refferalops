# KHOPS Referral Tracker — Database Module

## Included artifacts

- `prisma/schema.prisma` defines the complete Prisma/PostgreSQL data model.
- `prisma/migrations/20260710150000_initial_schema/migration.sql` is the initial production migration.
- `src/server/db/client.ts` exports the singleton Prisma client for future server modules.
- `.env.example` documents the required local database connection string.

## Database setup

1. Create a PostgreSQL database named `khops_referral_tracker` on the selected managed provider or local server.
2. Copy `.env.example` to `.env` and replace the connection string with the database credentials.
3. Run `npm run db:deploy` to apply committed migrations.
4. Run `npm run db:generate` after installing dependencies or changing the schema.

Use `npm run db:migrate -- --name <migration_name>` only when developing a new schema change locally. Commit the generated migration with the schema change. Do not use `prisma db push` for production schema changes.

## Data guarantees

- `gmail_threads.gmail_thread_id` and `gmail_messages.gmail_message_id` are unique source identifiers.
- A request has exactly one source Gmail thread and one source Gmail message; re-syncing an existing thread updates it rather than creating a duplicate request.
- Each beneficiary is an independent row with its own amount, contact, evidence, and confidence.
- Approval status changes are append-only timeline rows sourced from Gmail messages or an explicit manual override.
- Centres and aliases are stored in data, not in application constants.
- Amounts use `numeric(12,2)` and confidence values are database-checked between zero and one.
- Trigram indexes support patient, procedure, hospital, beneficiary-name, and contact searches.

## Deliberate scope boundary

This module creates no Gmail credentials, OAuth flow, sync logic, AI prompts, dashboard pages, export template, or seed data. Centre records and Settings values will be created by their respective approved modules.
