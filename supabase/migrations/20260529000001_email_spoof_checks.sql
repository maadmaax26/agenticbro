-- Email Spoof Check Results
CREATE TABLE IF NOT EXISTS public.email_spoof_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id TEXT UNIQUE NOT NULL,
  domain TEXT NOT NULL,
  brand_monitor_id UUID REFERENCES public.brand_monitors(id) ON DELETE SET NULL,
  overall_score INTEGER DEFAULT 0,
  vulnerability_level TEXT DEFAULT 'UNKNOWN',
  spoofable BOOLEAN DEFAULT false,
  new_threats_count INTEGER DEFAULT 0,
  result JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_spoof_domain ON public.email_spoof_checks(domain);
CREATE INDEX IF NOT EXISTS idx_email_spoof_brand ON public.email_spoof_checks(brand_monitor_id);
CREATE INDEX IF NOT EXISTS idx_email_spoof_created ON public.email_spoof_checks(created_at DESC);