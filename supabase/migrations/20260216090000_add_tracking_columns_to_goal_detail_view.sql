-- Migration: Add tracking_template and data_schema to v_goal_detail_week_actions view
-- These columns were added to 0008-ap-tasks but the view predates them

DROP VIEW IF EXISTS v_goal_detail_week_actions;

CREATE VIEW v_goal_detail_week_actions AS
SELECT t.id AS task_id,
    t.user_id,
    t.title,
    t.description,
    t.status,
    t.type,
    t.recurrence_rule,
    t.input_kind,
    t.unit,
    t.is_urgent,
    t.is_important,
    t.created_at,
    t.updated_at,
    t.sort_order,
    t.tags,
    t.one_thing,
    t.deleted_at,
    t.due_date,
    t.start_date,
    t.end_date,
    t.start_time,
    t.end_time,
    t.is_all_day,
    t.is_anytime,
    t.location,
    t.times_rescheduled,
    COALESCE(gj.twelve_wk_goal_id, gj.custom_goal_id) AS goal_id,
    gj.goal_type AS goal_join_type,
    wp.week_number,
    wp.target_days,
    wp.user_global_timeline_id,
    wp.user_custom_timeline_id,
    COALESCE(wp.user_global_timeline_id, wp.user_custom_timeline_id) AS timeline_id,
    tw.week_start,
    tw.week_end,
    tw.source AS timeline_source,
    ( SELECT count(*)::integer AS count
           FROM "0008-ap-tasks" occ
          WHERE occ.parent_task_id = t.id AND occ.deleted_at IS NULL AND occ.status = 'completed'::status_enum AND occ.due_date >= tw.week_start AND occ.due_date <= tw.week_end) AS weekly_actual,
    ( SELECT COALESCE(json_agg(occ.due_date ORDER BY occ.due_date), '[]'::json) AS "coalesce"
           FROM "0008-ap-tasks" occ
          WHERE occ.parent_task_id = t.id AND occ.deleted_at IS NULL AND occ.status = 'completed'::status_enum AND occ.due_date >= tw.week_start AND occ.due_date <= tw.week_end) AS completed_dates,
    ( SELECT COALESCE(json_agg(json_build_object('id', occ.id, 'due_date', occ.due_date, 'completed_at', occ.completed_at, 'status', occ.status) ORDER BY occ.due_date), '[]'::json) AS "coalesce"
           FROM "0008-ap-tasks" occ
          WHERE occ.parent_task_id = t.id AND occ.deleted_at IS NULL AND occ.status = 'completed'::status_enum AND occ.due_date >= tw.week_start AND occ.due_date <= tw.week_end) AS occurrences,
    ( SELECT COALESCE(json_agg(awp.week_number ORDER BY awp.week_number), '[]'::json) AS "coalesce"
           FROM "0008-ap-task-week-plan" awp
          WHERE awp.task_id = t.id AND awp.deleted_at IS NULL AND (wp.user_global_timeline_id IS NOT NULL AND awp.user_global_timeline_id = wp.user_global_timeline_id OR wp.user_custom_timeline_id IS NOT NULL AND awp.user_custom_timeline_id = wp.user_custom_timeline_id)) AS selected_weeks,
    ( SELECT COALESCE(json_agg(json_build_object('id', r.id, 'label', r.label, 'color', r.color)), '[]'::json) AS "coalesce"
           FROM "0008-ap-universal-roles-join" rj
             JOIN "0008-ap-roles" r ON rj.role_id = r.id
          WHERE rj.parent_id = t.id AND rj.parent_type = 'task'::text) AS roles,
    ( SELECT COALESCE(json_agg(json_build_object('id', d.id, 'name', d.name)), '[]'::json) AS "coalesce"
           FROM "0008-ap-universal-domains-join" dj
             JOIN "0008-ap-domains" d ON dj.domain_id = d.id
          WHERE dj.parent_id = t.id AND dj.parent_type = 'task'::text) AS domains,
    ( SELECT COALESCE(json_agg(json_build_object('id', kr.id, 'name', kr.name)), '[]'::json) AS "coalesce"
           FROM "0008-ap-universal-key-relationships-join" krj
             JOIN "0008-ap-key-relationships" kr ON krj.key_relationship_id = kr.id
          WHERE krj.parent_id = t.id AND krj.parent_type = 'task'::text) AS key_relationships,
    t.tracking_template,
    t.data_schema
   FROM "0008-ap-tasks" t
     JOIN "0008-ap-universal-goals-join" gj ON gj.parent_id = t.id AND gj.parent_type = 'task'::text
     JOIN "0008-ap-task-week-plan" wp ON wp.task_id = t.id AND wp.deleted_at IS NULL
     JOIN v_unified_timeline_weeks tw ON tw.week_number = wp.week_number AND (wp.user_global_timeline_id IS NOT NULL AND tw.timeline_id = wp.user_global_timeline_id AND tw.source = 'global'::text OR wp.user_custom_timeline_id IS NOT NULL AND tw.timeline_id = wp.user_custom_timeline_id AND tw.source = 'custom'::text)
  WHERE t.deleted_at IS NULL AND t.parent_task_id IS NULL AND t.input_kind = 'count'::text AND (t.status <> ALL (ARRAY['completed'::status_enum, 'cancelled'::status_enum]));

GRANT SELECT ON v_goal_detail_week_actions TO authenticated;
