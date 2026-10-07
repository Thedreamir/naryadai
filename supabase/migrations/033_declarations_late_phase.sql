-- Phase 'pre_work_late': declarations recorded after work already started (failed insert retry path).
ALTER TABLE public.order_declarations DROP CONSTRAINT order_declarations_phase_check;
ALTER TABLE public.order_declarations ADD CONSTRAINT order_declarations_phase_check
  CHECK (phase IN ('before_intake','baseline_after_start','pre_work','pre_work_at_surrender','post_work','pre_work_late'));
