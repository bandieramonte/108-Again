# App Behavior Tests

These tests cover focused app behavior that does not require a live Supabase
account:

- Update policy decisions for optional, mandatory, and maintenance releases.
- Password reset recovery links are routed through Expo Router native intent
  handling and establish the Supabase recovery session through the same core
  function used by the reset screen.
- New practices start with no daily target and a default session count of 108.
- Classification of unrecoverable refresh-token errors.
- Backup export/import through the app-facing backup service wrapper,
  including reminder schedules stored in database columns and the legacy
  native reminder store.
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

The count-progress test verifies the shared formatting used for lifetime and
daily target labels.

The suite executes the real `+native-intent`, `authAccountActions`,
`appUpdatePolicy`, `authSessionPolicy`, `syncCoordinator`,
`lastPracticeScreenService`, repository factories, and
`createAppOperationEngine`, including backup validation and restoration. The
backup wrapper test also executes the real `backupService` and
`practiceReminderService`; test doubles are limited to external boundaries such
as AsyncStorage, native notifications, timers, connectivity, app singleton
wiring, and the sync engine dependency in the focused coordinator test.
