# Sync Integration Test

Run locally with:

```sh
npm run test:sync
```

This test talks to the real Supabase project configured in `.env` locally, or
through GitHub Actions secrets in CI:

- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`

Current covered flows:

- Device A creates `testPractice1`, adds sessions for today, yesterday, and
  before yesterday, syncs through Supabase, and Device B fetches the same data.
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

The test uses two separate `better-sqlite3` in-memory databases, each wired
through the real repository factory methods. It does not use fake app action
methods, fake repository methods, or a fake remote store.

The harness-level simulations are per-device auth state and the injected
password-reset sender. The production auth service is a singleton and cannot
represent two devices inside one Node process; real Supabase recovery emails
also depend on external deliverability rules that are outside the app's core
logic. Each login still uses real Supabase auth, checks the same core
account-ownership guard used by `authService.ts`, and triggers the real sync
engine.
