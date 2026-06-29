ALTER TABLE "public"."practices"
ADD COLUMN IF NOT EXISTS "reminder_enabled" boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS "reminder_hour" integer NOT NULL DEFAULT 20,
ADD COLUMN IF NOT EXISTS "reminder_minute" integer NOT NULL DEFAULT 0;

ALTER TABLE "public"."practices"
DROP CONSTRAINT IF EXISTS "practices_reminder_hour_check";

ALTER TABLE "public"."practices"
ADD CONSTRAINT "practices_reminder_hour_check"
CHECK ("reminder_hour" >= 0 AND "reminder_hour" <= 23);

ALTER TABLE "public"."practices"
DROP CONSTRAINT IF EXISTS "practices_reminder_minute_check";

ALTER TABLE "public"."practices"
ADD CONSTRAINT "practices_reminder_minute_check"
CHECK ("reminder_minute" >= 0 AND "reminder_minute" <= 59);
