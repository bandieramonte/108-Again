CREATE TABLE IF NOT EXISTS "public"."app_update_policy" (
    "platform" text PRIMARY KEY,
    "latest_version_code" bigint NOT NULL DEFAULT 0,
    "minimum_supported_version_code" bigint NOT NULL DEFAULT 0,
    "maintenance_mode" boolean NOT NULL DEFAULT false,
    "message" text,
    "updated_at" timestamp with time zone NOT NULL DEFAULT now(),
    CONSTRAINT "app_update_policy_version_codes_nonnegative"
        CHECK (
            "latest_version_code" >= 0 AND
            "minimum_supported_version_code" >= 0
        ),
    CONSTRAINT "app_update_policy_minimum_not_above_latest"
        CHECK (
            "minimum_supported_version_code" <=
            "latest_version_code"
        )
);

ALTER TABLE "public"."app_update_policy" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read app update policy"
ON "public"."app_update_policy";

CREATE POLICY "Anyone can read app update policy"
ON "public"."app_update_policy"
FOR SELECT
TO anon, authenticated
USING (true);

REVOKE ALL ON TABLE "public"."app_update_policy"
FROM anon, authenticated;

GRANT SELECT ON TABLE "public"."app_update_policy"
TO anon, authenticated;

INSERT INTO "public"."app_update_policy" (
    "platform",
    "latest_version_code",
    "minimum_supported_version_code",
    "maintenance_mode",
    "message"
)
VALUES ('android', 0, 0, false, NULL)
ON CONFLICT ("platform") DO NOTHING;
