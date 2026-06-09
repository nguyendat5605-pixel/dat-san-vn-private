-- init.sql
-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 2. User rieng cho app (khong dung postgres superuser)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'datsanvn_app') THEN
        CREATE USER datsanvn_app WITH PASSWORD 'datsanvn_app_strongpass_2026';
    END IF;
END
$$;

-- 3. Grant quyen
GRANT ALL PRIVILEGES ON DATABASE datsanvn TO datsanvn_app;
ALTER USER datsanvn_app CREATEDB;

-- 4. Grant schema public
GRANT ALL ON SCHEMA public TO datsanvn_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO datsanvn_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO datsanvn_app;
