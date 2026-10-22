# Everyday Essentials Retail

A single-location retail workspace with server-verified passcode authentication and Supabase persistence.

## Run locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Configure Supabase first using the steps below. The app loads and saves records from relational tables in the `business` schema.

## Supabase setup

1. For a fresh project, run `sql/supabase_master.sql`, then `sql/supabase_seed.sql` in the Supabase SQL Editor. If you already installed the earlier JSONB version, run only `sql/supabase_migration_0002_relational.sql`; it copies the current snapshot into tables and drops the old `app_state` table.
2. In Project Settings → API → Exposed schemas, add `business`. Keep the schema inaccessible to `anon` and `authenticated`; this app accesses it through its server only.
3. Turn off public sign-ups under Authentication → Settings. This app does not use Supabase Auth sessions or email sign-in.
4. Copy `.env.local.example` to `.env.local`. Set the project URL, the **service role** key, and a randomly generated `SESSION_SECRET` with at least 32 characters. Never expose or commit the service role key.
5. Start the app and unlock with the temporary owner code `ChangeMe-Now-2026!`. Deactivate that code after setting a private owner code.

The SQL seed creates the sample products, sales, suppliers, purchases, expenses, settings, three profiles, and a bcrypt-compatible temporary owner code. It only inserts sample records into an empty products table, so rerunning it will not overwrite live retail records. To create a new code, generate a bcrypt hash locally (for example, `node -e "require('bcryptjs').hash(process.argv[1], 12).then(console.log)" 'your-private-code'`) and insert it into `business.access_codes` with the target `profile_id`. Deactivate old codes by setting `active = false`. Only owners should manage profiles and codes.

`sql/supabase_master.sql` is the canonical full schema. For every future SQL change, add an ordered migration file, record its version and description in `business.schema_migrations`, and update the master file to include the resulting schema. Keep the SQL fixture in `sql/supabase_seed.sql` aligned with `lib/seed.ts` when sample records change.

## Checks

```bash
npx tsc --noEmit
npm run lint
npm run build
```

## Data and access notes

- The server verifies bcrypt passcodes and signs an HTTP-only cookie. Session lifetime defaults to 12 hours (`SESSION_TTL_SECONDS`). Keep `SESSION_SECRET` private and rotate it to invalidate existing sessions.
- The service role key is used only in server route handlers. Client requests require a valid session cookie.
- Retail records are stored in separate tables: `products`, `customers`, `suppliers`, `sales`, `sale_items`, `purchases`, `purchase_items`, `inventory_movements`, `expenses`, `categories`, `expense_categories`, and `business_settings`. Authentication uses `profiles` and `access_codes`.
- Saves use one database function to update the related tables in a transaction. The client still submits a workspace update together, so simultaneous edits can conflict; the database no longer stores the retail data in one JSONB column.
- Cashier writes are checked on the server and limited to sales. The service role key stays server-side; direct table access is revoked for `anon` and `authenticated` roles.
- Payment entries are locally recorded confirmations only. Verify Mobile Money and card payments outside this prototype.
- Receipt printing uses the browser print dialog; choose “Save as PDF” to download a PDF.
- Profit reports estimate gross profit using sale-time item costs and subtract paid operating expenses dated in the selected period. Unpaid expenses and accrual accounting are excluded.


