alter function public.set_updated_at() set search_path = public;
revoke execute on function public.is_allowed() from anon;
revoke execute on function public.is_allowed() from public;
