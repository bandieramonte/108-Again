ALTER TABLE "public"."practices"
    ALTER COLUMN "daily_target_count" DROP NOT NULL,
    ALTER COLUMN "daily_target_count" DROP DEFAULT;

UPDATE "public"."practices"
SET "daily_target_count" = NULL;
