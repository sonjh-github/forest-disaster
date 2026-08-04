BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS postgis;

CREATE SCHEMA IF NOT EXISTS core;
CREATE SCHEMA IF NOT EXISTS wildfire;
CREATE SCHEMA IF NOT EXISTS landslide;

-- 외부 시스템에서 조회하는 조직·사용자·관할·표준코드는 코드/식별자만 저장한다.

CREATE TABLE core.disaster_event (
    event_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_code          varchar(100) NOT NULL UNIQUE,
    disaster_type       varchar(20) NOT NULL CHECK (disaster_type IN ('WILDFIRE', 'LANDSLIDE', 'COMPLEX')),
    event_name          varchar(200) NOT NULL,
    status              varchar(20) NOT NULL CHECK (status IN ('REPORTED', 'CONFIRMED', 'RESPONDING', 'CONTROLLED', 'CLOSED', 'CANCELLED')),
    severity_code       varchar(50),
    occurred_at         timestamptz,
    reported_at         timestamptz NOT NULL DEFAULT now(),
    ended_at            timestamptz,
    managing_org_code   varchar(100),
    jurisdiction_code   varchar(100),
    geometry            geometry(Geometry, 4326),
    source_system       varchar(100) NOT NULL,
    source_record_id    varchar(200),
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (ended_at IS NULL OR occurred_at IS NULL OR ended_at >= occurred_at),
    UNIQUE NULLS NOT DISTINCT (source_system, source_record_id)
);

CREATE INDEX ix_event_type_status_time ON core.disaster_event(disaster_type, status, occurred_at);

