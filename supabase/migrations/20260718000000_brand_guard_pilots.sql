-- Time-bounded Brand Guard pilots. The linked subscription is intentionally
-- separate from Stripe subscriptions so expiration cannot disable paid access.
CREATE TABLE IF NOT EXISTS brand_guard_pilots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  promo_code TEXT NOT NULL CHECK (promo_code = 'BGPILOT30'),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'canceled')),
  subscription_id UUID NOT NULL UNIQUE REFERENCES brand_guard_subscriptions(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'signup' CHECK (source IN ('signup', 'admin')),
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  expired_at TIMESTAMPTZ,
  notification_sent_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (ends_at = started_at + INTERVAL '30 days')
);

CREATE INDEX IF NOT EXISTS idx_brand_guard_pilots_due
  ON brand_guard_pilots(status, ends_at);

ALTER TABLE brand_guard_pilots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Brand Guard pilot" ON brand_guard_pilots;
CREATE POLICY "Users can view own Brand Guard pilot"
  ON brand_guard_pilots FOR SELECT
  USING (auth.uid() = owner_id);

GRANT SELECT ON brand_guard_pilots TO authenticated;

CREATE TABLE IF NOT EXISTS brand_guard_pilot_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT NOT NULL,
  company_name TEXT NOT NULL,
  brand_name TEXT NOT NULL,
  website TEXT NOT NULL,
  concern TEXT NOT NULL,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'fulfilled', 'declined')),
  approval_mode TEXT CHECK (approval_mode IN ('direct', 'invite')),
  approval_token TEXT UNIQUE,
  pilot_id UUID REFERENCES brand_guard_pilots(id) ON DELETE SET NULL,
  reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_guard_pilot_requests_status
  ON brand_guard_pilot_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_brand_guard_pilot_requests_email
  ON brand_guard_pilot_requests(lower(email));

CREATE INDEX IF NOT EXISTS idx_brand_guard_pilot_requests_token
  ON brand_guard_pilot_requests(approval_token)
  WHERE approval_token IS NOT NULL;

ALTER TABLE brand_guard_pilot_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own Brand Guard pilot requests" ON brand_guard_pilot_requests;
CREATE POLICY "Users can view own Brand Guard pilot requests"
  ON brand_guard_pilot_requests FOR SELECT
  USING (auth.uid() = owner_id OR lower(email) = lower(auth.jwt() ->> 'email'));

GRANT SELECT ON brand_guard_pilot_requests TO authenticated;
