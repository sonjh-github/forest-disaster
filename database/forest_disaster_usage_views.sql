CREATE VIEW core.v_latest_asset_status AS
SELECT *
FROM (
    SELECT s.*,
           ROW_NUMBER() OVER (PARTITION BY s.asset_id ORDER BY s.observed_at DESC, s.asset_status_id DESC) AS row_no
    FROM core.asset_status s
) ranked
WHERE ranked.row_no = 1;

CREATE VIEW core.v_latest_person_position AS
SELECT *
FROM (
    SELECT p.*,
           ROW_NUMBER() OVER (PARTITION BY p.event_id, p.person_external_id ORDER BY p.observed_at DESC, p.position_id DESC) AS row_no
    FROM core.personnel_position p
) ranked
WHERE ranked.row_no = 1;

CREATE VIEW core.v_current_network_status AS
SELECT *
FROM (
    SELECT h.*,
           ROW_NUMBER() OVER (PARTITION BY h.network_id ORDER BY h.started_at DESC, h.network_status_id DESC) AS row_no
    FROM core.network_status_history h
) ranked
WHERE ranked.row_no = 1;

CREATE VIEW core.v_unacknowledged_alert_delivery AS
SELECT
    a.alert_id,
    a.event_id,
    a.severity,
    a.title,
    a.issued_at,
    d.alert_delivery_id,
    d.recipient_type,
    d.recipient_key,
    d.delivery_channel,
    d.delivery_status,
    d.delivered_at
FROM core.alert a
JOIN core.alert_delivery d ON d.alert_id = a.alert_id
WHERE a.status = 'ISSUED'
  AND d.acknowledged_at IS NULL
  AND d.delivery_status IN ('SENT', 'DELIVERED');

CREATE VIEW landslide.v_victim_candidate_detection_summary AS
SELECT
    c.victim_candidate_id,
    c.event_id,
    c.candidate_token,
    c.detection_status,
    c.estimated_position,
    c.estimated_depth_m,
    c.confidence,
    COALESCE(d.detection_count, 0) AS detection_count,
    d.latest_detection_at,
    d.strongest_rssi_dbm
FROM landslide.victim_candidate c
LEFT JOIN (
    SELECT victim_candidate_id,
           COUNT(*) AS detection_count,
           MAX(detected_at) AS latest_detection_at,
           MAX(rssi_dbm) AS strongest_rssi_dbm
    FROM landslide.rssi_detection
    WHERE victim_candidate_id IS NOT NULL
    GROUP BY victim_candidate_id
) d ON d.victim_candidate_id = c.victim_candidate_id;
