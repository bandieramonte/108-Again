# App Behavior Tests

These tests cover app behavior that is not part of the Supabase sync suite.

The first test verifies the practice-screen resume rule:

- When the app last focused a practice content screen, startup can restore that
  exact practice screen.
- When the app last focused a non-practice route, startup falls back to the
  dashboard because the remembered practice screen is cleared.
- If the remembered practice is deleted, startup does not restore it and clears
  the stale id.

The count-progress test verifies the shared formatting used for lifetime and
daily target labels.

The test uses the real `lastPracticeScreenService`, real repository factories,
and the real `createAppOperationEngine` practice operations. The only test
double is AsyncStorage, because the React Native native storage module is not
available in Node.
