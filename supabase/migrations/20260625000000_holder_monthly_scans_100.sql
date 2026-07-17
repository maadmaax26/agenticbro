-- Increase AgenticBro holder tier monthly scan allowance from 50 to 100.

CREATE OR REPLACE FUNCTION update_user_tier(
  p_user_id    UUID,
  p_balance    BIGINT,
  p_usd_value  DECIMAL
)
RETURNS TABLE (
  tier             TEXT,
  monthly_limit    INT,
  is_new_tier      BOOLEAN
) AS $$
DECLARE
  v_old_tier   TEXT;
  v_new_tier   TEXT;
  v_new_limit  INT;
BEGIN
  SELECT user_profiles.tier INTO v_old_tier FROM user_profiles WHERE id = p_user_id;

  IF p_usd_value >= 1000 THEN
    v_new_tier := 'whale';
    v_new_limit := -1;
  ELSIF p_usd_value >= 100 THEN
    v_new_tier := 'holder';
    v_new_limit := 100;
  ELSE
    v_new_tier := 'free';
    v_new_limit := 5;
  END IF;

  UPDATE user_profiles
  SET
    tier                   = v_new_tier,
    monthly_scans_limit    = v_new_limit,
    last_known_balance     = p_balance,
    last_known_usd_value   = p_usd_value,
    last_entitlement_check = NOW()
  WHERE id = p_user_id;

  RETURN QUERY SELECT v_new_tier, v_new_limit, (v_old_tier IS DISTINCT FROM v_new_tier);
END;
$$ LANGUAGE plpgsql;

UPDATE user_profiles
SET monthly_scans_limit = 100
WHERE tier = 'holder'
  AND monthly_scans_limit = 50;
