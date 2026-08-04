-- Existing Supabase/PostgreSQL deployment extension for the communication topology API.
-- Apply after forest_disaster_schema.sql when upgrading an already-created database.

BEGIN;

CREATE TABLE IF NOT EXISTS core.communication_topology_node (
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

CREATE INDEX IF NOT EXISTS ix_topology_node_network_layer
    ON core.communication_topology_node(network_id, topology_layer, sort_order);

CREATE TABLE IF NOT EXISTS core.communication_topology_link (
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

CREATE INDEX IF NOT EXISTS ix_topology_link_network_status
    ON core.communication_topology_link(network_id, status, priority);

ALTER TABLE core.communication_topology_node ENABLE ROW LEVEL SECURITY;
ALTER TABLE core.communication_topology_link ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE core.communication_topology_node FROM anon, authenticated;
REVOKE ALL ON TABLE core.communication_topology_link FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.communication_topology_node TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE core.communication_topology_link TO service_role;

COMMIT;
