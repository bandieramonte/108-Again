DROP TRIGGER IF EXISTS "sync_legacy_practice_default_count"
ON "public"."practices";

DROP FUNCTION IF EXISTS "public"."sync_legacy_practice_default_count"();

ALTER TABLE "public"."practices"
    DROP COLUMN IF EXISTS "default_add_count";
