-- Keep driver_service_areas populated from provider signup service_areas.
CREATE OR REPLACE FUNCTION public.sync_driver_service_areas_from_signup(p_driver_id uuid)
RETURNS text[]
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_signup_id uuid;
  v_info jsonb;
  v_states text[] := ARRAY[]::text[];
  v_state text;
  v_area jsonb;
  v_existing int;
BEGIN
  IF p_driver_id IS NULL THEN
    RETURN v_states;
  END IF;

  SELECT count(*) INTO v_existing
  FROM public.driver_service_areas
  WHERE driver_id = p_driver_id;

  IF v_existing > 0 THEN
    SELECT coalesce(array_agg(state ORDER BY state), ARRAY[]::text[])
    INTO v_states
    FROM public.driver_service_areas
    WHERE driver_id = p_driver_id;
    RETURN v_states;
  END IF;

  SELECT provider_signup_id INTO v_signup_id
  FROM public.drivers
  WHERE id = p_driver_id;

  IF v_signup_id IS NULL THEN
    RETURN v_states;
  END IF;

  SELECT provider_info INTO v_info
  FROM public.provider_signups
  WHERE id = v_signup_id;

  IF v_info IS NULL THEN
    RETURN v_states;
  END IF;

  IF jsonb_typeof(v_info->'service_areas') = 'array' THEN
    FOR v_area IN SELECT * FROM jsonb_array_elements(v_info->'service_areas')
    LOOP
      v_state := upper(trim(coalesce(v_area->>'state', '')));
      IF length(v_state) = 2 THEN
        v_states := array_append(v_states, v_state);
      END IF;
    END LOOP;
  END IF;

  IF coalesce(array_length(v_states, 1), 0) = 0 THEN
    v_state := upper(trim(coalesce(v_info->>'service_area', '')));
    IF v_state ~ '^[A-Z]{2}$' THEN
      v_states := array_append(v_states, v_state);
    ELSIF position(',' in v_state) > 0 THEN
      v_state := upper(trim(split_part(v_info->>'service_area', ',', 2)));
      IF length(v_state) = 2 THEN
        v_states := array_append(v_states, v_state);
      END IF;
    END IF;
  END IF;

  v_states := (
    SELECT coalesce(array_agg(DISTINCT s), ARRAY[]::text[])
    FROM unnest(v_states) AS s
  );

  FOREACH v_state IN ARRAY v_states LOOP
    INSERT INTO public.driver_service_areas (driver_id, state)
    VALUES (p_driver_id, v_state)
    ON CONFLICT (driver_id, state) DO NOTHING;
  END LOOP;

  RETURN v_states;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trg_drivers_sync_service_areas()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  PERFORM public.sync_driver_service_areas_from_signup(NEW.id);
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS drivers_sync_service_areas ON public.drivers;
CREATE TRIGGER drivers_sync_service_areas
AFTER INSERT OR UPDATE OF provider_signup_id, status
ON public.drivers
FOR EACH ROW
EXECUTE FUNCTION public.trg_drivers_sync_service_areas();
