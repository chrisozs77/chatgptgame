# Connect Degen Tracker to Supabase

Your project URL and publishable key are intentionally public client configuration in `src/cloud/project.public.json`. They are safe to bundle because authentication and database row policies restrict access. No database password, secret key, or service-role key belongs in the app, GitHub, or chat. You do not need to supply those credentials for this setup.

The cloud integration is prepared, but live backup requires the database schema and email sign-in configuration below. Source code and passing local tests do not establish that your Supabase project is configured.

## 1. Set up the database

Open [your Supabase SQL Editor](https://supabase.com/dashboard/project/gndeoxesuosquvdccucz/sql/new). Copy the entire contents of [`supabase/schema.sql`](../supabase/schema.sql) into a new query and click **Run**.

It creates `degen_ledger_entries`, enables row-level security, and allows each signed-in user to access only rows bearing their own user ID. Anonymous users have no ledger access. Results are immutable; corrections use removal and a new entry. Deletions are represented by tombstones so stale offline copies cannot restore removed results. Deleted result data remains in the protected table to support sync. The script can be rerun without clearing records.

## 2. Configure email sign-in codes

In **Authentication → Emails / Email Templates**, find the **Magic Link** template. Replace its body with [`supabase/email-code.html`](../supabase/email-code.html), which includes `{{ .Token }}`. Save it. The app uses the emailed code, not a redirect link, on both web and native platforms. Keep the Email provider and new-user signups enabled.

Supabase's built-in email sender is limited and normally restricted to the project's organization members. It is suitable for your initial owner test, not general sign-in for friends. Configure a supported SMTP provider under **Authentication → SMTP Settings** before inviting other addresses. Enter SMTP credentials only in Supabase's secure settings. Sender verification and the provider's limits still apply. Do not disable email verification to work around a delivery failure.

## 3. Deploy the connected app

For this project, no extra GitHub variables are required: the provided **public** project connection details are already included. Once the updated `degen-tracker` branch is deployed through GitHub Pages, users can select **Sign in / Create account**, enter their email, and type the emailed code.

For another project or key rotation, update `src/cloud/project.public.json`, or provide **both** `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` as build variables. A privileged key causes the build to fail before bundling. Changing public configuration requires a new web/native build. Do not mix an old project URL with another project's key.

Run `npm ci` and `npm run web` to test locally. On GitHub, **Settings → Pages** must use **GitHub Actions**. Run **Actions → Deploy installable web app** on `degen-tracker` and wait for a successful deployment. Enabling Pages and adding cloud storage are separate operations.

## 4. Verify actual saving

1. Sign in with your own email. On the first sign-in, local-only logs are not uploaded automatically. Use **Back up local logs → Confirm backup** if you want those copied into that account.
2. Log a small test result. Wait for **CLOUD SAVED**. A pending or paused indicator means the backup is not yet confirmed.
3. Open the hosted app in a different browser or device, sign into the same account, and check that the result is restored.
4. Log a result offline, then reconnect and select **Sync now**. Confirm it appears on the other device too.

Each signed-in account has a separate local cache. Switching accounts never imports or uploads another account's cache. Guest logs remain in their original local-only ledger. Import is explicit and idempotent. Signing out keeps pending changes in that account's local cache for its next sign-in; it does not upload them to the guest ledger.

Only successfully synced logs can be recovered after local storage is cleared or a device is lost. Email access is needed to recover an account. Device storage can still be cleared by a user or operating system, so check **CLOUD SAVED** before relying on the backup. Supabase's free project availability and email service limits also affect when sync is possible.

## Validation scope

The project includes sync tests, browser tests against a simulated Supabase HTTP API, and PostgreSQL policy tests using PGlite. Those verify offline queues, cross-device restore, failed writes, explicit import, deletion conflicts, and account isolation. They do not send real emails or prove live hosted Supabase setup. A successful two-device owner test above is required before calling live cloud backup ready.
