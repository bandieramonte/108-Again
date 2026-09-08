# Supabase API-key migration

The repository now expects Supabase publishable and secret keys. No database
migration is required. Complete the Supabase and deployment steps below in
order; do not deactivate the legacy keys until the updated mobile release is
in users' hands and legacy usage has stopped.

## 1. Configure application environments

In every EAS environment used to build the app, add:

- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: the value of the existing Supabase
  `default` publishable key.

Keep `EXPO_PUBLIC_SUPABASE_URL` unchanged. New builds no longer read
`EXPO_PUBLIC_SUPABASE_ANON_KEY`; remove that obsolete EAS variable after the
new configuration is verified.

## 2. Deploy the updated delete-user function

The updated function uses the Supabase runtime's managed
`SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, and `SUPABASE_JWKS`
variables through `@supabase/server`. Confirm those managed variables are
listed for the project, then deploy `delete-user` from this repository.

The function must deploy with JWT verification enabled, as configured in
`supabase/config.toml` and `supabase/functions/delete-user/config.toml`.

## 3. Create the integration-test secret key

In Supabase **Settings > API Keys**, create a secret key named `sync_tests`.
Keep its value out of the repository and all `.env` files.

For local testing, run `npm run test:sync:local` and paste that key into the
hidden prompt.

For GitHub Actions, create or configure the
`supabase-integration-tests` environment, require reviewer approval, and add:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_TEST_SECRET_KEY` containing the `sync_tests` key

Run the **Sync Integration Tests** workflow manually and confirm it passes.

## 4. Release and verify

Build and release the updated mobile app. Confirm authentication, syncing,
custom practice images, and account deletion work in the released build.

Check Supabase's API-key usage indicators for old mobile versions, external
integrations, webhooks, and jobs that may still use the legacy keys. Require an
update from any remaining old app versions before deactivation if necessary.

## 5. Deactivate legacy keys

Only after legacy usage has stopped, deactivate the legacy `anon` and
`service_role` keys together in **Supabase Settings > API Keys**. Then verify
the released app, `delete-user`, and the manual sync workflow once more.
