DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'practices'
          AND column_name = 'default_add_count'
    ) AND NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'practices'
          AND column_name = 'daily_target_count'
    ) THEN
        ALTER TABLE "public"."practices"
            RENAME COLUMN "default_add_count" TO "daily_target_count";
    END IF;
END $$;

ALTER TABLE "public"."practices"
    ADD COLUMN IF NOT EXISTS "default_session_count" bigint;

UPDATE "public"."practices"
SET
    "daily_target_count" = COALESCE("daily_target_count", 108),
    "default_session_count" = COALESCE(
        "default_session_count",
        "daily_target_count",
        108
    );

ALTER TABLE "public"."practices"
    ALTER COLUMN "daily_target_count" SET DEFAULT 108,
    ALTER COLUMN "daily_target_count" SET NOT NULL,
    ALTER COLUMN "default_session_count" SET DEFAULT 108,
    ALTER COLUMN "default_session_count" SET NOT NULL;
