BEGIN;

CREATE TABLE IF NOT EXISTS core.integration_message (
    message_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    request_id          uuid NOT NULL,
    correlation_id      uuid,
    capability_id       varchar(150) NOT NULL,
    direction           varchar(10) NOT NULL CHECK (direction IN ('INBOUND', 'OUTBOUND')),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    source_system       varchar(100) NOT NULL,
    occurred_at         timestamptz NOT NULL,
    sent_at             timestamptz,
    received_at         timestamptz NOT NULL DEFAULT now(),
    completed_at        timestamptz,
    status              varchar(20) NOT NULL CHECK (
        status IN ('RECEIVED', 'DISPATCHED', 'ACCEPTED', 'SUCCEEDED', 'REJECTED', 'FAILED')
    ),
    payload             jsonb NOT NULL,
    response            jsonb,
    error_code          varchar(100),
    error_detail        text,
    UNIQUE (capability_id, direction, request_id)
);

CREATE INDEX IF NOT EXISTS ix_integration_message_event_time
    ON core.integration_message(event_id, received_at DESC);
CREATE INDEX IF NOT EXISTS ix_integration_message_status_time
    ON core.integration_message(status, received_at DESC);

CREATE TABLE IF NOT EXISTS core.kpi_measurement (
    kpi_measurement_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    test_run_id         uuid NOT NULL,
    metric_code         varchar(100) NOT NULL,
    metric_name         varchar(200) NOT NULL,
    measured_from       timestamptz NOT NULL,
    measured_to         timestamptz NOT NULL,
    numerator           numeric,
    denominator         numeric,
    measured_value      numeric NOT NULL,
    unit                varchar(30) NOT NULL,
    target_operator     varchar(5) CHECK (target_operator IN ('LT', 'LTE', 'EQ', 'GTE', 'GT')),
    target_value        numeric,
    passed              boolean,
    source_system       varchar(100) NOT NULL,
    evidence            jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (measured_to >= measured_from),
    CHECK (denominator IS NULL OR denominator > 0),
    UNIQUE (test_run_id, metric_code)
);

CREATE INDEX IF NOT EXISTS ix_kpi_measurement_event_time
    ON core.kpi_measurement(event_id, measured_to DESC);

CREATE TABLE IF NOT EXISTS core.audit_log (
    audit_log_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE SET NULL,
    actor_id            varchar(200),
    actor_org_code      varchar(100),
    action              varchar(100) NOT NULL,
    target_type         varchar(100) NOT NULL,
    target_id           varchar(200),
    request_id          uuid,
    occurred_at         timestamptz NOT NULL DEFAULT now(),
    before_value        jsonb,
    after_value         jsonb,
    source_system       varchar(100) NOT NULL,
    result              varchar(20) NOT NULL CHECK (result IN ('SUCCEEDED', 'FAILED', 'DENIED')),
    error_detail        text
);

