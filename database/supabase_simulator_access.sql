-- 테스트 서버 전용 Supabase Data API 접근 권한
-- Dashboard Data API 설정에서 core, wildfire, landslide 스키마 노출 후 실행한다.
-- anon/authenticated에는 권한을 부여하지 않는다.

BEGIN;

GRANT USAGE ON SCHEMA core, wildfire, landslide TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA wildfire TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA landslide TO service_role;

REVOKE ALL ON ALL TABLES IN SCHEMA core FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA wildfire FROM anon, authenticated;
REVOKE ALL ON ALL TABLES IN SCHEMA landslide FROM anon, authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA core REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA wildfire REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA landslide REVOKE ALL ON TABLES FROM anon, authenticated;

DO $$
DECLARE
    target record;
BEGIN
    FOR target IN
        SELECT schemaname, tablename
        FROM pg_tables
        WHERE schemaname IN ('core', 'wildfire', 'landslide')
    LOOP
        EXECUTE format(
            'ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',
            target.schemaname,
            target.tablename
        );
    END LOOP;
END
$$;

COMMIT;