CREATE TABLE core.asset (
    asset_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    asset_code          varchar(100) NOT NULL UNIQUE,
    asset_type          varchar(50) NOT NULL,
    asset_name          varchar(200),
    owner_org_code      varchar(100),
    model_name          varchar(100),
    serial_number       varchar(200),
    status              varchar(30) NOT NULL,
    specifications      jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ux_asset_serial_number
    ON core.asset(serial_number)
    WHERE serial_number IS NOT NULL;

CREATE TABLE core.device_credential (
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

CREATE INDEX ix_device_credential_asset_status
    ON core.device_credential(asset_id, status);

CREATE TABLE core.event_resource (
    event_resource_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    asset_id            uuid NOT NULL REFERENCES core.asset(asset_id),
    assigned_org_code   varchar(100),
    mission             text,
    assigned_at         timestamptz NOT NULL,
    released_at         timestamptz,
    CHECK (released_at IS NULL OR released_at >= assigned_at),
    UNIQUE (event_id, asset_id, assigned_at)
);

CREATE TABLE core.personnel_device_assignment (
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

CREATE UNIQUE INDEX ux_person_device_active_person
    ON core.personnel_device_assignment(event_id, person_external_id)
    WHERE released_at IS NULL;
CREATE UNIQUE INDEX ux_person_device_active_asset
    ON core.personnel_device_assignment(event_id, asset_id)
    WHERE released_at IS NULL;
CREATE INDEX ix_person_device_assignment_event_time
    ON core.personnel_device_assignment(event_id, assigned_at DESC);

CREATE TABLE core.reporting_route (
    reporting_route_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    reporter_asset_id   uuid NOT NULL REFERENCES core.asset(asset_id),
    source_asset_id     uuid NOT NULL REFERENCES core.asset(asset_id),
    capability_id       varchar(150),
    reporting_role      varchar(20) NOT NULL CHECK (reporting_role IN ('GATEWAY', 'GCS', 'NMS', 'DEVICE', 'SERVICE')),
    status              varchar(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'CLOSED')),
    valid_from          timestamptz NOT NULL DEFAULT now(),
    valid_to            timestamptz,
    created_at          timestamptz NOT NULL DEFAULT now(),
    CHECK (reporter_asset_id <> source_asset_id),
    CHECK (valid_to IS NULL OR valid_to >= valid_from),
    UNIQUE NULLS NOT DISTINCT (event_id, reporter_asset_id, source_asset_id, capability_id)
);

CREATE INDEX ix_reporting_route_lookup
    ON core.reporting_route(event_id, reporter_asset_id, source_asset_id, status);

CREATE TABLE core.personnel_position (
    position_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    person_external_id  varchar(200) NOT NULL,
    observed_at         timestamptz NOT NULL,
    received_at         timestamptz NOT NULL DEFAULT now(),
    geometry            geometry(PointZ, 4326) NOT NULL,
    horizontal_accuracy_m numeric CHECK (horizontal_accuracy_m IS NULL OR horizontal_accuracy_m >= 0),
    positioning_method  varchar(50) NOT NULL
                        CONSTRAINT ck_personnel_position_positioning_method
                        CHECK (positioning_method IN ('RTK_FIXED', 'RTK_FLOAT', 'GNSS')),
    gnss_fix_quality    varchar(30),
    transmitted_at     timestamptz NOT NULL,
    primary_link       varchar(20) NOT NULL DEFAULT 'LPWA'
                        CONSTRAINT ck_personnel_position_primary_link
                        CHECK (primary_link = 'LPWA'),
    fallback_link      varchar(20) NOT NULL DEFAULT 'LTE'
                        CONSTRAINT ck_personnel_position_fallback_link
                        CHECK (fallback_link = 'LTE'),
    active_link        varchar(20) NOT NULL
                        CONSTRAINT ck_personnel_position_active_link
                        CHECK (active_link IN ('LPWA', 'LTE')),
    fallback_activated boolean NOT NULL DEFAULT false,
    last_primary_link_at timestamptz,
    signal_strength_dbm numeric,
    battery_percent    numeric CHECK (battery_percent IS NULL OR battery_percent BETWEEN 0 AND 100),
    activity_status     varchar(30),
    safety_status       varchar(30),
    emergency           boolean NOT NULL DEFAULT false,
    source_asset_id     uuid REFERENCES core.asset(asset_id),
    reported_by_asset_id uuid REFERENCES core.asset(asset_id),
    reporting_role      varchar(20) CHECK (reporting_role IN ('GATEWAY', 'GCS', 'NMS', 'DEVICE', 'SERVICE')),
    source_system       varchar(100) NOT NULL,
    quality_status      varchar(20) NOT NULL DEFAULT 'RAW',
    UNIQUE (event_id, person_external_id, observed_at),
    CONSTRAINT ck_personnel_position_fallback_consistency
        CHECK ((active_link = 'LTE') = fallback_activated)
);

CREATE INDEX ix_person_position_latest ON core.personnel_position(event_id, person_external_id, observed_at);

CREATE TABLE core.communication_network (
    network_id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    network_code        varchar(100) NOT NULL UNIQUE,
    network_name        varchar(200) NOT NULL,
    network_type        varchar(50) NOT NULL,
    status              varchar(20) NOT NULL CHECK (status IN ('PLANNED', 'DEPLOYING', 'ACTIVE', 'DEGRADED', 'UNAVAILABLE', 'CLOSED')),
    deployed_at         timestamptz,
    activated_at        timestamptz,
    closed_at           timestamptz,
    operation_area      geometry(Geometry, 4326),
    managing_org_code   varchar(100),
    attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (closed_at IS NULL OR activated_at IS NULL OR closed_at >= activated_at)
);

CREATE TABLE core.network_node (
    network_node_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id          uuid NOT NULL REFERENCES core.communication_network(network_id) ON DELETE CASCADE,
    asset_id            uuid NOT NULL REFERENCES core.asset(asset_id),
    node_role           varchar(50) NOT NULL,
    joined_at           timestamptz NOT NULL,
    left_at             timestamptz,
    configuration       jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (left_at IS NULL OR left_at >= joined_at),
    UNIQUE (network_id, asset_id, joined_at)
);

CREATE TABLE core.communication_topology_node (
    topology_node_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id          uuid NOT NULL REFERENCES core.communication_network(network_id) ON DELETE CASCADE,
    asset_id            uuid REFERENCES core.asset(asset_id) ON DELETE SET NULL,
    node_code           varchar(100) NOT NULL,
    node_name           varchar(200) NOT NULL,
    node_kind           varchar(20) NOT NULL
                        CHECK (node_kind IN ('DEVICE', 'NETWORK', 'GATEWAY', 'SERVICE')),
    topology_layer      varchar(20) NOT NULL
                        CHECK (topology_layer IN ('ENDPOINT', 'FIELD', 'COMMAND', 'BACKHAUL', 'CLOUD')),
    status              varchar(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('PLANNED', 'ACTIVE', 'DEGRADED', 'UNAVAILABLE')),
    sort_order          integer NOT NULL DEFAULT 0,
    attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (network_id, node_code)
);

CREATE INDEX ix_topology_node_network_layer
    ON core.communication_topology_node(network_id, topology_layer, sort_order);

CREATE TABLE core.communication_topology_link (
    topology_link_id    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id          uuid NOT NULL REFERENCES core.communication_network(network_id) ON DELETE CASCADE,
    source_node_id      uuid NOT NULL REFERENCES core.communication_topology_node(topology_node_id) ON DELETE CASCADE,
    target_node_id      uuid NOT NULL REFERENCES core.communication_topology_node(topology_node_id) ON DELETE CASCADE,
    link_role           varchar(20) NOT NULL
                        CHECK (link_role IN ('ACCESS', 'AGGREGATION', 'BACKHAUL', 'DIRECT_CLOUD')),
    medium              varchar(30) NOT NULL
                        CHECK (medium IN ('LPWA', 'PRIVATE_5G', 'RADIO_400MHZ', 'ETHERNET', 'LTE', 'TVWS', 'LEO_NTN', 'IP', 'MULTI')),
    status              varchar(20) NOT NULL DEFAULT 'ACTIVE'
                        CHECK (status IN ('PLANNED', 'ACTIVE', 'DEGRADED', 'UNAVAILABLE')),
    bidirectional       boolean NOT NULL DEFAULT true,
    priority            smallint NOT NULL DEFAULT 1 CHECK (priority BETWEEN 1 AND 99),
    observed_at         timestamptz NOT NULL,
    attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
    CHECK (source_node_id <> target_node_id),
    UNIQUE (network_id, source_node_id, target_node_id, medium)
);

CREATE INDEX ix_topology_link_network_status
    ON core.communication_topology_link(network_id, status, priority);

CREATE TABLE core.network_status_history (
    network_status_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    network_id          uuid NOT NULL REFERENCES core.communication_network(network_id) ON DELETE CASCADE,
    status              varchar(20) NOT NULL CHECK (status IN ('DEPLOYING', 'ACTIVE', 'DEGRADED', 'UNAVAILABLE', 'CLOSED')),
    started_at          timestamptz NOT NULL,
    ended_at            timestamptz,
    reason_code         varchar(50),
    reason_detail       text,
    CHECK (ended_at IS NULL OR ended_at >= started_at),
    UNIQUE (network_id, started_at)
);

CREATE INDEX ix_network_status_time ON core.network_status_history(network_id, started_at);

CREATE TABLE core.asset_status (
    asset_status_id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    asset_id            uuid NOT NULL REFERENCES core.asset(asset_id),
    reported_by_asset_id uuid REFERENCES core.asset(asset_id),
    reporting_role      varchar(20) CHECK (reporting_role IN ('GATEWAY', 'GCS', 'NMS', 'DEVICE', 'SERVICE')),
    network_id          uuid REFERENCES core.communication_network(network_id) ON DELETE SET NULL,
    observed_at         timestamptz NOT NULL,
    operational_status  varchar(30) NOT NULL,
    geometry            geometry(PointZ, 4326),
    battery_pct         numeric(5,2) CHECK (battery_pct BETWEEN 0 AND 100),
    external_power      boolean,
    signal_strength_dbm numeric,
    latency_ms          numeric CHECK (latency_ms IS NULL OR latency_ms >= 0),
    throughput_mbps     numeric CHECK (throughput_mbps IS NULL OR throughput_mbps >= 0),
    packet_loss_pct     numeric(5,2) CHECK (packet_loss_pct BETWEEN 0 AND 100),
    attributes          jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (asset_id, observed_at)
);

CREATE INDEX ix_asset_status_event_time ON core.asset_status(event_id, observed_at);

CREATE TABLE core.alert (
    alert_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    alert_type          varchar(50) NOT NULL,
    severity            varchar(20) NOT NULL CHECK (severity IN ('INFO', 'WATCH', 'WARNING', 'CRITICAL')),
    status              varchar(20) NOT NULL CHECK (status IN ('DRAFT', 'ISSUED', 'ACKNOWLEDGED', 'CANCELLED', 'EXPIRED')),
    title               varchar(300) NOT NULL,
    message             text NOT NULL,
    target_geometry     geometry(Geometry, 4326),
    issued_at           timestamptz,
    expires_at          timestamptz,
    issuer_org_code     varchar(100),
    source_system       varchar(100) NOT NULL,
    source_record_id    varchar(200),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_alert_event_status ON core.alert(event_id, status);

CREATE TABLE core.alert_delivery (
    alert_delivery_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id            uuid NOT NULL REFERENCES core.alert(alert_id) ON DELETE CASCADE,
    recipient_type      varchar(20) NOT NULL CHECK (recipient_type IN ('PERSON', 'ORGANIZATION', 'SYSTEM')),
    recipient_key       varchar(300) NOT NULL,
    delivery_channel    varchar(30) NOT NULL,
    delivery_status     varchar(20) NOT NULL CHECK (delivery_status IN ('QUEUED', 'SENT', 'DELIVERED', 'FAILED', 'EXPIRED')),
    queued_at           timestamptz NOT NULL DEFAULT now(),
    sent_at             timestamptz,
    delivered_at        timestamptz,
    read_at             timestamptz,
    acknowledged_at     timestamptz,
    retry_count         integer NOT NULL DEFAULT 0,
    failure_reason      text,
    UNIQUE (alert_id, recipient_type, recipient_key, delivery_channel)
);

CREATE TABLE core.situation_report (
    report_id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    report_type         varchar(50) NOT NULL,
    reported_at         timestamptz NOT NULL,
    reporter_external_id varchar(200),
    reporter_org_code   varchar(100),
    geometry            geometry(Geometry, 4326),
    title               varchar(300),
    report_text         text NOT NULL,
    urgency             varchar(20) NOT NULL,
    status              varchar(20) NOT NULL,
    source_system       varchar(100) NOT NULL,
    source_record_id    varchar(200),
    created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE core.hazard_zone (
    hazard_zone_id      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    hazard_type         varchar(50) NOT NULL,
    severity            varchar(20) NOT NULL,
    geometry            geometry(Geometry, 4326) NOT NULL,
    valid_from          timestamptz NOT NULL,
    valid_to            timestamptz,
    source_type         varchar(30) NOT NULL,
    confidence          numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
    instructions        text,
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE core.route_guidance (
    route_id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    route_type          varchar(30) NOT NULL,
    route               geometry(LineStringZ, 4326) NOT NULL,
    destination         geometry(PointZ, 4326),
    valid_from          timestamptz NOT NULL,
    valid_to            timestamptz,
    status              varchar(20) NOT NULL,
    priority            integer,
    generated_by        varchar(30) NOT NULL,
    rationale           text,
    CHECK (valid_to IS NULL OR valid_to >= valid_from)
);

CREATE TABLE core.field_task (
    task_id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    parent_task_id      uuid REFERENCES core.field_task(task_id),
    task_code           varchar(100) NOT NULL UNIQUE,
    task_type           varchar(50) NOT NULL,
    title               varchar(300) NOT NULL,
    description         text,
    priority            integer NOT NULL DEFAULT 100,
    status              varchar(20) NOT NULL,
    work_area           geometry(Geometry, 4326),
    assigned_org_code   varchar(100),
    assignee_external_id varchar(200),
    instructed_at       timestamptz,
    started_at          timestamptz,
    completed_at        timestamptz,
    due_at              timestamptz,
    result_summary      text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ix_task_event_status ON core.field_task(event_id, status);

CREATE TABLE core.ai_analysis_result (
    analysis_result_id  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    input_uri           text,
    analysis_type       varchar(50) NOT NULL,
    target_type         varchar(80) NOT NULL,
    model_name          varchar(150) NOT NULL,
    model_version       varchar(100) NOT NULL,
    analyzed_at         timestamptz NOT NULL,
    result_geometry     geometry(Geometry, 4326),
    result_label        varchar(100),
    confidence          numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
    source_references   jsonb NOT NULL DEFAULT '[]'::jsonb,
    result              jsonb NOT NULL DEFAULT '{}'::jsonb,
    review_status       varchar(20) NOT NULL DEFAULT 'UNREVIEWED'
);

CREATE TABLE core.decision_recommendation (
    recommendation_id   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    recommendation_type varchar(50) NOT NULL,
    generated_at        timestamptz NOT NULL,
    valid_until         timestamptz,
    priority            integer,
    target_asset_id     uuid REFERENCES core.asset(asset_id),
    target_task_id      uuid REFERENCES core.field_task(task_id),
    recommended_geometry geometry(Geometry, 4326),
    recommended_action  text NOT NULL,
    rationale           text NOT NULL,
    confidence          numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
    status              varchar(20) NOT NULL,
    decided_by_external_id varchar(200),
    decided_at          timestamptz,
    source_references   jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE wildfire.event_detail (
    event_id            uuid PRIMARY KEY REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    ignition_cause      varchar(100),
    fire_level          varchar(30),
    burned_area_m2      numeric,
    containment_pct     numeric(5,2),
    wind_direction_deg  numeric(5,2),
    wind_speed_mps      numeric,
    updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE wildfire.fireline (
    fireline_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    observed_at         timestamptz NOT NULL,
    fireline            geometry(MultiLineString, 4326) NOT NULL,
    flame_height_m      numeric,
    spread_rate_mpm     numeric,
    confidence          numeric(5,4),
    source_system       varchar(100) NOT NULL
);

CREATE TABLE wildfire.spread_prediction (
    prediction_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    model_name          varchar(150) NOT NULL,
    model_version       varchar(100) NOT NULL,
    base_time           timestamptz NOT NULL,
    forecast_time       timestamptz NOT NULL,
    predicted_area      geometry(MultiPolygon, 4326) NOT NULL,
    confidence          numeric(5,4),
    source_references   jsonb NOT NULL DEFAULT '[]'::jsonb,
    CHECK (forecast_time > base_time)
);

CREATE INDEX ix_wildfire_prediction_time ON wildfire.spread_prediction(event_id, forecast_time);

CREATE TABLE wildfire.communication_coverage (
    coverage_id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    observed_at         timestamptz NOT NULL,
    network_type        varchar(50) NOT NULL,
    coverage_area       geometry(MultiPolygon, 4326) NOT NULL,
    shadow_area         geometry(MultiPolygon, 4326),
    signal_min_dbm      numeric,
    signal_avg_dbm      numeric,
    source_references   jsonb NOT NULL DEFAULT '[]'::jsonb
);

CREATE TABLE wildfire.rtk_lpwa_gateway_status (
    gateway_status_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    reported_by_asset_id uuid REFERENCES core.asset(asset_id),
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

CREATE TABLE wildfire.tvws_link_observation (
    observation_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    base_asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    cpe_asset_id uuid NOT NULL REFERENCES core.asset(asset_id),
    reported_by_asset_id uuid REFERENCES core.asset(asset_id),
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

CREATE INDEX ix_rtk_lpwa_gateway_event_time
    ON wildfire.rtk_lpwa_gateway_status(event_id, observed_at DESC);
CREATE INDEX ix_tvws_link_event_time
    ON wildfire.tvws_link_observation(event_id, observed_at DESC);

CREATE TABLE landslide.event_detail (
    event_id            uuid PRIMARY KEY REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    landslide_type      varchar(50),
    estimated_volume_m3 numeric,
    affected_area_m2    numeric,
    trigger_type        varchar(50),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- DEM·토양·지질·강우 원본은 외부에서 조회하고 분석결과와 원천 참조만 저장한다.
CREATE TABLE landslide.slope_assessment (
    assessment_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    external_slope_id   varchar(200),
    assessed_at         timestamptz NOT NULL,
    geometry            geometry(Geometry, 4326),
    risk_score          numeric,
    risk_level          varchar(30) NOT NULL,
    safety_factor       numeric,
    probability         numeric(5,4),
    model_name          varchar(150),
    model_version       varchar(100),
    source_references   jsonb NOT NULL DEFAULT '[]'::jsonb,
    result              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX ix_slope_assessment_time ON landslide.slope_assessment(event_id, assessed_at);

CREATE TABLE landslide.debris_flow_prediction (
    prediction_id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    external_slope_id   varchar(200),
    base_time           timestamptz NOT NULL,
    forecast_time       timestamptz,
    flow_path           geometry(MultiLineStringZ, 4326),
    affected_area       geometry(MultiPolygon, 4326),
    estimated_volume_m3 numeric,
    max_velocity_mps    numeric,
    source_references   jsonb NOT NULL DEFAULT '[]'::jsonb,
    result              jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE landslide.victim_candidate (
    victim_candidate_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid NOT NULL REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    candidate_token     varchar(200) NOT NULL,
    detection_status    varchar(30) NOT NULL,
    first_detected_at   timestamptz NOT NULL,
    last_detected_at    timestamptz NOT NULL,
    estimated_position  geometry(PointZ, 4326),
    estimated_depth_m   numeric,
    confidence          numeric(5,4),
    signal_types        jsonb NOT NULL DEFAULT '[]'::jsonb,
    UNIQUE (event_id, candidate_token)
);

CREATE TABLE landslide.rssi_detection (
    detection_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id            uuid REFERENCES core.disaster_event(event_id) ON DELETE CASCADE,
    victim_candidate_id uuid REFERENCES landslide.victim_candidate(victim_candidate_id) ON DELETE SET NULL,
    target_token        varchar(200) NOT NULL,
    detector_asset_id   uuid NOT NULL REFERENCES core.asset(asset_id),
    detected_at         timestamptz NOT NULL,
    detector_position   geometry(PointZ, 4326) NOT NULL,
    rssi_dbm            numeric NOT NULL,
    frequency_mhz       numeric,
    estimated_position  geometry(PointZ, 4326),
    estimated_depth_m   numeric,
    confidence          numeric(5,4),
    method              varchar(50) NOT NULL,
    UNIQUE (target_token, detector_asset_id, detected_at)
);

CREATE INDEX ix_rssi_event_time ON landslide.rssi_detection(event_id, detected_at);

ALTER TABLE core.device_credential ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.personnel_device_assignment ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.reporting_route ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.communication_topology_node ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.communication_topology_link ENABLE ROW LEVEL SECURITY;
ALTER TABLE wildfire.rtk_lpwa_gateway_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE wildfire.tvws_link_observation ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE core.device_credential FROM anon, authenticated;
REVOKE ALL ON TABLE core.personnel_device_assignment FROM anon, authenticated;
REVOKE ALL ON TABLE core.reporting_route FROM anon, authenticated;
REVOKE ALL ON TABLE core.communication_topology_node FROM anon, authenticated;
REVOKE ALL ON TABLE core.communication_topology_link FROM anon, authenticated;
REVOKE ALL ON TABLE wildfire.rtk_lpwa_gateway_status FROM anon, authenticated;
REVOKE ALL ON TABLE wildfire.tvws_link_observation FROM anon, authenticated;

GRANT USAGE ON SCHEMA core TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE core.device_credential TO service_role;
GRANT SELECT, INSERT, UPDATE ON TABLE core.personnel_device_assignment TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.reporting_route TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.communication_topology_node TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.communication_topology_link TO service_role;

GRANT USAGE ON SCHEMA core, wildfire, landslide TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core, wildfire, landslide TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core, wildfire, landslide TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, wildfire, landslide
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA core, wildfire, landslide
    GRANT USAGE, SELECT ON SEQUENCES TO service_role;

COMMIT;
