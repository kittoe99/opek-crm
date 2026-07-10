-- Dedupe drivers + unique email/signup + assign_job uses canonical driver.
-- Applied remotely via MCP; kept here for repo history.

CREATE OR REPLACE FUNCTION public.canonical_driver_id(p_driver_id uuid)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_email text;
  v_signup uuid;
  v_keep uuid;
BEGIN
  SELECT lower(trim(email)), provider_signup_id
  INTO v_email, v_signup
  FROM public.drivers
  WHERE id = p_driver_id;

  IF v_email IS NULL OR v_email = '' THEN
    RETURN p_driver_id;
  END IF;

  SELECT id INTO v_keep
  FROM public.drivers
  WHERE lower(trim(email)) = v_email
     OR (v_signup IS NOT NULL AND provider_signup_id = v_signup)
  ORDER BY
    (user_id IS NOT NULL) DESC,
    (identity_status = 'verified') DESC,
    (status = 'approved') DESC,
    created_at ASC
  LIMIT 1;

  RETURN coalesce(v_keep, p_driver_id);
END;
$function$;

CREATE UNIQUE INDEX IF NOT EXISTS drivers_email_unique_ci
  ON public.drivers (lower(trim(email)))
  WHERE email IS NOT NULL AND trim(email) <> '';

CREATE UNIQUE INDEX IF NOT EXISTS drivers_provider_signup_id_unique
  ON public.drivers (provider_signup_id)
  WHERE provider_signup_id IS NOT NULL;
