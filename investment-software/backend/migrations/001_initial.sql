CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS users(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),email text NOT NULL UNIQUE,password_hash text NOT NULL,role text NOT NULL DEFAULT 'viewer' CHECK(role IN ('admin','editor','viewer')),created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS projects(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),owner_id uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,name varchar(80) NOT NULL CHECK(char_length(trim(name))>=2),category text NOT NULL CHECK(category IN ('applications','websites','forums','stores','social')),status text NOT NULL CHECK(status IN ('draft','active','review')),description varchar(500) NOT NULL DEFAULT '',created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS projects_owner_updated_idx ON projects(owner_id,updated_at DESC);
CREATE TABLE IF NOT EXISTS audit_events(id bigserial PRIMARY KEY,actor_id uuid REFERENCES users(id) ON DELETE SET NULL,action text NOT NULL,resource_type text NOT NULL,resource_id text,metadata jsonb NOT NULL DEFAULT '{}'::jsonb,created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS audit_events_actor_created_idx ON audit_events(actor_id,created_at DESC);
CREATE OR REPLACE FUNCTION prevent_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'audit_events are append-only'; END; $$;
DROP TRIGGER IF EXISTS audit_events_no_update ON audit_events;
CREATE TRIGGER audit_events_no_update BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION prevent_audit_mutation();
