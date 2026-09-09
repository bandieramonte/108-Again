# Sync Integration Test

Run locally with:

```powershell
npm run test:sync:local
```

The command prompts for the dedicated `sync_tests` secret key with hidden
input, passes it only to the child test process, and clears it afterward.
Retrieve the key yourself from the Supabase Dashboard after reviewing the
current worktree. The key is never written into the project.

This test talks to the real Supabase project configured through the public
values in `.env` locally, or through GitHub Actions secrets in CI:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_TEST_SECRET_KEY` (process environment only)

`SUPABASE_TEST_SECRET_KEY` is used only by this Node integration harness to
create and clean up confirmed automated test accounts. This lets the suite run
when Supabase email confirmation is enabled, while the simulated app devices
still sign in through the normal public client and execute the shared app core
auth/session/sync logic.

Never store `SUPABASE_TEST_SECRET_KEY`, `SUPABASE_SECRET_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`, or another privileged Supabase credential in
`.env` or any file in the project. The harness rejects these keys if it finds
one in `.env` and rejects legacy service-role keys at runtime. Do not prefix a
privileged key with `EXPO_PUBLIC_` or ship it in the app.

The remote GitHub Actions suite is manual and uses the protected
`supabase-integration-tests` environment. Configure that environment with the
three secrets above and require reviewer approval before allowing the job to
read them. Pull-request code never receives a privileged Supabase key.

Current covered flows:

- Practice synchronization reads and writes `default_session_count` without
  depending on the removed legacy `default_add_count` column.
- Device A creates `testPractice1`, sets a scheduled reminder, adds sessions
  for today, yesterday, and before yesterday, syncs through Supabase, and
  Device B fetches the same data.
- Device A adds a session while logged in, logs out, adds another session
  offline, logs back in, and the login sync pushes the merged total.
- Device B has pre-login local data, logs into an existing account for the
  first time, and the remote account state overwrites local data.
- Device B restores a backup file before logging into an existing account for
  the first time, and the remote account state still overwrites local backup
  data without polluting Supabase.
- A device that already belongs to one account rejects login or signup for a
  different account and keeps the original local owner data intact.
- Password reset verifies the core auth action with an injected reset function,
  avoiding real recovery emails while still covering normalization, redirect
  options, validation, and remote error handling.
- Account deletion uses the real `delete-user` Edge Function through the core
  auth action and clears local account ownership.
- Device A creates local data before account creation, including a seeded
  practice deletion, then creates an account and pushes that local state.
- Device A deletes a seeded practice and both Supabase and Device B reflect the
  deletion.
- Device A edits total counts for a custom practice and a seeded practice, then
  Supabase and Device B reflect the computed totals.
- Device A deletes a non-seeded practice with sessions and both Supabase and
  Device B remove the practice and its sessions.
- Device A exports backup data, restores defaults, imports the backup again,
  and Supabase plus Device B match each state transition.
- Restoring defaults after importing a partial seeded backup restores every
  seed locally and remotely.
- A pending restore-defaults operation remains authoritative even if a stale
  remote-overwrite sync is requested.

Each simulated device uses its own `better-sqlite3` in-memory database and real
Supabase client. The suite executes the same repository factories,
`appOperationEngine`, `authSessionEngine`, `syncCoordinator`, `syncEngine`, and
`supabaseSyncRemote` adapter used by the app.

Harness substitutions are limited to runtime boundaries that cannot be shared
by multiple devices in one Node process: device-local state containers,
scheduled-timer capture, and React Native storage. The password-reset unit
scenario injects its remote sender so it can verify the real core action
without sending email. No harness function reproduces account ownership,
sync-mode selection, synchronization, or Supabase query logic.
