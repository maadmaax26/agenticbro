CREATE TABLE IF NOT EXISTS public.scan_credit_accounts (
  owner_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  paid_credits INTEGER NOT NULL DEFAULT 0 CHECK (paid_credits >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_purchased >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scan_credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'admin')),
  payment_reference TEXT UNIQUE,
  amount_usd NUMERIC(10,2),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_credit_transactions_owner_created
  ON public.scan_credit_transactions(owner_id, created_at DESC);

ALTER TABLE public.scan_credit_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own scan credit account"
  ON public.scan_credit_accounts FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE POLICY "Users can view own scan credit transactions"
  ON public.scan_credit_transactions FOR SELECT TO authenticated
  USING (auth.uid() = owner_id);

CREATE OR REPLACE FUNCTION public.add_scan_credits(
  p_owner_id UUID,
  p_credits INTEGER,
  p_reference TEXT,
  p_amount_usd NUMERIC DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_balance INTEGER;
BEGIN
  IF p_credits <= 0 OR p_reference IS NULL OR length(p_reference) < 8 THEN
    RAISE EXCEPTION 'invalid credit grant';
  END IF;

  INSERT INTO scan_credit_transactions(owner_id, amount, transaction_type, payment_reference, amount_usd)
  VALUES (p_owner_id, p_credits, 'purchase', p_reference, p_amount_usd)
  ON CONFLICT (payment_reference) DO NOTHING;

  IF NOT FOUND THEN
    SELECT paid_credits INTO v_balance FROM scan_credit_accounts WHERE owner_id = p_owner_id;
    RETURN jsonb_build_object('success', true, 'idempotent', true, 'paid_credits', COALESCE(v_balance, 0));
  END IF;

  INSERT INTO scan_credit_accounts(owner_id, paid_credits, lifetime_purchased)
  VALUES (p_owner_id, p_credits, p_credits)
  ON CONFLICT (owner_id) DO UPDATE SET
    paid_credits = scan_credit_accounts.paid_credits + EXCLUDED.paid_credits,
    lifetime_purchased = scan_credit_accounts.lifetime_purchased + EXCLUDED.lifetime_purchased,
    updated_at = now()
  RETURNING paid_credits INTO v_balance;

  RETURN jsonb_build_object('success', true, 'idempotent', false, 'paid_credits', v_balance);
END;
$$;

CREATE OR REPLACE FUNCTION public.deduct_scan_credit(p_owner_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_balance INTEGER;
BEGIN
  UPDATE scan_credit_accounts
  SET paid_credits = paid_credits - 1, updated_at = now()
  WHERE owner_id = p_owner_id AND paid_credits > 0
  RETURNING paid_credits INTO v_balance;

  IF v_balance IS NULL THEN
    RETURN jsonb_build_object('success', false, 'paid_credits', 0);
  END IF;

  INSERT INTO scan_credit_transactions(owner_id, amount, transaction_type)
  VALUES (p_owner_id, -1, 'usage');
  RETURN jsonb_build_object('success', true, 'paid_credits', v_balance);
END;
$$;

REVOKE ALL ON FUNCTION public.add_scan_credits(UUID, INTEGER, TEXT, NUMERIC) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.add_scan_credits(UUID, INTEGER, TEXT, NUMERIC) TO service_role;
REVOKE ALL ON FUNCTION public.deduct_scan_credit(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.deduct_scan_credit(UUID) TO service_role;