CREATE TABLE IF NOT EXISTS core.device_credential (
    credential_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_id            uuid NOT NULL REFERENCES core.asset(asset_id) ON DELETE CASCADE,
    credential_type     varchar(30) NOT NULL CHECK (credential_type IN ('API_KEY_HASH', 'CERT_FINGERPRINT')),
    credential_hash     varchar(128) NOT NULL UNIQUE,
    status              varchar(20) NOT NULL CHECK (status IN ('ACTIVE', 'REVOKED', 'EXPIRED')),
    issued_at           timestamptz NOT NULL DEFAULT now(),
    expires_at          timestamptz,
    revoked_at          timestamptz,
    last_authenticated_at timestamptz,
    metadata            jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (expires_at IS NULL OR expires_at > issued_at),
    CHECK ((status = 'REVOKED') = (revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_asset_serial_number
    ON core.asset(serial_number)
    WHERE serial_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_device_credential_asset_status
    ON core.device_credential(asset_id, status);

CREATE TABLE IF NOT EXISTS core.personnel_device_assignment (
    assignment_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    person_external_id  varchar(200) NOT NULL,
    asset_id            uuid NOT NULL REFERENCES core.asset(asset_id),
    assigned_at         timestamptz NOT NULL,
    released_at         timestamptz,
    assigned_by         varchar(200),
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (released_at IS NULL OR released_at >= assigned_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_person_device_active_person
    ON core.personnel_device_assignment(event_id, person_external_id)
    WHERE released_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_person_device_active_asset
    ON core.personnel_device_assignment(event_id, asset_id)
    WHERE released_at IS NULL;
CREATE INDEX IF NOT EXISTS ix_person_device_assignment_event_time
    ON core.personnel_device_assignment(event_id, assigned_at DESC);

ALTER TABLE landslide.rssi_detection
    ADD COLUMN IF NOT EXISTS detector_role varchar(30),
    ADD COLUMN IF NOT EXISTS grid_cell_id varchar(100),
    ADD COLUMN IF NOT EXISTS phase_deg numeric,
    ADD COLUMN IF NOT EXISTS amplitude numeric,
    ADD COLUMN IF NOT EXISTS round_trip_time_ns numeric;

-- 진화대원 단말: GNSS/RTK 측위, LPWA 기본 현장망, LPWA 음영지역 LTE 보조망
ALTER TABLE core.personnel_position
    ADD COLUMN IF NOT EXISTS transmitted_at timestamptz,
    ADD COLUMN IF NOT EXISTS gnss_fix_quality varchar(30),
    ADD COLUMN IF NOT EXISTS primary_link varchar(20),
    ADD COLUMN IF NOT EXISTS fallback_link varchar(20),
    ADD COLUMN IF NOT EXISTS active_link varchar(20),
    ADD COLUMN IF NOT EXISTS fallback_activated boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_primary_link_at timestamptz,
    ADD COLUMN IF NOT EXISTS signal_strength_dbm numeric,
    ADD COLUMN IF NOT EXISTS battery_percent numeric,
    ADD COLUMN IF NOT EXISTS emergency boolean NOT NULL DEFAULT false;

ALTER TABLE core.personnel_position
    DROP CONSTRAINT IF EXISTS ck_personnel_position_positioning_method,
    DROP CONSTRAINT IF EXISTS ck_personnel_position_primary_link,
    DROP CONSTRAINT IF EXISTS ck_personnel_position_fallback_link,
    DROP CONSTRAINT IF EXISTS ck_personnel_position_active_link,
    DROP CONSTRAINT IF EXISTS ck_personnel_position_fallback_consistency,
    DROP CONSTRAINT IF EXISTS ck_personnel_position_battery;

UPDATE core.personnel_position
SET primary_link = 'LPWA',
    fallback_link = 'LTE',
    active_link = CASE WHEN active_link = 'LTE' THEN 'LTE' ELSE 'LPWA' END,
    fallback_activated = (active_link = 'LTE');

ALTER TABLE core.personnel_position
    ALTER COLUMN primary_link SET DEFAULT 'LPWA',
    ALTER COLUMN fallback_link SET DEFAULT 'LTE';

ALTER TABLE core.personnel_position
    ADD CONSTRAINT ck_personnel_position_positioning_method
        CHECK (positioning_method IN ('RTK_FIXED', 'RTK_FLOAT', 'GNSS')),
    ADD CONSTRAINT ck_personnel_position_primary_link
        CHECK (primary_link = 'LPWA'),
    ADD CONSTRAINT ck_personnel_position_fallback_link
        CHECK (fallback_link = 'LTE'),
    ADD CONSTRAINT ck_personnel_position_active_link
        CHECK (active_link IN ('LPWA', 'LTE')),
    ADD CONSTRAINT ck_personnel_position_fallback_consistency
        CHECK ((active_link = 'LTE') = fallback_activated),
    ADD CONSTRAINT ck_personnel_position_battery
        CHECK (battery_percent IS NULL OR battery_percent BETWEEN 0 AND 100);

CREATE TABLE IF NOT EXISTS wildfire.rtk_lpwa_gateway_status (
    gateway_status_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    observed_at timestamptz NOT NULL,
    operational_status varchar(20) NOT NULL CHECK (operational_status IN ('ONLINE', 'DEGRADED', 'OFFLINE')),
    base_position geometry(PointZ, 4326),
    rtcm_format varchar(30) NOT NULL,
    rtcm_available boolean NOT NULL,
    correction_age_seconds numeric CHECK (correction_age_seconds IS NULL OR correction_age_seconds >= 0),
    delivery_mode varchar(20) NOT NULL CHECK (delivery_mode IN ('BROADCAST', 'MULTICAST')),
    beacon_channel integer NOT NULL CHECK (beacon_channel >= 0),
    uplink_channel_count integer NOT NULL CHECK (uplink_channel_count >= 0),
    connected_terminals integer NOT NULL CHECK (connected_terminals >= 0),
    allocated_slots jsonb NOT NULL DEFAULT '[]'::jsonb,
    ethernet_backhaul jsonb NOT NULL DEFAULT '{}'::jsonb,
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (asset_id, observed_at)
);

CREATE TABLE IF NOT EXISTS wildfire.tvws_link_observation (
    observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    base_asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    cpe_asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    observed_at timestamptz NOT NULL,
    operational_status varchar(20) NOT NULL CHECK (operational_status IN ('ONLINE', 'DEGRADED', 'OFFLINE')),
    channel varchar(50),
    signal_strength_dbm numeric,
    throughput_mbps numeric CHECK (throughput_mbps IS NULL OR throughput_mbps >= 0),
    latency_ms numeric CHECK (latency_ms IS NULL OR latency_ms >= 0),
    packet_loss_pct numeric CHECK (packet_loss_pct IS NULL OR packet_loss_pct BETWEEN 0 AND 100),
    distance_m numeric CHECK (distance_m IS NULL OR distance_m >= 0),
    ingress_medium varchar(20) NOT NULL DEFAULT 'ETHERNET' CHECK (ingress_medium = 'ETHERNET'),
    backhaul_type varchar(20) NOT NULL CHECK (backhaul_type IN ('TVWS', 'LTE', '5G', 'LEO', 'ETHERNET')),
    backhaul_available boolean NOT NULL,
    connected_terminals integer NOT NULL DEFAULT 0 CHECK (connected_terminals >= 0),
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (base_asset_id, cpe_asset_id, observed_at)
);

CREATE INDEX IF NOT EXISTS ix_audit_log_event_time
    ON core.audit_log(event_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS ix_audit_log_target_time
    ON core.audit_log(target_type, target_id, occurred_at DESC);

ALTER TABLE core.integration_message ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.kpi_measurement ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.device_credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.personnel_device_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE wildfire.rtk_lpwa_gateway_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE wildfire.tvws_link_observation ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE core.integration_message FROM anon, authenticated;
REVOKE ALL ON TABLE core.kpi_measurement FROM anon, authenticated;
REVOKE ALL ON TABLE core.audit_log FROM anon, authenticated;
REVOKE ALL ON TABLE core.device_credential FROM anon, authenticated;
REVOKE ALL ON TABLE core.personnel_device_assignment FROM anon, authenticated;
REVOKE ALL ON TABLE wildfire.rtk_lpwa_gateway_status FROM anon, authenticated;
REVOKE ALL ON TABLE wildfire.tvws_link_observation FROM anon, authenticated;

GRANT USAGE ON SCHEMA core TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE core.integration_message TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.kpi_measurement TO service_role;
GRANT SELECT, INSERT ON TABLE core.audit_log TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE core.device_credential TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE core.personnel_device_assignment TO service_role;
GRANT USAGE ON SCHEMA wildfire TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE wildfire.rtk_lpwa_gateway_status TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE wildfire.tvws_link_observation TO service_role;

COMMIT;
