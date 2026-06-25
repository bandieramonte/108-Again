ALTER TABLE "public"."practices"
    ADD COLUMN IF NOT EXISTS "default_add_count" bigint;

UPDATE "public"."practices"
SET
    "default_session_count" = COALESCE(
        "default_session_count",
        "default_add_count",
        108
    ),
    "default_add_count" = COALESCE(
        "default_add_count",
        "default_session_count",
        108
    );

ALTER TABLE "public"."practices"
    ALTER COLUMN "default_add_count" SET DEFAULT 108,
    ALTER COLUMN "default_add_count" SET NOT NULL,
    ALTER COLUMN "default_session_count" SET DEFAULT 108,
    ALTER COLUMN "default_session_count" SET NOT NULL,
    ALTER COLUMN "daily_target_count" DROP DEFAULT,
    ALTER COLUMN "daily_target_count" DROP NOT NULL;

CREATE OR REPLACE FUNCTION "public"."sync_legacy_practice_default_count"()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
    legacy_changed boolean;
    session_changed boolean;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.default_add_count IS DISTINCT FROM NEW.default_session_count THEN
            IF NEW.default_session_count = 108 THEN
                NEW.default_session_count := NEW.default_add_count;
            ELSE
                NEW.default_add_count := NEW.default_session_count;
            END IF;
        END IF;
    ELSE
        legacy_changed := NEW.default_add_count IS DISTINCT FROM OLD.default_add_count;
        session_changed := NEW.default_session_count IS DISTINCT FROM OLD.default_session_count;

        IF legacy_changed AND NOT session_changed THEN
            NEW.default_session_count := NEW.default_add_count;
        ELSIF session_changed THEN
            NEW.default_add_count := NEW.default_session_count;
        END IF;
    END IF;

    NEW.default_session_count := COALESCE(
        NEW.default_session_count,
        NEW.default_add_count,
        108
    );
    NEW.default_add_count := COALESCE(
        NEW.default_add_count,
        NEW.default_session_count,
        108
    );

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "sync_legacy_practice_default_count"
ON "public"."practices";

CREATE TRIGGER "sync_legacy_practice_default_count"
BEFORE INSERT OR UPDATE ON "public"."practices"
FOR EACH ROW
EXECUTE FUNCTION "public"."sync_legacy_practice_default_count"();
