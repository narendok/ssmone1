ALTER TABLE public.project_tasks ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
ALTER TABLE public.rd_members ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);
CREATE INDEX IF NOT EXISTS project_tasks_department_id_idx ON public.project_tasks(department_id);
CREATE INDEX IF NOT EXISTS rd_members_department_id_idx ON public.rd_members(department_id);
UPDATE public.project_tasks AS task
SET department_id = department.id
FROM public.departments AS department
WHERE task.department_id IS NULL
  AND (
    lower(btrim(department.name)) = CASE task.department::text
      WHEN 'hardware' THEN 'hardware'
      WHEN 'firmware' THEN 'firmware'
      WHEN 'mechanical' THEN 'mechanical'
      WHEN 'qa' THEN 'qa'
      WHEN 'procurement' THEN 'procurement'
      WHEN 'production' THEN 'production'
      WHEN 'executive' THEN 'executive / pm'
      ELSE task.department::text
    END
    OR lower(task.department::text) = ANY(SELECT lower(alias) FROM unnest(department.aliases) AS alias)
  );
UPDATE public.rd_members AS member
SET department_id = department.id
FROM public.departments AS department
WHERE member.department_id IS NULL
  AND (
    lower(btrim(department.name)) = CASE member.department::text
      WHEN 'hardware' THEN 'hardware'
      WHEN 'firmware' THEN 'firmware'
      WHEN 'mechanical' THEN 'mechanical'
      WHEN 'qa' THEN 'qa'
      WHEN 'procurement' THEN 'procurement'
      WHEN 'production' THEN 'production'
      WHEN 'executive' THEN 'executive / pm'
      ELSE member.department::text
    END
    OR lower(member.department::text) = ANY(SELECT lower(alias) FROM unnest(department.aliases) AS alias)
  );