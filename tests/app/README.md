# App Behavior Tests

These tests cover focused app behavior that does not require a live Supabase
account:

- Update policy decisions for optional, mandatory, and maintenance releases.
- Classification of unrecoverable refresh-token errors.
- Sync coordinator behavior for update blocking, offline recovery, queued sync,
  and deleted accounts.
- Practice-screen resume behavior.

The practice-screen test verifies:

- When the app last focused a practice content screen, startup can restore that
  exact practice screen.
- When the app last focused a non-practice route, startup falls back to the
  dashboard because the remembered practice screen is cleared.
- If the remembered practice is deleted, startup does not restore it and clears
  the stale id.

The suite executes the real `appUpdatePolicy`, `authSessionPolicy`,
`syncCoordinator`, `lastPracticeScreenService`, repository factories, and
`createAppOperationEngine`. Test doubles are limited to external boundaries
such as AsyncStorage, timers, connectivity, and the sync engine dependency in
the focused coordinator test.
