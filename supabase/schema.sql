-- PlainTerms database schema
-- Run this against your Supabase project SQL editor

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Waitlist / email capture leads
CREATE TABLE IF NOT EXISTS waitlist_leads (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  email text NOT NULL,
  vertical text,
  locale text,
  utm jsonb,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Index for deduplication checks
CREATE UNIQUE INDEX IF NOT EXISTS waitlist_leads_email_idx ON waitlist_leads (email);

-- Row Level Security
ALTER TABLE waitlist_leads ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (for email capture without login)
CREATE POLICY "Allow anonymous insert" ON waitlist_leads
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Deny anonymous reads (protect collected emails)
CREATE POLICY "Deny anonymous select" ON waitlist_leads
  FOR SELECT
  TO anon
  USING (false);

-- Allow authenticated insert (so logged-in / anonymous auth users can capture leads)
CREATE POLICY "Allow authenticated insert" ON waitlist_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read (for admin/dashboard later)
CREATE POLICY "Allow authenticated select" ON waitlist_leads
  FOR SELECT
  TO authenticated
  USING (true);

-- ============================================================
-- Phase B: profiles, reports, entitlements
-- ============================================================

-- User profile layer (linked to auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  locale text,
  marketing_consent boolean DEFAULT false,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own profile select" ON profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Own profile insert" ON profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "Own profile update" ON profiles
  FOR UPDATE TO authenticated USING (id = auth.uid());

-- Structured report storage
CREATE TABLE IF NOT EXISTS reports (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL,
  locale text,
  source_type text,
  title text,
  status text DEFAULT 'complete',
  schema_version text NOT NULL DEFAULT 'pt_report_v0',
  report_json jsonb NOT NULL,
  input_char_count int,
  source_fingerprint text
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own reports select" ON reports
  FOR SELECT TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Own reports insert" ON reports
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Own reports update" ON reports
  FOR UPDATE TO authenticated USING (owner_id = auth.uid());
CREATE POLICY "Own reports delete" ON reports
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE INDEX IF NOT EXISTS reports_owner_created_idx
  ON reports (owner_id, created_at DESC);

-- Entitlements / payments placeholder (schema only, no Stripe wiring)
CREATE TABLE IF NOT EXISTS entitlements (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  report_id uuid REFERENCES reports(id) ON DELETE SET NULL,
  kind text,
  status text DEFAULT 'active',
  stripe_customer_id text,
  stripe_payment_intent_id text,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Own entitlements select" ON entitlements
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS entitlements_user_idx
  ON entitlements (user_id);
