CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS api_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider varchar(60) NOT NULL,
  label varchar(100) NOT NULL,
  key_ciphertext text NOT NULL,
  key_iv text NOT NULL,
  key_auth_tag text NOT NULL,
  key_fingerprint varchar(16) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS api_credentials_created_idx ON api_credentials(created_at DESC);
CREATE TABLE IF NOT EXISTS control_audit_events (
  id bigserial PRIMARY KEY,
  action varchar(80) NOT NULL,
  credential_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS control_audit_created_idx ON control_audit_events(created_at DESC);
CREATE OR REPLACE FUNCTION prevent_control_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'control_audit_events are append-only'; END; $$;
DROP TRIGGER IF EXISTS control_audit_no_mutation ON control_audit_events;
CREATE TRIGGER control_audit_no_mutation BEFORE UPDATE OR DELETE ON control_audit_events
FOR EACH ROW EXECUTE FUNCTION prevent_control_audit_mutation();
