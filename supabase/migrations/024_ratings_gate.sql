-- 024: employee_ratings restricted server-side - worker callers see only their own row.
create or replace view public.employee_ratings with (security_invoker=true) as  WITH facts AS (
         SELECT o.id,
            o.title,
            o.kind,
            o.equipment_id,
            o.assignee_id,
            o.master_id,
            o.priority,
            o.status,
            o.deadline,
            o.created_at,
            o.started_at,
            o.closed_at,
            o.version,
            o.closure,
            o.ai_result,
            (EXISTS ( SELECT 1
                   FROM orders newer
                  WHERE ((newer.equipment_id = o.equipment_id) AND ((newer.closure ->> 'fault_code'::text) = (o.closure ->> 'fault_code'::text)) AND (newer.created_at > o.closed_at) AND (newer.created_at <= (o.closed_at + '7 days'::interval))))) AS repeat_7d,
                CASE
                    WHEN (jsonb_typeof((o.ai_result -> 'human_score'::text)) = 'number'::text) THEN ((o.ai_result ->> 'human_score'::text))::numeric
                    ELSE NULL::numeric
                END AS human_score,
            (EXISTS ( SELECT 1
                   FROM order_events ev
                  WHERE ((ev.order_id = o.id) AND (ev.new_status = 'rework'::text)))) AS reworked
           FROM orders o
        ), summary AS (
         SELECT facts.assignee_id,
            count(*) FILTER (WHERE (facts.status = 'closed'::text)) AS closed,
            count(*) FILTER (WHERE ((facts.status = 'closed'::text) AND (facts.closed_at <= facts.deadline))) AS timely,
            count(*) FILTER (WHERE ((facts.status = 'closed'::text) AND (facts.reworked OR facts.repeat_7d))) AS returned_or_repeated,
            count(*) FILTER (WHERE (facts.status = 'rejected'::text)) AS rejected,
            count(facts.human_score) FILTER (WHERE (facts.status = 'closed'::text)) AS quality_count,
            avg(facts.human_score) FILTER (WHERE (facts.status = 'closed'::text)) AS quality_average,
            sum(
                CASE facts.priority
                    WHEN 'emergency'::text THEN 3
                    WHEN 'high'::text THEN 2
                    ELSE 1
                END) FILTER (WHERE (facts.status = 'closed'::text)) AS weighted_volume
           FROM facts
          GROUP BY facts.assignee_id
        )
 SELECT e.id,
    e.name,
    COALESCE(s.closed, (0)::bigint) AS closed,
    COALESCE(s.timely, (0)::bigint) AS timely,
    COALESCE(s.returned_or_repeated, (0)::bigint) AS returned_or_repeated,
    COALESCE(s.rejected, (0)::bigint) AS rejected,
    s.quality_average,
    COALESCE(s.weighted_volume, (0)::bigint) AS weighted_volume,
        CASE
            WHEN ((s.closed > 0) AND (s.quality_average IS NOT NULL) AND (s.quality_count = s.closed)) THEN round((((((((40)::numeric * s.quality_average) / (5)::numeric) + (((25)::numeric * (s.timely)::numeric) / (s.closed)::numeric)) + ((20)::numeric * ((1)::numeric - ((s.returned_or_repeated)::numeric / (s.closed)::numeric)))) + ((10)::numeric * LEAST((1)::numeric, ((s.weighted_volume)::numeric / (50)::numeric)))) + ((5)::numeric * ((1)::numeric - LEAST((1)::numeric, ((s.rejected)::numeric / (GREATEST((1)::bigint, (s.closed + s.rejected)))::numeric))))), 1)
            ELSE NULL::numeric
        END AS full_score
   FROM (employees e
     LEFT JOIN summary s ON ((s.assignee_id = e.id)))
  WHERE (e.role = 'worker'::text) AND ((e.id = auth.uid()) OR ((SELECT employees_1.role FROM public.employees employees_1 WHERE (employees_1.id = auth.uid())) = ANY (ARRAY['master'::text, 'admin'::text, 'leader'::text])));
