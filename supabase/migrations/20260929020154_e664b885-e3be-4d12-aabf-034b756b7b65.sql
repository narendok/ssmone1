CREATE OR REPLACE FUNCTION public.enqueue_notification(
  _user_id uuid,
  _category text,
  _title text,
  _body text,
  _target_url text,
  _target_entity_type text,
  _target_entity_id uuid,
  _event_key text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL OR _user_id = auth.uid() THEN
    RETURN;
  END IF;

  IF _target_url IS NOT NULL AND _target_url !~ '^/[A-Za-z0-9_/?=&.-]*$' THEN
    RAISE EXCEPTION 'Invalid notification target';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.user_id = _user_id
      AND n.target_entity_type = _target_entity_type
      AND n.target_entity_id = _target_entity_id
      AND n.category = _category
      AND n.body = _event_key
  ) THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (
    user_id, category, title, body, target_url, target_entity_type, target_entity_id
  ) VALUES (
    _user_id, _category, _title, _body, _target_url, _target_entity_type, _target_entity_id
  );
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_notification(uuid, text, text, text, text, text, uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.enqueue_notification(uuid, text, text, text, text, text, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.project_task_notification_recipient(_member_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.user_id
  FROM public.rd_members m
  JOIN public.employees e ON lower(e.official_email) = lower(m.email)
  WHERE m.id = _member_id
    AND m.active = true
    AND e.employment_status = 'ACTIVE'
    AND e.user_id IS NOT NULL
  ORDER BY e.created_at
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.project_task_notification_recipient(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_task_notification_recipient(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.project_task_notification_project_lead(_project_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT e.user_id
  FROM public.projects p
  JOIN public.employees e ON e.id = COALESCE(p.project_manager_employee_id, p.engineering_lead_employee_id)
  WHERE p.id = _project_id
    AND e.employment_status = 'ACTIVE'
    AND e.user_id IS NOT NULL
  LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.project_task_notification_project_lead(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.project_task_notification_project_lead(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.notify_project_task_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee_user_id uuid;
  v_previous_assignee_user_id uuid;
  v_project_lead_user_id uuid;
  v_target_url text := '/tasks';
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    v_target_url := '/projects/' || NEW.project_id;
  END IF;

  v_assignee_user_id := public.project_task_notification_recipient(NEW.assignee_id);

  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_notification(
      v_assignee_user_id,
      'TASK',
      'Task assigned: ' || NEW.title,
      'You have been assigned a ' || NEW.priority || ' priority task.',
      v_target_url,
      'project_task',
      NEW.id,
      'task-assigned:' || NEW.id || ':' || COALESCE(NEW.assignee_id::text, '')
    );
    RETURN NEW;
  END IF;

  IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
    v_previous_assignee_user_id := public.project_task_notification_recipient(OLD.assignee_id);
    PERFORM public.enqueue_notification(
      v_previous_assignee_user_id,
      'TASK',
      'Task reassigned: ' || NEW.title,
      'This task is no longer assigned to you.',
      v_target_url,
      'project_task',
      NEW.id,
      'task-reassigned-from:' || NEW.id || ':' || COALESCE(OLD.assignee_id::text, '') || ':' || COALESCE(NEW.assignee_id::text, '')
    );
    PERFORM public.enqueue_notification(
      v_assignee_user_id,
      'TASK',
      'Task assigned: ' || NEW.title,
      'This task has been assigned to you.',
      v_target_url,
      'project_task',
      NEW.id,
      'task-reassigned-to:' || NEW.id || ':' || COALESCE(OLD.assignee_id::text, '') || ':' || COALESCE(NEW.assignee_id::text, '')
    );
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_project_lead_user_id := public.project_task_notification_project_lead(NEW.project_id);
    PERFORM public.enqueue_notification(
      v_assignee_user_id,
      'TASK',
      'Task status changed: ' || NEW.title,
      'Status changed from ' || OLD.status || ' to ' || NEW.status || '.',
      v_target_url,
      'project_task',
      NEW.id,
      'task-status-assignee:' || NEW.id || ':' || OLD.status || ':' || NEW.status || ':' || NEW.updated_at::text
    );
    PERFORM public.enqueue_notification(
      v_project_lead_user_id,
      'TASK',
      'Task progress updated: ' || NEW.title,
      'Status changed from ' || OLD.status || ' to ' || NEW.status || '.',
      v_target_url,
      'project_task',
      NEW.id,
      'task-status-lead:' || NEW.id || ':' || OLD.status || ':' || NEW.status || ':' || NEW.updated_at::text
    );
  END IF;

  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_project_task_change() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS project_tasks_notify_changes ON public.project_tasks;
CREATE TRIGGER project_tasks_notify_changes
AFTER INSERT OR UPDATE OF assignee_id, status ON public.project_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_project_task_change();

CREATE OR REPLACE FUNCTION public.notify_project_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_task public.project_tasks%ROWTYPE;
  v_assignee_user_id uuid;
  v_project_lead_user_id uuid;
  v_target_url text := '/tasks';
BEGIN
  IF NEW.kind <> 'comment' THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_task FROM public.project_tasks WHERE id = NEW.task_id;
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  IF v_task.project_id IS NOT NULL THEN
    v_target_url := '/projects/' || v_task.project_id;
  END IF;

  v_assignee_user_id := public.project_task_notification_recipient(v_task.assignee_id);
  v_project_lead_user_id := public.project_task_notification_project_lead(v_task.project_id);

  PERFORM public.enqueue_notification(
    v_assignee_user_id,
    'TASK',
    'Task comment: ' || v_task.title,
    'A new update was added to this task.',
    v_target_url,
    'project_task_activity',
    NEW.id,
    'task-comment-assignee:' || NEW.id
  );
  PERFORM public.enqueue_notification(
    v_project_lead_user_id,
    'TASK',
    'Task comment: ' || v_task.title,
    'A new update was added to this task.',
    v_target_url,
    'project_task_activity',
    NEW.id,
    'task-comment-lead:' || NEW.id
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_project_task_comment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS project_task_activity_notify_comment ON public.project_task_activity;
CREATE TRIGGER project_task_activity_notify_comment
AFTER INSERT ON public.project_task_activity
FOR EACH ROW EXECUTE FUNCTION public.notify_project_task_comment();

CREATE OR REPLACE FUNCTION public.notify_purchase_request_decision()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target_url text := '/procurement/requests';
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  PERFORM public.enqueue_notification(
    NEW.requester_id,
    'APPROVAL',
    'Purchase request updated: ' || NEW.request_number,
    'Status changed from ' || OLD.status || ' to ' || NEW.status || '.',
    v_target_url,
    'purchase_request',
    NEW.id,
    'purchase-request-status:' || NEW.id || ':' || OLD.status || ':' || NEW.status || ':' || NEW.updated_at::text
  );
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_purchase_request_decision() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS purchase_requests_notify_decision ON public.purchase_requests;
CREATE TRIGGER purchase_requests_notify_decision
AFTER UPDATE OF status ON public.purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_purchase_request_decision();

CREATE OR REPLACE FUNCTION public.notify_leave_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id uuid;
BEGIN
  SELECT e.user_id INTO v_requester_user_id
  FROM public.employees e
  WHERE e.id = NEW.employee_id
    AND e.employment_status = 'ACTIVE'
    AND e.user_id IS NOT NULL;

  IF TG_OP = 'INSERT' THEN
    PERFORM public.enqueue_notification(
      NEW.approver_user_id,
      'HR',
      'Leave approval pending',
      'A team member submitted a leave request for your review.',
      '/hr/leave',
      'hr_leave_request',
      NEW.id,
      'leave-request-submitted:' || NEW.id
    );
  ELSIF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('approved', 'rejected', 'cancelled') THEN
    PERFORM public.enqueue_notification(
      v_requester_user_id,
      'HR',
      'Leave request ' || NEW.status,
      'Your leave request status changed from ' || OLD.status || ' to ' || NEW.status || '.',
      '/hr/leave',
      'hr_leave_request',
      NEW.id,
      'leave-request-decision:' || NEW.id || ':' || OLD.status || ':' || NEW.status || ':' || NEW.updated_at::text
    );
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_leave_request_event() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS hr_leave_requests_notify_event ON public.hr_leave_requests;
CREATE TRIGGER hr_leave_requests_notify_event
AFTER INSERT OR UPDATE OF status ON public.hr_leave_requests
FOR EACH ROW EXECUTE FUNCTION public.notify_leave_request_event();

CREATE OR REPLACE FUNCTION public.get_notification_inbox_state()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_total integer;
  v_unread integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  SELECT count(*)::integer, count(*) FILTER (WHERE NOT is_read)::integer
  INTO v_total, v_unread
  FROM public.notifications
  WHERE user_id = auth.uid();

  RETURN jsonb_build_object('total_count', v_total, 'unread_count', v_unread);
END;
$$;
REVOKE ALL ON FUNCTION public.get_notification_inbox_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_notification_inbox_state() TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_marked integer;
  v_unread integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication is required';
  END IF;

  WITH updated AS (
    UPDATE public.notifications
    SET is_read = true,
        read_at = COALESCE(read_at, now())
    WHERE user_id = auth.uid()
      AND is_read = false
    RETURNING id
  )
  SELECT count(*)::integer INTO v_marked FROM updated;

  SELECT count(*)::integer INTO v_unread
  FROM public.notifications
  WHERE user_id = auth.uid()
    AND is_read = false;

  RETURN jsonb_build_object('marked_count', v_marked, 'unread_count', v_unread);
END;
$$;
REVOKE ALL ON FUNCTION public.mark_all_notifications_read() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read() TO authenticated, service_role;

DROP POLICY IF EXISTS "Users manage their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Notification recipients view and update their own inbox" ON public.notifications;
CREATE POLICY "Notification recipients view and update their own inbox"
ON public.notifications
FOR SELECT TO authenticated
USING (auth.uid() = user_id);
CREATE POLICY "Notification recipients update their own inbox"
ON public.notifications
FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Admins view all notifications" ON public.notifications;
CREATE POLICY "Admins view all notifications"
ON public.notifications
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, DELETE ON public.notifications FROM authenticated;