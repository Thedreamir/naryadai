-- Transactional start: transition + pre-work declarations in ONE transaction.
-- Either both persist or neither does; a failed start leaves no declaration rows.
ALTER TABLE public.order_declarations ADD COLUMN IF NOT EXISTS excluded_from_evidence boolean NOT NULL DEFAULT false;
ALTER TABLE public.order_declarations ADD COLUMN IF NOT EXISTS exclusion_note text;

CREATE OR REPLACE FUNCTION public.start_work_with_declarations(p_order_id bigint, p_expected_version integer, p_texts text[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
DECLARE r jsonb;
BEGIN
  r := public.transition_order(p_order_id,'in_progress',p_expected_version,'',null,null,'');
  INSERT INTO public.order_declarations (order_id, declared_by, phase, text)
  SELECT p_order_id, auth.uid(), 'pre_work', t FROM unnest(p_texts) AS t;
  RETURN r;
END $$;
REVOKE ALL ON FUNCTION public.start_work_with_declarations(bigint,integer,text[]) FROM public;
GRANT EXECUTE ON FUNCTION public.start_work_with_declarations(bigint,integer,text[]) TO authenticated;
