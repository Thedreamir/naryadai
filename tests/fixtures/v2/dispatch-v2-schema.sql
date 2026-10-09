-- Apply only after reviewing live telegram_deliveries schema. No sends/enable/fanout.
BEGIN;
DO $$ DECLARE d text; BEGIN
 IF to_regclass('public.telegram_deliveries') IS NULL THEN RAISE EXCEPTION 'Foundation absent'; END IF;
 SELECT pg_get_constraintdef(oid) INTO d FROM pg_constraint WHERE conrelid='public.telegram_deliveries'::regclass AND conname='telegram_deliveries_state_check';
 IF d IS NULL OR d NOT LIKE '%claimed%' OR d NOT LIKE '%failed%' OR d LIKE '%retryable%' THEN RAISE EXCEPTION 'Unexpected state constraint; stop'; END IF;
END $$;
ALTER TABLE telegram_deliveries DROP CONSTRAINT telegram_deliveries_state_check;
ALTER TABLE telegram_deliveries ADD CONSTRAINT telegram_deliveries_state_check CHECK(state IN ('claimed','sending','sent','failed','unknown','cancelled','retryable','permanent'));
ALTER TABLE telegram_deliveries ADD COLUMN claim_token uuid,ADD COLUMN attempts integer NOT NULL DEFAULT 1,ADD COLUMN retry_at timestamptz;
CREATE OR REPLACE FUNCTION telegram_claim_v2(p_notification bigint,p_employee uuid) RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$
DECLARE r telegram_deliveries; t uuid:=gen_random_uuid(); BEGIN
 INSERT INTO telegram_deliveries(notification_id,employee_id,state,claim_token) VALUES(p_notification,p_employee,'claimed',t) ON CONFLICT DO NOTHING;
 SELECT * INTO r FROM telegram_deliveries WHERE notification_id=p_notification AND employee_id=p_employee FOR UPDATE;
 IF r.claim_token=t THEN RETURN t; END IF;
 -- A crashed sending worker may have sent. Never reclaim it as retryable.
 IF r.state='sending' AND r.claimed_at<now()-interval '2 minutes' THEN UPDATE telegram_deliveries SET state='unknown',finished_at=now() WHERE notification_id=p_notification AND employee_id=p_employee;RETURN NULL;END IF;
 -- A stale claimed worker has NOT crossed the begin-send gate; rotate token.
 IF (r.state='claimed' AND r.claimed_at<now()-interval '2 minutes') OR (r.state='retryable' AND r.retry_at<=now()) THEN
 IF r.attempts>=3 THEN UPDATE telegram_deliveries SET state='permanent',finished_at=now() WHERE notification_id=p_notification AND employee_id=p_employee;RETURN NULL;END IF;
 UPDATE telegram_deliveries SET state='claimed',claim_token=t,claimed_at=now(),finished_at=NULL,retry_at=NULL,attempts=attempts+1 WHERE notification_id=p_notification AND employee_id=p_employee;RETURN t;END IF;
 RETURN NULL;
END $$;
CREATE OR REPLACE FUNCTION telegram_begin_send_v2(p_notification bigint,p_employee uuid,p_token uuid) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE n integer; BEGIN
 UPDATE telegram_deliveries SET state='sending',claimed_at=now() WHERE notification_id=p_notification AND employee_id=p_employee AND claim_token=p_token AND state='claimed' AND claimed_at>=now()-interval '2 minutes';GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;END $$;
CREATE OR REPLACE FUNCTION telegram_finish_v2(p_notification bigint,p_employee uuid,p_token uuid,p_state text,p_message text DEFAULT NULL,p_retry integer DEFAULT 60) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,pg_temp AS $$ DECLARE n integer; BEGIN
 IF p_state NOT IN ('sent','unknown','cancelled','retryable','permanent') THEN RAISE EXCEPTION 'invalid state';END IF;
 UPDATE telegram_deliveries SET state=p_state,finished_at=now(),message_id=p_message,retry_at=CASE WHEN p_state='retryable' THEN now()+make_interval(secs=>greatest(30,least(3600,p_retry))) END WHERE notification_id=p_notification AND employee_id=p_employee AND claim_token=p_token AND state IN ('claimed','sending');GET DIAGNOSTICS n=ROW_COUNT;RETURN n=1;END $$;
REVOKE ALL ON FUNCTION telegram_claim_v2(bigint,uuid),telegram_begin_send_v2(bigint,uuid,uuid),telegram_finish_v2(bigint,uuid,uuid,text,text,integer) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION telegram_claim_v2(bigint,uuid),telegram_begin_send_v2(bigint,uuid,uuid),telegram_finish_v2(bigint,uuid,uuid,text,text,integer) TO service_role;
COMMIT;
-- Existing failed/unknown v1 receipts are NOT retried or reclassified.
