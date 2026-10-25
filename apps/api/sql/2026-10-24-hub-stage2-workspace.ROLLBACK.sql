-- ROLLBACK for 2026-10-24-hub-stage2-workspace.sql. Run ONLY on Thulaib's word: it removes every row in these tables.
-- The approvals trigger refuses deletes, so it is dropped first. Files in the bucket must be emptied before the bucket goes.
drop trigger if exists os_approvals_frozen on public.os_approvals;
drop table if exists public.os_approvals, public.os_post_versions, public.os_posts, public.os_work_tasks, public.os_messages,
  public.os_files, public.os_door_tries, public.os_people cascade;
drop function if exists public.os_approvals_frozen(), public.os_work_guard();
delete from storage.buckets where id = 'hub-media';
