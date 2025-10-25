-- Drop dependent views
DROP VIEW IF EXISTS v_dashboard_next_occurrences;
DROP VIEW IF EXISTS v_tasks_with_recurrence_expanded;

-- Drop and recreate the function with the fix
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer, integer);
DROP FUNCTION IF EXISTS fn_expand_recurrence_dates(date, text, date, jsonb, integer);

CREATE FUNCTION fn_expand_recurrence_dates(
  p_start_date date,
  p_recurrence_rule text,
  p_recurrence_end_date date,
  p_recurrence_exceptions jsonb DEFAULT '[]'::jsonb,
  p_max_future_days integer DEFAULT 365,
  p_max_past_days integer DEFAULT 90
)
RETURNS TABLE (occurrence_date date)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_freq text;
  v_interval integer := 1;
  v_byday text;
  v_bymonthday integer;
  v_bysetpos integer;
  v_count integer;
  v_end_date date;
  v_current_date date;
  v_occurrence_count integer := 0;
  v_max_occurrences integer := 1000;
  v_day_codes text[];
  v_day_code text;
  v_dow integer;
  v_temp_date date;
  v_week_num integer;
  v_month_last_day integer;
BEGIN
  v_freq := (regexp_matches(p_recurrence_rule, 'FREQ=(\w+)', 'i'))[1];
  
  IF p_recurrence_rule ~* 'INTERVAL=(\d+)' THEN
    v_interval := (regexp_matches(p_recurrence_rule, 'INTERVAL=(\d+)', 'i'))[1]::integer;
  END IF;
  
  IF p_recurrence_rule ~* 'BYDAY=([A-Z,]+)' THEN
    v_byday := (regexp_matches(p_recurrence_rule, 'BYDAY=([A-Z,]+)', 'i'))[1];
  END IF;
  
  IF p_recurrence_rule ~* 'BYMONTHDAY=(-?\d+)' THEN
    v_bymonthday := (regexp_matches(p_recurrence_rule, 'BYMONTHDAY=(-?\d+)', 'i'))[1]::integer;
  END IF;
  
  IF p_recurrence_rule ~* 'BYSETPOS=(-?\d+)' THEN
    v_bysetpos := (regexp_matches(p_recurrence_rule, 'BYSETPOS=(-?\d+)', 'i'))[1]::integer;
  END IF;
  
  IF p_recurrence_rule ~* 'COUNT=(\d+)' THEN
    v_count := (regexp_matches(p_recurrence_rule, 'COUNT=(\d+)', 'i'))[1]::integer;
  END IF;
  
  v_end_date := COALESCE(p_recurrence_end_date, CURRENT_DATE + p_max_future_days);
  v_current_date := p_start_date;
  
  IF v_freq = 'DAILY' THEN
    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      IF NOT (p_recurrence_exceptions ? v_current_date::text) THEN
        occurrence_date := v_current_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;
      v_current_date := v_current_date + (v_interval || ' days')::interval;
      IF v_occurrence_count >= v_max_occurrences THEN EXIT; END IF;
    END LOOP;
  
  ELSIF v_freq = 'WEEKLY' THEN
    IF v_byday IS NULL THEN
      v_byday := CASE EXTRACT(DOW FROM p_start_date)
        WHEN 0 THEN 'SU' WHEN 1 THEN 'MO' WHEN 2 THEN 'TU' WHEN 3 THEN 'WE'
        WHEN 4 THEN 'TH' WHEN 5 THEN 'FR' WHEN 6 THEN 'SA' END;
    END IF;
    
    v_day_codes := string_to_array(v_byday, ',');
    v_current_date := p_start_date - (EXTRACT(DOW FROM p_start_date)::integer || ' days')::interval;
    v_week_num := 0;
    
    WHILE v_current_date <= v_end_date + INTERVAL '6 days'
          AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      FOREACH v_day_code IN ARRAY v_day_codes LOOP
        v_dow := CASE v_day_code
          WHEN 'SU' THEN 0 WHEN 'MO' THEN 1 WHEN 'TU' THEN 2 WHEN 'WE' THEN 3
          WHEN 'TH' THEN 4 WHEN 'FR' THEN 5 WHEN 'SA' THEN 6 END;
        
        v_temp_date := v_current_date + (v_dow || ' days')::interval;
        
        IF v_temp_date >= p_start_date AND v_temp_date <= v_end_date
           AND NOT (p_recurrence_exceptions ? v_temp_date::text) THEN
          occurrence_date := v_temp_date;
          RETURN NEXT;
          v_occurrence_count := v_occurrence_count + 1;
          IF v_count IS NOT NULL AND v_occurrence_count >= v_count THEN RETURN; END IF;
        END IF;
      END LOOP;
      
      v_week_num := v_week_num + 1;
      v_current_date := p_start_date - (EXTRACT(DOW FROM p_start_date)::integer || ' days')::interval
                        + ((v_week_num * v_interval * 7) || ' days')::interval;
      IF v_occurrence_count >= v_max_occurrences THEN EXIT; END IF;
    END LOOP;
  
  ELSIF v_freq = 'MONTHLY' THEN
    v_current_date := p_start_date;
    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      v_temp_date := NULL;
      IF v_bymonthday IS NOT NULL THEN
        IF v_bymonthday > 0 THEN
          v_month_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::integer;
          v_temp_date := DATE_TRUNC('month', v_current_date) + (LEAST(v_bymonthday, v_month_last_day) - 1 || ' days')::interval;
        ELSE
          v_temp_date := DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day' + (v_bymonthday || ' days')::interval;
        END IF;
      ELSIF v_byday IS NOT NULL AND v_bysetpos IS NOT NULL THEN
        v_dow := CASE v_byday
          WHEN 'SU' THEN 0 WHEN 'MO' THEN 1 WHEN 'TU' THEN 2 WHEN 'WE' THEN 3
          WHEN 'TH' THEN 4 WHEN 'FR' THEN 5 WHEN 'SA' THEN 6 END;
        SELECT day INTO v_temp_date FROM (
          SELECT d::date as day, ROW_NUMBER() OVER (ORDER BY d) as rn
          FROM generate_series(DATE_TRUNC('month', v_current_date)::date,
            (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day')::date, '1 day'::interval) d
          WHERE EXTRACT(DOW FROM d) = v_dow
        ) weekdays WHERE rn = CASE WHEN v_bysetpos > 0 THEN v_bysetpos
          ELSE (SELECT COUNT(*) FROM generate_series(DATE_TRUNC('month', v_current_date)::date,
            (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day')::date, '1 day'::interval) d
            WHERE EXTRACT(DOW FROM d) = v_dow) + v_bysetpos + 1 END;
      ELSE
        v_month_last_day := EXTRACT(DAY FROM (DATE_TRUNC('month', v_current_date) + INTERVAL '1 month - 1 day'))::integer;
        v_temp_date := DATE_TRUNC('month', v_current_date) +
                       (LEAST(EXTRACT(DAY FROM p_start_date)::integer, v_month_last_day) - 1 || ' days')::interval;
      END IF;
      
      IF v_temp_date IS NOT NULL AND v_temp_date >= p_start_date AND v_temp_date <= v_end_date
         AND NOT (p_recurrence_exceptions ? v_temp_date::text) THEN
        occurrence_date := v_temp_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;
      v_current_date := (DATE_TRUNC('month', v_current_date) + (v_interval || ' months')::interval)::date;
      IF v_occurrence_count >= v_max_occurrences THEN EXIT; END IF;
    END LOOP;
  
  ELSIF v_freq = 'YEARLY' THEN
    v_current_date := p_start_date;
    WHILE v_current_date <= v_end_date AND (v_count IS NULL OR v_occurrence_count < v_count) LOOP
      IF NOT (p_recurrence_exceptions ? v_current_date::text) THEN
        occurrence_date := v_current_date;
        RETURN NEXT;
        v_occurrence_count := v_occurrence_count + 1;
      END IF;
      v_current_date := (DATE_TRUNC('year', v_current_date) + (v_interval || ' years')::interval +
                        ((EXTRACT(MONTH FROM p_start_date) - 1) || ' months')::interval +
                        ((EXTRACT(DAY FROM p_start_date) - 1) || ' days')::interval)::date;
      IF v_occurrence_count >= v_max_occurrences THEN EXIT; END IF;
    END LOOP;
  END IF;
  
  RETURN;
END;
$$;