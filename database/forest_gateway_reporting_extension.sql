-- Gateway/GCS/NMS reporting authority and provenance for an existing deployment.
BEGIN;

CREATE TABLE IF NOT EXISTS core.reporting_route (
    reporting_route_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    reporter_asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    source_asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    capability_id varchar(150),
    reporting_role varchar(20) NOT NULL CHECK (reporting_role IN ('GATEWAY', 'GCS', 'NMS', 'DEVICE', 'SERVICE')),
    status varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
    valid_from timestamptz NOT NULL DEFAULT now(),
    valid_to timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (reporter_asset_id <> source_asset_id),
    CHECK (valid_to IS NULL OR valid_to >= valid_from),
    UNIQUE NULLS NOT DISTINCT (event_id, reporter_asset_id, source_asset_id, capability_id)
);

CREATE INDEX IF NOT EXISTS ix_reporting_route_lookup
    ON core.reporting_route(event_id, reporter_asset_id, source_asset_id, status);

ALTER TABLE core.integration_message
    ADD COLUMN IF NOT EXISTS reported_by_asset_id uuid REFERENCES core.asset(asset_id),
    ADD COLUMN IF NOT EXISTS reporting_role varchar(20)
        CHECK (reporting_role IN ('GATEWAY', 'GCS', 'NMS', 'DEVICE', 'SERVICE'));

ALTER TABLE core.personnel_position
    ADD COLUMN IF NOT EXISTS reported_by_asset_id uuid REFERENCES core.asset(asset_id),
    ADD COLUMN IF NOT EXISTS reporting_role varchar(20)
        CHECK (reporting_role IN ('GATEWAY', 'GCS', 'NMS', 'DEVICE', 'SERVICE'));

ALTER TABLE core.asset_status
    ADD COLUMN IF NOT EXISTS reported_by_asset_id uuid REFERENCES core.asset(asset_id),
    ADD COLUMN IF NOT EXISTS reporting_role varchar(20)
        CHECK (reporting_role IN ('GATEWAY', 'GCS', 'NMS', 'DEVICE', 'SERVICE'));

ALTER TABLE wildfire.rtk_lpwa_gateway_status
    ADD COLUMN IF NOT EXISTS reported_by_asset_id uuid REFERENCES core.asset(asset_id);

ALTER TABLE wildfire.tvws_link_observation
    ADD COLUMN IF NOT EXISTS reported_by_asset_id uuid REFERENCES core.asset(asset_id);

ALTER TABLE core.reporting_route ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE core.reporting_route FROM anon, authenticated;
GRANT USAGE ON SCHEMA core, wildfire TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.reporting_route TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE core.integration_message, core.personnel_position, core.asset_status TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE wildfire.rtk_lpwa_gateway_status, wildfire.tvws_link_observation TO service_role;

COMMIT;
