
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  result jsonb;
BEGIN
  EXECUTE query;
  GET DIAGNOSTICS result = ROW_COUNT;
  RETURN jsonb_build_object('rows_affected', result);
EXCEPTION WHEN OTHERS THEN
  RAISE;
END;
$$;

-- Only allow service role to call this
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM authenticated;
REVOKE ALL ON FUNCTION public.exec_sql(text) FROM anon;
