# Repository instructions

## Supabase migrations

- Create the required migration file as part of the implementation, but never apply or push a migration to any Supabase environment automatically.
- When a migration is required, clearly tell the user which migration file must be applied and wait for the user to run it.
- Do not run commands such as `supabase db push`, `supabase migration up`, or equivalent remote migration commands unless the user explicitly asks for that command in the current request.
- When a migration creates a table in the `public` schema, include explicit `GRANT` statements in that same migration for the Data API roles and operations the table actually needs. Supabase stops automatically granting Data API access to new `public` tables on October 30, 2026. Do not assume grants will be added automatically; configure RLS for client-accessible tables.

## Testing

- Continue creating and running appropriate automated tests for implementations and bug fixes.
- Do not manually exercise app functionality or inspect the UI to confirm that a design looks or behaves as expected; the user will perform manual functional and visual testing.
- Tests must exercise production core functions directly. Mock only unavailable platform or external-system boundaries, and never duplicate production business logic inside a test.

## Coding

- Write the minimum code necessary to implement any functionality. Simplicity is king. Of course, do not because of simplicity sacrifice code quality or maintainability, scalability or readability. This rule is meant to write the minimum code while still ensuring high code quality and correctness. It prevents redundant code, over engineering or over complicating things. 

- When something is unclear regaring my instructions, always ask before proceeding redundantly, or with doubts.
