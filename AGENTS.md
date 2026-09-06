# Repository instructions

## Supabase migrations

- Create the required migration file as part of the implementation, but never apply or push a migration to any Supabase environment automatically.
- When a migration is required, clearly tell the user which migration file must be applied and wait for the user to run it.
- Do not run commands such as `supabase db push`, `supabase migration up`, or equivalent remote migration commands unless the user explicitly asks for that command in the current request.

## Testing

- Continue creating and running appropriate automated tests for implementations and bug fixes.
- Do not manually exercise app functionality or inspect the UI to confirm that a design looks or behaves as expected; the user will perform manual functional and visual testing.

## Coding

- Write the minimum code necessary to implement any functionality. Simplicity is king. Of course, do not because of simplicity sacrifice code quality or maintainability, scalability or readability. This rule is meant to write the minimum code while still ensuring high code quality and correctness. It prevents redundant code, over engineering or over complicating things. 
